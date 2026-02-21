import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth as useClerkAuth } from "@clerk/clerk-expo";
import * as SecureStore from "expo-secure-store";

const NATIVE_TOKEN_KEY = "smallgroup_native_auth_token";

type AuthContextType = {
  isSignedIn: boolean;
  loading: boolean;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Set token from WebView auth flow (native only). */
  setNativeToken: (token: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, getToken, signOut } = useClerkAuth();
  const [nativeToken, setNativeTokenState] = useState<string | null>(null);
  const [nativeTokenLoaded, setNativeTokenLoaded] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(NATIVE_TOKEN_KEY).then((stored) => {
      setNativeTokenState(stored);
      setNativeTokenLoaded(true);
    });
  }, []);

  const setNativeToken = useCallback(async (token: string) => {
    await SecureStore.setItemAsync(NATIVE_TOKEN_KEY, token);
    setNativeTokenState(token);
  }, []);

  const clearNativeToken = useCallback(async () => {
    await SecureStore.deleteItemAsync(NATIVE_TOKEN_KEY);
    setNativeTokenState(null);
  }, []);

  const effectiveSignedIn = !!isSignedIn || !!nativeToken;
  const loading = !isLoaded || !nativeTokenLoaded;

  const getTokenFn = useCallback(async (): Promise<string | null> => {
    if (nativeToken) return nativeToken;
    return getToken();
  }, [nativeToken, getToken]);

  const signOutFn = useCallback(async () => {
    await clearNativeToken();
    await signOut();
  }, [clearNativeToken, signOut]);

  return (
    <AuthContext.Provider
      value={{
        isSignedIn: effectiveSignedIn,
        loading,
        getToken: getTokenFn,
        signOut: signOutFn,
        setNativeToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
