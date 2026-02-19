import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSSO, useSignIn, useSignUp } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import { nature } from "./theme";

WebBrowser.maybeCompleteAuthSession();

type OAuthStrategy = "oauth_google" | "oauth_github";

function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (
    typeof err === "object" &&
    err &&
    "message" in err &&
    typeof (err as { message?: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  return "Something went wrong. Please try again.";
}

export function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthStrategy | null>(null);
  const { startSSOFlow } = useSSO();
  const { isLoaded: signInLoaded, signIn, setActive: setSignInActive } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setSignUpActive } = useSignUp();
  const ready = signInLoaded && signUpLoaded;
  const busy = loading || oauthLoading !== null;

  const onOAuthSignIn = async (strategy: OAuthStrategy) => {
    if (!ready) return;
    setOauthLoading(strategy);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({ strategy });
      if (!createdSessionId || !setActive) return;
      await setActive({ session: createdSessionId });
    } catch (err: unknown) {
      Alert.alert("Sign in failed", getErrorMessage(err));
    } finally {
      setOauthLoading(null);
    }
  };

  const onSignIn = async () => {
    if (!ready || !signIn || !setSignInActive || !email.trim() || !password || busy) return;
    setLoading(true);
    try {
      const result = await signIn.create({
        identifier: email.trim(),
        password,
      });
      if (result.status !== "complete" || !result.createdSessionId) {
        throw new Error("Additional sign-in steps are required in Clerk.");
      }
      await setSignInActive({ session: result.createdSessionId });
    } catch (err: unknown) {
      Alert.alert("Error", getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const onSignUp = async () => {
    if (!ready || !signUp || !email.trim() || !password || busy) return;
    setLoading(true);
    try {
      await signUp.create({
        emailAddress: email.trim(),
        password,
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
      Alert.alert("Check your email", "Enter the verification code to finish creating your account.");
    } catch (err: unknown) {
      Alert.alert("Error", getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const onVerifyEmail = async () => {
    if (!ready || !signUp || !setSignUpActive || !code.trim() || busy) return;
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      });
      if (result.status !== "complete" || !result.createdSessionId) {
        throw new Error("Email verification is incomplete.");
      }
      await setSignUpActive({ session: result.createdSessionId });
    } catch (err: unknown) {
      Alert.alert("Error", getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (pendingVerification) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.container}
        >
          <View style={styles.sheet}>
            <Text style={styles.title}>Verify your email</Text>
            <Text style={styles.subtitle}>
              Enter the code we emailed you.
            </Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder="Verification code"
              placeholderTextColor={nature.mutedForeground}
              keyboardType="number-pad"
            />
            <Pressable
              style={({ pressed }) => [
                styles.button,
                (!code.trim() || busy || !ready) && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
              onPress={onVerifyEmail}
              disabled={!code.trim() || busy || !ready}
            >
              {busy ? (
                <ActivityIndicator color={nature.primaryForeground} />
              ) : (
                <Text style={styles.buttonText}>Verify</Text>
              )}
            </Pressable>
            <Pressable
              style={styles.link}
              onPress={() => {
                setPendingVerification(false);
                setCode("");
              }}
              disabled={busy}
            >
              <Text style={styles.linkText}>Back</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>
            {mode === "signin" ? "Sign in" : "Sign up"}
          </Text>
          <Text style={styles.subtitle}>
            Welcome to your small group app.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.oauthButton,
              (!ready || busy) && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => onOAuthSignIn("oauth_google")}
            disabled={!ready || busy}
          >
            {oauthLoading === "oauth_google" ? (
              <ActivityIndicator color={nature.foreground} />
            ) : (
              <Text style={styles.oauthButtonText}>Continue with Google</Text>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.oauthButton,
              (!ready || busy) && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => onOAuthSignIn("oauth_github")}
            disabled={!ready || busy}
          >
            {oauthLoading === "oauth_github" ? (
              <ActivityIndicator color={nature.foreground} />
            ) : (
              <Text style={styles.oauthButtonText}>Continue with GitHub</Text>
            )}
          </Pressable>

          <View style={styles.dividerWrap}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or use email</Text>
            <View style={styles.dividerLine} />
          </View>

          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={nature.mutedForeground}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={nature.mutedForeground}
            secureTextEntry
          />
          <Pressable
            style={({ pressed }) => [
              styles.button,
              (!email || !password || busy || !ready) && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={mode === "signin" ? onSignIn : onSignUp}
            disabled={!email || !password || busy || !ready}
          >
            {loading ? (
              <ActivityIndicator color={nature.primaryForeground} />
            ) : (
              <Text style={styles.buttonText}>
                {mode === "signin" ? "Sign in" : "Sign up"}
              </Text>
            )}
          </Pressable>
          <Pressable
            style={styles.link}
            onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            <Text style={styles.linkText}>
              {mode === "signin"
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: nature.iosGroupedBackground },
  container: {
    flex: 1,
    padding: 18,
    justifyContent: "center",
    backgroundColor: nature.iosGroupedBackground,
  },
  sheet: {
    backgroundColor: nature.iosSurface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: nature.iosSeparator,
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  title: {
    fontSize: 34,
    fontWeight: "700",
    marginBottom: 4,
    color: nature.foreground,
  },
  subtitle: {
    fontSize: 15,
    color: nature.mutedForeground,
    marginBottom: 18,
  },
  oauthButton: {
    borderWidth: 1,
    borderColor: nature.iosSeparator,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: nature.iosSurface,
    marginBottom: 10,
  },
  oauthButtonText: {
    color: nature.foreground,
    fontSize: 16,
    fontWeight: "600",
  },
  dividerWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: nature.border },
  dividerText: { color: nature.mutedForeground, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: nature.iosSeparator,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: nature.secondary,
    color: nature.foreground,
  },
  button: {
    backgroundColor: nature.primary,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },
  buttonPressed: { opacity: 0.8 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: nature.primaryForeground, fontWeight: "600", fontSize: 16 },
  link: { marginTop: 20, alignItems: "center" },
  linkText: { color: nature.link, fontSize: 14 },
});
