/**
 * Google Sheets (Apps Script) синхрончлолын хөдөлгүүр.
 *
 * Зарчим: апп өөрийн локал төлөвөөр шууд ажиллана (хурдан), харин өөрчлөлт бүрийг
 * сүүлд амжилттай Sheet-д хадгалагдсан хувилбартай (snapshot) харьцуулж ялгааг
 * Apps Script рүү илгээнэ. Ингэснээр:
 *   - сүлжээ тасарвал өөрчлөлт алдагдахгүй, автоматаар дахин оролдоно (backoff);
 *   - хуудас дахин ачаалсан ч хадгалагдаагүй өөрчлөлт (snapshot-оос зөрүүтэй) үлдэнэ;
 *   - Sheet-ээс татахдаа хадгалагдаагүй өөрчлөлт байвал ЭХЛЭЭД илгээнэ (дарж бичихгүй).
 */
import { gasPost, gasGet, GasApiError, GasNetworkError } from './gasClient';

export type TableName =
  | 'Schedule'
  | 'Homework'
  | 'Submissions'
  | 'Groups'
  | 'Leaders'
  | 'StudentData'
  | 'Subjects'
  | 'AuditLog';

export interface TableBinding {
  name: TableName;
  key: string;
  /** Апп-аас устгагдсан мөрийг Sheet-ээс устгах эсэх */
  propagateDeletes: boolean;
  get(): any[];
  set(rows: any[]): void;
}

export interface SyncStatus {
  connected: boolean;
  syncing: boolean;
  pending: number;
  lastSyncAt: string | null;
  lastError: string | null;
  lastPushAt: string | null;
}

export interface PullPayload {
  tables: Partial<Record<TableName, any[]>>;
  users?: any[];
}

interface Host {
  getUrl(): string;
  getToken(): string | null;
  getRole(): string | null;
  bindings(): TableBinding[];
  /** Pull-ээр ирсэн Sheet-ийн өгөгдлийг төлөвт хэрэглэх */
  applyPull(payload: PullPayload): void;
  /** Нэвтрэх эрх хүчингүй болсон */
  onAuthError(message: string): void;
  onChange(): void;
}

const SNAPSHOT_KEY = 'homework_app_sync_snapshot_v1';
const CHUNK_ROWS = 150;
const MAX_BACKOFF_MS = 60000;

/** Эрх бүрээр бичиж болох хүснэгтүүд (сервер дээр мөн давхар шалгана). */
const WRITABLE_BY_ROLE: Record<string, TableName[]> = {
  TEACHER: ['Schedule', 'Homework', 'Submissions', 'Groups', 'Leaders', 'StudentData', 'Subjects', 'AuditLog'],
  LEADER: ['Homework', 'Submissions', 'AuditLog'],
  STUDENT: ['Submissions', 'AuditLog']
};

function stableStringify(v: any): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const keys = Object.keys(v)
    .filter(k => v[k] !== undefined)
    .sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
}

type Snapshot = Partial<Record<TableName, Record<string, string>>>;

interface Change {
  table: TableName;
  upsert: any[];
  remove: string[];
}

export class SheetSync {
  private host: Host;
  private snapshot: Snapshot = {};
  private flushing: Promise<void> | null = null;
  private pulling: Promise<void> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private autoTimer: ReturnType<typeof setInterval> | null = null;
  private backoff = 3000;
  private applyingRemote = false;
  private needsPull = false;
  private listeners = new Set<() => void>();
  private status: SyncStatus = {
    connected: false,
    syncing: false,
    pending: 0,
    lastSyncAt: null,
    lastError: null,
    lastPushAt: null
  };

  constructor(host: Host) {
    this.host = host;
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (raw) this.snapshot = JSON.parse(raw);
    } catch {
      this.snapshot = {};
    }
  }

  // ---------------------------------------------------------------- Status ----

  public getStatus(): SyncStatus {
    return { ...this.status };
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(patch: Partial<SyncStatus> = {}) {
    this.status = { ...this.status, ...patch };
    this.listeners.forEach(l => {
      try {
        l();
      } catch {
        /* ignore */
      }
    });
  }

  public isApplyingRemote() {
    return this.applyingRemote;
  }

  // -------------------------------------------------------------- Snapshot ----

  private persistSnapshot() {
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(this.snapshot));
    } catch (e) {
      console.warn('Snapshot хадгалах боломжгүй', e);
    }
  }

  public resetSnapshot() {
    this.snapshot = {};
    try {
      localStorage.removeItem(SNAPSHOT_KEY);
    } catch {
      /* ignore */
    }
    this.emit({ pending: 0 });
  }

  private rebuildSnapshotFromState() {
    const snap: Snapshot = {};
    for (const b of this.host.bindings()) {
      const map: Record<string, string> = {};
      for (const row of b.get()) map[String(row[b.key])] = stableStringify(row);
      snap[b.name] = map;
    }
    this.snapshot = snap;
    this.persistSnapshot();
  }

  private writableTables(): Set<TableName> {
    return new Set(WRITABLE_BY_ROLE[this.host.getRole() || ''] || []);
  }

  /** Snapshot-тэй харьцуулж илгээх ёстой өөрчлөлтүүдийг тооцно. */
  private computeChanges(): { changes: Change[]; settledOnly: Change[] } {
    const writable = this.writableTables();
    const changes: Change[] = [];
    const settledOnly: Change[] = [];

    for (const b of this.host.bindings()) {
      const snap = this.snapshot[b.name] || {};
      const rows = b.get();
      const upsert: any[] = [];
      const seen = new Set<string>();
      for (const row of rows) {
        const id = String(row[b.key] ?? '');
        if (!id) continue;
        seen.add(id);
        if (snap[id] !== stableStringify(row)) upsert.push(row);
      }
      const remove: string[] = [];
      if (b.propagateDeletes) {
        for (const id of Object.keys(snap)) if (!seen.has(id)) remove.push(id);
      }
      if (!upsert.length && !remove.length) continue;
      const ch = { table: b.name, upsert, remove };
      (writable.has(b.name) ? changes : settledOnly).push(ch);
    }
    return { changes, settledOnly };
  }

  public countPending(): number {
    if (!this.status.connected) return 0;
    const { changes } = this.computeChanges();
    return changes.reduce((n, c) => n + c.upsert.length + c.remove.length, 0);
  }

  /** Холболтын төлвөөс үл хамааран хадгалагдаагүй мөрийн тоо. */
  public countPendingRaw(): number {
    const { changes } = this.computeChanges();
    return changes.reduce((n, c) => n + c.upsert.length + c.remove.length, 0);
  }

  private refreshPending() {
    this.emit({ pending: this.countPending() });
  }

  // ----------------------------------------------------------------- Setup ----

  public start() {
    this.emit({ connected: true });
    this.refreshPending();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.onOnline);
      window.addEventListener('beforeunload', this.onBeforeUnload);
      document.addEventListener('visibilitychange', this.onVisible);
    }
    if (this.autoTimer) clearInterval(this.autoTimer);
    this.autoTimer = setInterval(() => this.autoTick(), 45000);
  }

  public stop() {
    this.emit({ connected: false, pending: 0 });
    if (this.autoTimer) clearInterval(this.autoTimer);
    this.autoTimer = null;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.retryTimer = null;
    this.debounceTimer = null;
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onOnline);
      window.removeEventListener('beforeunload', this.onBeforeUnload);
      document.removeEventListener('visibilitychange', this.onVisible);
    }
  }

  private onOnline = () => {
    this.backoff = 3000;
    void this.flush();
  };

  private onVisible = () => {
    if (document.visibilityState === 'visible') this.autoTick();
  };

  private onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (this.countPending() > 0) {
      e.preventDefault();
      e.returnValue = '';
    }
  };

  private autoTick() {
    if (!this.status.connected || this.status.syncing) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    if (!this.host.getToken()) return;
    void this.pull({ silent: true }).catch(() => {
      /* статус дотор бүртгэгдсэн */
    });
  }

  /** Төлөвт өөрчлөлт орсны дараа дуудна (debounce-той). */
  public notifyLocalChange() {
    if (this.applyingRemote || !this.status.connected) return;
    this.refreshPending();
    if (!this.host.getToken()) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => void this.flush(), 700);
  }

  // ----------------------------------------------------------------- Push ----

  public flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    this.flushing = this.doFlush().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private scheduleRetry() {
    if (this.retryTimer) return;
    const delay = this.backoff;
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.flush();
    }, delay);
  }

  private async doFlush(): Promise<void> {
    const url = this.host.getUrl();
    const token = this.host.getToken();
    if (!url || !token || !this.status.connected) return;

    // Эрхгүй хүснэгтийн өөрчлөлтийг "шийдвэрлэгдсэн" гэж тэмдэглэнэ (дараагийн pull зөв төлөвийг сэргээнэ).
    const first = this.computeChanges();
    if (first.settledOnly.length) {
      this.applySettled(first.settledOnly);
      this.persistSnapshot();
    }

    this.emit({ syncing: true });
    try {
      // Хүсэлтийн явцад хэрэглэгч дахин засвар хийж болох тул давтаж шалгана.
      for (let guard = 0; guard < 50; guard++) {
        const { changes } = this.computeChanges();
        if (!changes.length) break;

        const batch = this.takeBatch(changes);
        const res: any = await gasPost(url, { action: 'sync', token, changes: batch });

        let diverged = false;
        for (const r of res.results || []) {
          if ((r.rejected && r.rejected.length) || (r.skipped && r.skipped.length) || (r.adjusted && r.adjusted.length)) diverged = true;
          if (r.idMap && Object.keys(r.idMap).length) diverged = true;
          if (r.rejected && r.rejected.length) {
            console.warn(`[sync] ${r.table}: сервер татгалзсан мөрүүд`, r.rejected);
          }
        }
        this.applySettled(batch);
        this.persistSnapshot();
        if (diverged) this.needsPull = true;
        this.backoff = 3000;
        this.emit({ lastPushAt: new Date().toISOString(), lastError: null });
      }
      this.emit({ syncing: false, lastError: null });
      this.refreshPending();

      if (this.needsPull) {
        // Сервер зарим мөрийг татгалзсан/өөрчилсөн: Sheet-ийн үнэн төлөвийг сэргээнэ.
        // (await хийхгүй: pull нь flush-ийг хүлээдэг тул түгжигдэхээс сэргийлнэ)
        this.needsPull = false;
        void this.pull({ silent: true }).catch(() => {
          /* статус дотор бүртгэгдсэн */
        });
      }
    } catch (err) {
      this.emit({ syncing: false });
      this.handleError(err, true);
    }
  }

  private takeBatch(changes: Change[]): Change[] {
    let budget = CHUNK_ROWS;
    const out: Change[] = [];
    for (const ch of changes) {
      if (budget <= 0) break;
      const upsert = ch.upsert.slice(0, budget);
      budget -= upsert.length;
      const remove = budget > 0 ? ch.remove.slice(0, budget) : [];
      budget -= remove.length;
      if (upsert.length || remove.length) out.push({ table: ch.table, upsert, remove });
    }
    return out;
  }

  private bindingOf(name: TableName): TableBinding | undefined {
    return this.host.bindings().find(b => b.name === name);
  }

  /** Илгээсэн мөрүүдийг snapshot-д "хадгалагдсан" гэж бүртгэнэ. */
  private applySettled(batch: Change[]) {
    for (const ch of batch) {
      const b = this.bindingOf(ch.table);
      if (!b) continue;
      const snap = (this.snapshot[ch.table] = this.snapshot[ch.table] || {});
      for (const row of ch.upsert) snap[String(row[b.key])] = stableStringify(row);
      for (const id of ch.remove) delete snap[id];
    }
  }

  private handleError(err: unknown, schedule: boolean) {
    if (err instanceof GasApiError && (err.code === 'AUTH' || err.code === 'FORBIDDEN')) {
      this.emit({ lastError: err.message });
      this.host.onAuthError(err.message);
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    this.emit({ lastError: message });
    this.refreshPending();
    const retryable = err instanceof GasNetworkError || (err instanceof GasApiError && err.retryable);
    if (schedule && retryable) this.scheduleRetry();
  }

  // ----------------------------------------------------------------- Pull ----

  /**
   * Sheet-ийн өгөгдлийг татаж локал төлөвийг сэргээнэ.
   * Хадгалагдаагүй локал өөрчлөлт байвал эхлээд илгээнэ; илгээж чадахгүй бол
   * локал өөрчлөлтийг ДАРАХГҮЙ (алдаа шиднэ).
   */
  public pull(opts: { silent?: boolean } = {}): Promise<void> {
    if (this.pulling) return this.pulling;
    this.pulling = this.doPull(opts).finally(() => {
      this.pulling = null;
    });
    return this.pulling;
  }

  private async doPull(opts: { silent?: boolean }): Promise<void> {
    const url = this.host.getUrl();
    const token = this.host.getToken();
    if (!url || !token) return;

    for (let attempt = 0; attempt < 3; attempt++) {
      await this.flush();
      if (this.countPending() > 0) {
        throw new Error(this.status.lastError || 'Хадгалагдаагүй өөрчлөлт байгаа тул Sheet-ээс татаж чадсангүй.');
      }

      this.emit({ syncing: true });
      let res: any;
      try {
        res = await gasPost(url, { action: 'fetchAll', token });
      } catch (err) {
        this.emit({ syncing: false });
        this.handleError(err, false);
        throw err;
      }

      // Татаж байх хооронд хэрэглэгч засвар хийсэн бол дарж бичихгүй, дахин оролдоно.
      if (this.countPending() > 0) continue;

      this.applyingRemote = true;
      try {
        this.host.applyPull({ tables: tablesFromResponse(res.data), users: res.data?.users });
        this.rebuildSnapshotFromState();
      } finally {
        this.applyingRemote = false;
      }
      this.emit({ syncing: false, lastSyncAt: new Date().toISOString(), lastError: null, pending: 0 });
      this.host.onChange();
      return;
    }
    this.emit({ syncing: false });
  }

  /** Нэвтрээгүй хэрэглэгчид нийтийн самбарын өгөгдөл (локал төлөвийг орлоно, push хийхгүй). */
  public async pullPublic(): Promise<void> {
    const url = this.host.getUrl();
    if (!url) return;
    const res: any = await gasGet(url, { action: 'publicSnapshot' });
    this.applyingRemote = true;
    try {
      this.host.applyPull({ tables: tablesFromResponse(res.data), users: [] });
      this.snapshot = {};
      this.persistSnapshot();
    } finally {
      this.applyingRemote = false;
    }
    this.emit({ lastSyncAt: new Date().toISOString(), lastError: null });
    this.host.onChange();
  }
}

function tablesFromResponse(data: any): Partial<Record<TableName, any[]>> {
  const d = data || {};
  return {
    Schedule: d.schedule || [],
    Homework: d.homework || [],
    Submissions: d.submissions || [],
    Groups: d.groups || [],
    Leaders: d.leaders || [],
    StudentData: d.students || [],
    Subjects: d.subjects || [],
    AuditLog: d.auditLogs || []
  };
}
