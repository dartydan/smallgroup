import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { useSSO, useSignIn, useSignUp } from "@clerk/clerk-expo";
import * as WebBrowser from "expo-web-browser";
import { nature } from "./theme";

WebBrowser.maybeCompleteAuthSession();

type OAuthStrategy = "oauth_google" | "oauth_github";
type AuthStep = "email" | "password" | "verify";

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
  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthStrategy | null>(null);

  const { startSSOFlow } = useSSO();
  const { isLoaded: signInLoaded, signIn, setActive: setSignInActive } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setSignUpActive } = useSignUp();

  const ready = signInLoaded && signUpLoaded;
  const busy = loading || oauthLoading !== null;

  const resetToEmailStep = (nextMode?: "signin" | "signup") => {
    if (nextMode) setMode(nextMode);
    setStep("email");
    setPassword("");
    setCode("");
  };

  const onOAuthSignIn = async (strategy: OAuthStrategy) => {
    if (!ready || busy) return;
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
      setStep("verify");
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

  const onContinue = async () => {
    if (!email.trim() || busy || !ready) return;

    if (step === "email") {
      setStep("password");
      return;
    }

    if (step === "password") {
      if (mode === "signin") await onSignIn();
      else await onSignUp();
      return;
    }

    await onVerifyEmail();
  };

  const heading =
    step === "verify"
      ? "Verify your email"
      : mode === "signin"
        ? "Sign in to Small Group"
        : "Create your account";

  const subheading =
    step === "verify"
      ? "Enter the verification code from your email"
      : mode === "signin"
        ? "Welcome back! Please sign in to continue"
        : "Set up your account to continue";

  const primaryButtonLabel =
    step === "verify"
      ? loading
        ? "Verifying..."
        : "Verify"
      : step === "email"
        ? "Continue"
        : loading
          ? mode === "signin"
            ? "Signing in..."
            : "Creating account..."
          : mode === "signin"
            ? "Sign in"
            : "Sign up";

  const showOAuth = step === "email" && mode === "signin";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <View style={styles.panel}>
          <View style={styles.contentArea}>
            <Image
              source={require("../../../sglogo.png")}
              style={styles.logo}
              resizeMode="contain"
            />

            <Text style={styles.title}>{heading}</Text>
            <Text style={styles.subtitle}>{subheading}</Text>

            {showOAuth ? (
              <View style={styles.oauthWrap}>
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
                    <>
                      <FontAwesome name="google" size={24} color="#DB4437" />
                      <Text style={styles.oauthButtonText}>Continue with Google</Text>
                    </>
                  )}

                  <View style={styles.lastUsedPill}>
                    <Text style={styles.lastUsedText}>Last used</Text>
                  </View>
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
                    <>
                      <FontAwesome name="github" size={24} color={nature.foreground} />
                      <Text style={styles.oauthButtonText}>Continue with GitHub</Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : null}

            <View style={styles.dividerWrap}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Text style={styles.label}>
              {step === "verify" ? "Verification code" : "Email address"}
            </Text>

            {step === "verify" ? (
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder="Enter code"
                placeholderTextColor={nature.mutedForeground}
                keyboardType="number-pad"
                editable={!busy}
              />
            ) : (
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email address"
                placeholderTextColor={nature.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!busy && step === "email"}
              />
            )}

            {step === "password" ? (
              <>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={nature.mutedForeground}
                  secureTextEntry
                  editable={!busy}
                />
                <Pressable
                  style={styles.backLink}
                  onPress={() => setStep("email")}
                  disabled={busy}
                >
                  <Text style={styles.backLinkText}>Back to email</Text>
                </Pressable>
              </>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                (
                  !ready ||
                  busy ||
                  (step === "verify" ? !code.trim() : !email.trim()) ||
                  (step === "password" ? !password.trim() : false)
                ) && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
              onPress={onContinue}
              disabled={
                !ready ||
                busy ||
                (step === "verify" ? !code.trim() : !email.trim()) ||
                (step === "password" ? !password.trim() : false)
              }
            >
              <Text style={styles.primaryButtonText}>{primaryButtonLabel}</Text>
              <Text style={styles.primaryButtonArrow}>▸</Text>
            </Pressable>
          </View>

          <View style={styles.sectionDivider} />

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>
              {mode === "signin" ? "Don't have an account?" : "Already have an account?"}
            </Text>
            <Pressable
              onPress={() => resetToEmailStep(mode === "signin" ? "signup" : "signin")}
              disabled={busy}
            >
              <Text style={styles.switchActionText}>
                {mode === "signin" ? "Sign up" : "Sign in"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.sectionDivider} />

          <View style={styles.securedRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color={nature.mutedForeground} />
            <Text style={styles.securedText}>Secured by clerk</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: nature.background,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  panel: {
    width: "100%",
    maxWidth: 430,
    borderRadius: 0,
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  contentArea: {
    paddingHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 14,
  },
  logo: {
    width: 48,
    height: 48,
    alignSelf: "center",
    marginBottom: 14,
  },
  title: {
    textAlign: "center",
    fontSize: 36,
    fontWeight: "700",
    color: nature.foreground,
    marginBottom: 6,
    letterSpacing: 0.35,
  },
  subtitle: {
    textAlign: "center",
    fontSize: 16,
    color: nature.mutedForeground,
    marginBottom: 20,
  },
  oauthWrap: {
    gap: 8,
  },
  oauthButton: {
    minHeight: 54,
    borderRadius: 8,
    backgroundColor: nature.muted,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    position: "relative",
  },
  oauthButtonText: {
    fontSize: 17,
    color: nature.foreground,
    fontWeight: "500",
  },
  lastUsedPill: {
    position: "absolute",
    right: 8,
    top: 8,
    borderRadius: 999,
    backgroundColor: "rgba(58,46,42,0.08)",
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  lastUsedText: {
    fontSize: 11,
    color: nature.mutedForeground,
    fontWeight: "500",
  },
  dividerWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
    marginBottom: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: nature.border,
  },
  dividerText: {
    color: nature.mutedForeground,
    fontSize: 15,
  },
  label: {
    fontSize: 15,
    color: nature.foreground,
    marginBottom: 6,
    fontWeight: "600",
  },
  input: {
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 4,
    height: 44,
    fontSize: 16,
    color: nature.foreground,
    backgroundColor: "transparent",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: nature.input,
  },
  backLink: {
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  backLinkText: {
    color: nature.mutedForeground,
    fontSize: 14,
  },
  primaryButton: {
    marginTop: 10,
    height: 52,
    borderRadius: 6,
    backgroundColor: nature.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  primaryButtonText: {
    color: nature.primaryForeground,
    fontSize: 17,
    fontWeight: "600",
  },
  primaryButtonArrow: {
    color: nature.primaryForeground,
    fontSize: 13,
    marginTop: 0,
    opacity: 0.85,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: nature.border,
    marginTop: 2,
  },
  switchRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  switchText: {
    fontSize: 16,
    color: nature.mutedForeground,
  },
  switchActionText: {
    fontSize: 16,
    color: nature.primary,
    fontWeight: "600",
  },
  securedRow: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  securedText: {
    color: nature.mutedForeground,
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.5 },
});
