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
import { supabase } from "./supabase";
import { nature } from "./theme";

export function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSignIn = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
    } catch (err: unknown) {
      Alert.alert("Error", (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const onSignUp = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) throw error;
      Alert.alert("Check your email", "Sign up successful. Sign in with your email and password.");
      setMode("signin");
    } catch (err: unknown) {
      Alert.alert("Error", (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

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
          (!email || !password) && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}
        onPress={mode === "signin" ? onSignIn : onSignUp}
        disabled={!email || !password || loading}
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
