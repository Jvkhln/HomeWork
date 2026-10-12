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
  logout: () => void;
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

  useEffect(() => {
    // Check local storage for session
    const storedUser = localStorage.getItem('auth_user');
    const storedToken = localStorage.getItem('auth_token');
    if (storedUser && storedToken) {
      try {
        setCurrentUser(JSON.parse(storedUser));
        setToken(storedToken);
      } catch {
        localStorage.removeItem('auth_user');
        localStorage.removeItem('auth_token');
      }
    }
    const settings = dataService.getSettings();
    setIsDemoMode(settings.mode === 'DEMO');
  }, []);

  const showToast = (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const login = async (username: string, password: string) => {
    const res = await dataService.login(username, password);
    if (res.success && res.user && res.token) {
      setCurrentUser(res.user);
      setToken(res.token);
      localStorage.setItem('auth_user', JSON.stringify(res.user));
      localStorage.setItem('auth_token', res.token);
      showToast('success', 'Амжилттай нэвтэрлээ', `Тавтай морилно уу, ${res.user.displayName}`);
      return { success: true };
    }
    showToast('error', 'Нэвтрэхэд алдаа гарлаа', res.error || 'Нэвтрэх нэр эсвэл нууц үг буруу.');
    return { success: false, error: res.error };
  };

  const logout = () => {
    setCurrentUser(null);
    setToken(null);
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
    showToast('info', 'Системээс гарлаа');
  };

  const switchRoleQuick = (role: 'TEACHER' | 'LEADER' | 'STUDENT') => {
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
