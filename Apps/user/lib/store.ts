import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getMe } from '@/api/auth';

interface User {
    userId: string;
    username: string;
    roles: string[];
}

interface AuthState {
    user: User | null;
    token: string | null;
    rememberMe: boolean;
    loginTime: number | null;
    login: (token: string, rememberMe?: boolean) => void;
    logout: () => void;
    fetchMe: () => Promise<void>;
    setRememberMe: (remember: boolean) => void;
    isTokenExpired: () => boolean;
}

const REMEMBER_ME_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            rememberMe: true, // Default to true for better UX
            loginTime: null,
            login: (token, rememberMe = true) => {
                set({
                    token,
                    rememberMe,
                    loginTime: Date.now() // Record login time
                });
                // Fetch user details after login
                get().fetchMe();
            },
            logout: () => {
                set({ user: null, token: null, loginTime: null });
                // Clear storage
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('auth-storage');
                }
            },
            fetchMe: async () => {
                try {
                    const user = await getMe();
                    set({ user });
                } catch (error) {
                    console.error('Failed to fetch user', error);
                    // If 401, the interceptor will handle logout
                }
            },
            setRememberMe: (remember) => set({ rememberMe: remember }),
            isTokenExpired: () => {
                const state = get();
                if (!state.loginTime || !state.rememberMe) return false;

                const now = Date.now();
                const elapsed = now - state.loginTime;
                return elapsed > REMEMBER_ME_DURATION;
            },
        }),
        {
            name: 'auth-storage',
            // Always use localStorage for persistence across browser sessions
        }
    )
);
