import { create } from 'zustand';

interface User {
  id: string;
  username: string;
  email: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  isAuthenticated: false,
  user: null,
  token: null,
  login: (user, token) => {
    console.log('Zustand login 호출:', { user, token });
    set({ isAuthenticated: true, user, token });
    console.log('Zustand 상태 업데이트 완료');
    
    // 수동으로 localStorage에 저장 (persist 형식과 호환)
    localStorage.setItem('auth-storage', JSON.stringify({
      state: {
        isAuthenticated: true,
        user,
        token,
      },
      version: 0,
    }));
    console.log('수동 localStorage 저장 완료');
  },
  logout: () => {
    console.log('Zustand logout 호출');
    set({ isAuthenticated: false, user: null, token: null });
    localStorage.removeItem('auth-storage');
  },
}));

