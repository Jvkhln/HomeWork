import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { dataService } from '../services/dataService';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
}

interface AuthContextType {
  currentUser: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  forceLogout: (message?: string) => void;
  /** Sheet-ээс өгөгдөл шинэчлэгдэх бүрт нэмэгдэнэ (UI дахин зурахад) */
  dataVersion: number;
  switchRoleQuick: (role: 'TEACHER' | 'LEADER' | 'STUDENT') => void;
  toasts: ToastMessage[];
  showToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void;
  dismissToast: (id: string) => void;
  isDemoMode: boolean;
  refreshUserData: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);
  const [dataVersion, setDataVersion] = useState(0);

  const showToast = (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const clearSession = () => {
    setCurrentUser(null);
    setToken(null);
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
  };

  // Хүчээр гаргах (токен дууссан, Sheet холболт солигдсон гэх мэт)
  const forceLogout = (message?: string) => {
    clearSession();
    void dataService.endSession().then(() => dataService.loadPublic());
    if (message) showToast('warning', 'Дахин нэвтэрнэ үү', message);
  };

  useEffect(() => {
    // Хадгалсан session сэргээх
    const storedUser = localStorage.getItem('auth_user');
    const storedToken = localStorage.getItem('auth_token');
    let restored = false;
    if (storedUser && storedToken) {
      try {
        setCurrentUser(JSON.parse(storedUser));
        setToken(storedToken);
        restored = true;
      } catch {
        localStorage.removeItem('auth_user');
        localStorage.removeItem('auth_token');
      }
    }
    const settings = dataService.getSettings();
    setIsDemoMode(settings.mode === 'DEMO');

    dataService.setAuthErrorHandler(msg => {
      clearSession();
      void dataService.endSession().then(() => dataService.loadPublic());
      showToast('warning', 'Дахин нэвтэрнэ үү', msg);
    });
    const unsub = dataService.subscribe(() => setDataVersion(v => v + 1));

    if (dataService.isSheetsMode()) {
      if (restored) {
        dataService.startSession(false).catch(err => {
          showToast('warning', 'Google Sheet-тэй холбогдож чадсангүй', (err instanceof Error ? err.message : String(err)) + ' Автоматаар дахин оролдоно.');
        });
      } else {
        void dataService.loadPublic();
      }
    }
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const login = async (username: string, password: string) => {
    const res = await dataService.login(username, password);
    if (res.success && res.user && res.token) {
      // Session-ийг ЭХЭЛЖ хадгална: sync нь token, эрхийг эндээс уншина
      localStorage.setItem('auth_user', JSON.stringify(res.user));
      localStorage.setItem('auth_token', res.token);
      setCurrentUser(res.user);
      setToken(res.token);
      showToast('success', 'Амжилттай нэвтэрлээ', `Тавтай морилно уу, ${res.user.displayName}`);
      if (dataService.isSheetsMode()) {
        try {
          await dataService.startSession(true, res.user.userId);
        } catch (err) {
          showToast('warning', 'Өгөгдөл татаж чадсангүй', (err instanceof Error ? err.message : String(err)) + ' Автоматаар дахин оролдоно.');
        }
      }
      return { success: true };
    }
    showToast('error', 'Нэвтрэхэд алдаа гарлаа', res.error || 'Нэвтрэх нэр эсвэл нууц үг буруу.');
    return { success: false, error: res.error };
  };

  const logout = async () => {
    if (dataService.isSheetsMode()) {
      // Хадгалагдаагүй өөрчлөлтийг гарахаас өмнө илгээнэ
      await dataService.syncNow().catch(() => undefined);
      if (dataService.hasPendingChanges()) {
        const ok = window.confirm(
          'Google Sheet-д хадгалагдаагүй өөрчлөлт байна (сүлжээ тасарсан байж болзошгүй). Гарвал эдгээр өөрчлөлт Sheet-д орохгүй байж болно. Ямартай ч гарах уу?'
        );
        if (!ok) return;
      }
    }
    clearSession();
    await dataService.endSession();
    showToast('info', 'Системээс гарлаа');
    void dataService.loadPublic();
  };

  const switchRoleQuick = (role: 'TEACHER' | 'LEADER' | 'STUDENT') => {
    if (dataService.isSheetsMode()) {
      showToast('error', 'Демо горим идэвхгүй', 'Google Sheets горимд зөвхөн Sheet-д бүртгэлтэй нэр, нууц үгээр нэвтэрнэ.');
      return;
    }
    const users = dataService.getUsers();
    let target = users.find(u => u.role === role);
    if (!target) {
      if (role === 'TEACHER') target = users[0];
      if (role === 'LEADER') target = users[1];
      if (role === 'STUDENT') target = users[2];
    }
    if (target) {
      setCurrentUser(target);
      const t = 'demo_token_' + target.userId;
      setToken(t);
      localStorage.setItem('auth_user', JSON.stringify(target));
      localStorage.setItem('auth_token', t);
      showToast('success', `${target.role === 'TEACHER' ? 'Багш' : target.role === 'LEADER' ? 'Хэсгийн ахлагч' : 'Сурагч'} горим руу шилжлээ`, target.displayName);
    }
  };

  const refreshUserData = () => {
    const settings = dataService.getSettings();
    setIsDemoMode(settings.mode === 'DEMO');
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        token,
        login,
        logout,
        forceLogout,
        dataVersion,
        switchRoleQuick,
        toasts,
        showToast,
        dismissToast,
        isDemoMode,
        refreshUserData
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
