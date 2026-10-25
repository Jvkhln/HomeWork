// Apps Script-ийг Node дээр mock SpreadsheetApp-аар ажиллуулах тест харнесс.
// Ажиллуулах: node apps-script/test/harness.js
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');
const path = require('path');

function makeEnv(initialSheets) {
  let idCounter = 1;
  class Sheet {
    constructor(name) { this.name = name; this.id = idCounter++; this.cells = []; this.formats = []; this.frozen = 0; this.maxRows = 1000; }
    getName() { return this.name; }
    getSheetId() { return this.id; }
    getMaxRows() { return this.maxRows; }
    getFrozenRows() { return this.frozen; }
    setFrozenRows(n) { this.frozen = n; }
    getLastRow() { for (let r = this.cells.length - 1; r >= 0; r--) if ((this.cells[r] || []).some(v => v !== '' && v !== undefined)) return r + 1; return 0; }
    getLastColumn() { let m = 0; this.cells.forEach(row => { for (let c = (row || []).length - 1; c >= 0; c--) if (row[c] !== '' && row[c] !== undefined) { m = Math.max(m, c + 1); break; } }); return m; }
    insertRowsAfter(after, n) { this.maxRows += n; }
    deleteRow(r) { this.cells.splice(r - 1, 1); this.formats.splice(r - 1, 1); this.maxRows--; }
    getRange(r, c, nr = 1, nc = 1) { return new Range(this, r, c, nr, nc); }
    _fmt(r, c) { return (this.formats[r - 1] || [])[c - 1] || ''; }
    _set(r, c, v) {
      while (this.cells.length < r) this.cells.push([]);
      const row = this.cells[r - 1]; while (row.length < c) row.push('');
      // Sheets-ийн автомат хөрвүүлэлтийг дууриана: текст формат биш бол огноо/тоо/boolean болгоно
      if (this._fmt(r, c) !== '@' && typeof v === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) v = new Date(v + 'T00:00:00+08:00');
        else if (/^\d{1,2}:\d{2}$/.test(v)) { const [h, m] = v.split(':').map(Number); v = new Date(Date.UTC(1899, 11, 30, h, m) - 7 * 3600e3 - 7 * 60e3); v._timeOnly = v; }
        else if (v === 'TRUE' || v === 'true') v = true; else if (v === 'FALSE' || v === 'false') v = false;
        else if (/^-?\d+(\.\d+)?$/.test(v) && !/^0\d/.test(v)) v = Number(v);
      }
      row[c - 1] = v;
    }
  }
  class Range {
    constructor(s, r, c, nr, nc) { Object.assign(this, { s, r, c, nr, nc }); }
    getValues() { const out = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) { const v = (this.s.cells[this.r - 1 + i] || [])[this.c - 1 + j]; row.push(v === undefined ? '' : v); } out.push(row); } return out; }
    getDisplayValues() { return this.getValues().map(row => row.map(v => v instanceof Date ? (v._timeOnly ? String(v.getUTCHours() + 7 + (v.getUTCMinutes() + 7 >= 60 ? 1 : 0)).padStart(2, '0') + ':' + String((v.getUTCMinutes() + 7) % 60).padStart(2, '0') : v.toISOString().slice(0, 10)) : String(v))); }
    setValues(vals) { vals.forEach((row, i) => row.forEach((v, j) => this.s._set(this.r + i, this.c + j, v))); return this; }
    setValue(v) { this.s._set(this.r, this.c, v); return this; }
    setNumberFormat(f) { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) { const rr = this.r + i; while (this.s.formats.length < rr) this.s.formats.push([]); this.s.formats[rr - 1][this.c - 1 + j] = f; } return this; }
    setFontWeight() { return this; } setBackground() { return this; }
  }
  const sheets = [];
  const ss = {
    getSheets: () => sheets,
    getSheetByName: n => sheets.find(s => s.name === n) || null,
    insertSheet: n => { const s = new Sheet(n); sheets.push(s); return s; },
  };
  for (const [name, rows] of initialSheets) { const s = ss.insertSheet(name); s.formats = []; rows.forEach((row, i) => row.forEach((v, j) => { s.getRange(i + 1, j + 1).setNumberFormat('@'); s._set(i + 1, j + 1, v); })); }

  const cacheStore = new Map();
  const props = new Map();
  const sandbox = {
    console, JSON, Date, Math, Object, Array, String, Number, parseInt, isNaN, RegExp,
    SpreadsheetApp: { openById: () => ss },
    CacheService: { getScriptCache: () => ({ get: k => cacheStore.get(k) ?? null, put: (k, v) => cacheStore.set(k, v), remove: k => cacheStore.delete(k) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props.get(k) ?? null, setProperty: (k, v) => props.set(k, v) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ text: t, setMimeType() { return this; }, getContent() { return t; } }) },
    Logger: { log: (...a) => (sandbox.__logs.push(a.join(' '))) }, __logs: [],
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, text) => Array.from(crypto.createHash('sha256').update(text, 'utf8').digest()).map(b => b > 127 ? b - 256 : b),
      computeHmacSha256Signature: (v, k) => Array.from(crypto.createHmac('sha256', k).update(v).digest()).map(b => b > 127 ? b - 256 : b),
      base64EncodeWebSafe: (v) => (Array.isArray(v) ? Buffer.from(v.map(b => b & 255)) : Buffer.from(v, 'utf8')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      base64DecodeWebSafe: s => Array.from(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')),
      newBlob: bytes => ({ getDataAsString: () => Buffer.from(bytes.map(b => b & 255)).toString('utf8') }),
      getUuid: () => crypto.randomUUID(),
      formatDate: (d, tz, fmt) => { const t = new Date(d.getTime() + 8 * 3600e3); const p = n => String(n).padStart(2, '0'); return fmt.replace('yyyy', t.getUTCFullYear()).replace('MM', p(t.getUTCMonth() + 1)).replace('dd', p(t.getUTCDate())).replace('HH', p(t.getUTCHours())).replace('mm', p(t.getUTCMinutes())).replace('ss', p(t.getUTCSeconds())); },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8'), sandbox);
  const call = (fn, arg) => JSON.parse(sandbox[fn](arg).getContent());
  return {
    ss, sandbox, sheets,
    post: body => call('doPost', { postData: { contents: JSON.stringify(body) } }),
    get: params => call('doGet', { parameter: params }),
  };
}
module.exports = { makeEnv };
