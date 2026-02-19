import React from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View, ActivityIndicator, Text } from "react-native";
import { ClerkProvider } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { AuthProvider, useAuth } from "./src/AuthContext";
import { HomeScreen } from "./src/HomeScreen";
import { AuthScreen } from "./src/AuthScreen";
import { nature } from "./src/theme";

const clerkPublishableKey =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!clerkPublishableKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY (or NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)."
  );
}

type ErrorBoundaryState = { hasError: boolean; error: Error | null };
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <View style={[styles.container, styles.centered]}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{this.state.error.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { isSignedIn, loading, signOut } = useAuth();
  const [authGateReady, setAuthGateReady] = React.useState(false);
  const authGateInitialized = React.useRef(false);

  React.useEffect(() => {
    if (loading || authGateInitialized.current) return;
    authGateInitialized.current = true;
    const initializeAuthGate = async () => {
      try {
        if (isSignedIn) {
          await signOut();
        }
      } finally {
        setAuthGateReady(true);
      }
    };
    void initializeAuthGate();
  }, [loading, isSignedIn, signOut]);

  if (loading || !authGateReady) {
    return (
        <View style={[styles.container, styles.centered]}>
          <ActivityIndicator size="large" color={nature.primary} />
        </View>
    );
  }
  return (
    <View style={styles.container}>
      {isSignedIn ? <HomeScreen /> : <AuthScreen />}
      <StatusBar style="auto" />
    </View>
  );
}

export default function App() {
  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
      <ErrorBoundary>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ErrorBoundary>
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: nature.iosGroupedBackground,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  errorTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8, color: nature.foreground },
  errorText: { fontSize: 14, color: nature.mutedForeground, textAlign: "center", paddingHorizontal: 24 },
});
