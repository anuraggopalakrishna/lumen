import NetInfo from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import type { LoginInput, RegisterInput, SessionTokens } from '@lumen/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as authApi from '../services/api/auth';
import { setTokenProvider } from '../services/api/client';
import { listPendingMutations } from '../services/storage/db';
import * as secure from '../services/storage/secure';
import { flushQueue } from '../services/storage/syncQueue';
import type { AuthStatus, SessionUser } from '../types';

type AppContextValue = {
  status: AuthStatus;
  user: SessionUser | null;
  pendingCount: number;
  lastSyncError: string | null;
  syncNow: () => Promise<void>;
  signIn: (input: LoginInput) => Promise<void>;
  signUp: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
  continueOffline: () => Promise<void>;
  refreshPending: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  const accessTokenRef = useRef<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);
  const statusRef = useRef<AuthStatus>('loading');

  const refreshPending = useCallback(async () => {
    const pending = await listPendingMutations();
    setPendingCount(pending.length);
  }, []);

  const syncNow = useCallback(async () => {
    if (statusRef.current !== 'signedIn') {
      await refreshPending();
      return;
    }
    const outcome = await flushQueue();
    setPendingCount(outcome.remaining);
    setLastSyncError(
      outcome.lastError && outcome.lastError !== 'offline'
        ? outcome.lastError
        : null,
    );
    if (outcome.synced > 0) {
      await queryClient.invalidateQueries();
    }
  }, [queryClient, refreshPending]);

  const applySession = useCallback(
    async (tokens: SessionTokens, nextUser: SessionUser) => {
      accessTokenRef.current = tokens.accessToken;
      refreshTokenRef.current = tokens.refreshToken;
      await secure.saveSession(tokens, nextUser);
      setUser(nextUser);
      statusRef.current = 'signedIn';
      setStatus('signedIn');
    },
    [],
  );

  // Register the API token provider once.
  useEffect(() => {
    setTokenProvider({
      getAccessToken: async () => accessTokenRef.current,
      refreshAccessToken: async () => {
        const token = refreshTokenRef.current;
        if (!token) return null;
        try {
          const { tokens } = await authApi.refresh(token);
          accessTokenRef.current = tokens.accessToken;
          refreshTokenRef.current = tokens.refreshToken;
          await secure.updateTokens(tokens);
          return tokens.accessToken;
        } catch {
          return null;
        }
      },
    });
    return () => setTokenProvider(null);
  }, []);

  // Bootstrap session from secure storage.
  useEffect(() => {
    void (async () => {
      try {
        const session = await secure.loadSession();
        if (session) {
          accessTokenRef.current = session.accessToken;
          refreshTokenRef.current = session.refreshToken;
          setUser(session.user);
          statusRef.current = 'signedIn';
          setStatus('signedIn');
          try {
            const { user: fresh } = await authApi.me();
            setUser(fresh);
          } catch {
            // Keep the cached user; the token provider will try to refresh.
          }
        } else if (await secure.isLocalOnly()) {
          statusRef.current = 'localOnly';
          setStatus('localOnly');
        } else {
          statusRef.current = 'signedOut';
          setStatus('signedOut');
        }
      } catch {
        statusRef.current = 'signedOut';
        setStatus('signedOut');
      }
      await refreshPending();
    })();
  }, [refreshPending]);

  // Auto-sync when connectivity returns.
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && statusRef.current === 'signedIn') {
        void syncNow();
      }
    });
    return () => unsubscribe();
  }, [syncNow]);

  const signIn = useCallback(
    async (input: LoginInput) => {
      const result = await authApi.login(input);
      await applySession(result.tokens, result.user);
      await syncNow();
    },
    [applySession, syncNow],
  );

  const signUp = useCallback(
    async (input: RegisterInput) => {
      const result = await authApi.register(input);
      await applySession(result.tokens, result.user);
      await syncNow();
    },
    [applySession, syncNow],
  );

  const signOut = useCallback(async () => {
    const token = refreshTokenRef.current;
    if (token) {
      try {
        await authApi.logout(token);
      } catch {
        // Best effort.
      }
    }
    accessTokenRef.current = null;
    refreshTokenRef.current = null;
    await secure.clearSession();
    await secure.setLocalOnly(false);
    setUser(null);
    statusRef.current = 'signedOut';
    setStatus('signedOut');
    queryClient.clear();
  }, [queryClient]);

  const continueOffline = useCallback(async () => {
    await secure.setLocalOnly(true);
    statusRef.current = 'localOnly';
    setStatus('localOnly');
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      status,
      user,
      pendingCount,
      lastSyncError,
      syncNow,
      signIn,
      signUp,
      signOut,
      continueOffline,
      refreshPending,
    }),
    [
      status,
      user,
      pendingCount,
      lastSyncError,
      syncNow,
      signIn,
      signUp,
      signOut,
      continueOffline,
      refreshPending,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
}
