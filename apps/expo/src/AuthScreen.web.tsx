/**
 * Expo Web auth screen using Clerk prebuilt SignIn/SignUp.
 * Native (iOS/Android) uses AuthScreen.tsx.
 */
import React from "react";
import { View, StyleSheet, Image } from "react-native";
import { SignIn, SignUp } from "@clerk/clerk-expo/web";

function getMode(): "signin" | "signup" {
  if (typeof window === "undefined") return "signin";
  const mode = new URLSearchParams(window.location.search).get("mode");
  return mode === "signup" ? "signup" : "signin";
}

export function AuthScreen() {
  const mode = getMode();

  return (
    <View style={styles.container}>
      <View style={styles.logoWrap}>
        <Image
          source={require("../../../sglogo.png")}
          style={{ width: 52, height: 52 }}
          resizeMode="contain"
        />
      </View>

      {mode === "signup" ? (
        <SignUp path="/" routing="path" signInUrl="/" />
      ) : (
        <SignIn path="/" routing="path" signUpUrl="/?mode=signup" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100%",
    padding: 16,
    backgroundColor: "rgba(240, 233, 224, 0.5)",
  },
  logoWrap: {
    marginBottom: 24,
  },
});
