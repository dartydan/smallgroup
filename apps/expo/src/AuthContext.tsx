import React, { createContext, useContext } from "react";
import { useAuth as useClerkAuth } from "@clerk/clerk-expo";

type AuthContextType = {
  isSignedIn: boolean;
  loading: boolean;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, getToken, signOut } = useClerkAuth();

  return (
    <AuthContext.Provider
      value={{
        isSignedIn: !!isSignedIn,
        loading: !isLoaded,
        getToken: () => getToken(),
        signOut: () => signOut(),
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
