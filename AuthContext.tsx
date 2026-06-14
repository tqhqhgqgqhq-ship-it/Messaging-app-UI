import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  AuthUser, onAuthChange, signUp, signIn, logout,
  verifyRecoveryToken, resetPasswordWithRecoveryToken, regenerateRecoveryToken,
} from "../lib/turso";

type AuthCtx = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string, remember: boolean) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  verifyRecoveryToken: (email: string, token: string) => Promise<{ uid: string }>;
  resetPasswordWithRecoveryToken: (email: string, token: string, newPassword: string) => Promise<{ uid: string; newRecoveryToken: string }>;
  regenerateRecoveryToken: (currentPassword?: string) => Promise<string>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthChange((u: AuthUser | null) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <Ctx.Provider value={{
      user,
      loading,
      signIn: useCallback((email, password, remember) => signIn(email, password, remember).then(() => {}), []),
      signUp: useCallback((name, email, password) => signUp(name, email, password), []),
      signOut: useCallback(() => logout(), []),
      verifyRecoveryToken: useCallback((email, token) => verifyRecoveryToken(email, token), []),
      resetPasswordWithRecoveryToken: useCallback((email, token, password) => resetPasswordWithRecoveryToken(email, token, password), []),
      regenerateRecoveryToken: useCallback((password) => regenerateRecoveryToken(password), []),
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside provider");
  return c;
};
