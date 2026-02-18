import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSignIn, useSignUp } from "@clerk/clerk-expo";
import { nature } from "./theme";

export function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const { isLoaded: signInLoaded, signIn, setActive: setSignInActive } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setSignUpActive } = useSignUp();
  const ready = signInLoaded && signUpLoaded;

  const onSignIn = async () => {
    if (!ready || !signIn || !setSignInActive || !email.trim() || !password) return;
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
      Alert.alert("Error", (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const onSignUp = async () => {
    if (!ready || !signUp || !email.trim() || !password) return;
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
      Alert.alert("Error", (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const onVerifyEmail = async () => {
    if (!ready || !signUp || !setSignUpActive || !code.trim()) return;
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
      Alert.alert("Error", (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (pendingVerification) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Verify your email</Text>
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
            (!code.trim() || loading || !ready) && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={onVerifyEmail}
          disabled={!code.trim() || loading || !ready}
        >
          {loading ? (
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
          disabled={loading}
        >
          <Text style={styles.linkText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {mode === "signin" ? "Sign in" : "Sign up"}
      </Text>
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
          (!email || !password || loading || !ready) && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
        onPress={mode === "signin" ? onSignIn : onSignUp}
        disabled={!email || !password || loading || !ready}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: nature.background,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
    color: nature.foreground,
  },
  input: {
    borderWidth: 1,
    borderColor: nature.border,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: nature.card,
    color: nature.foreground,
  },
  button: {
    backgroundColor: nature.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  buttonPressed: { opacity: 0.8 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: nature.primaryForeground, fontWeight: "600", fontSize: 16 },
  link: { marginTop: 20, alignItems: "center" },
  linkText: { color: nature.link, fontSize: 14 },
});
