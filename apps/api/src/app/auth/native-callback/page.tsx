"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (msg: string) => void };
  }
}

export default function NativeCallbackPage() {
  const { getToken, isLoaded } = useAuth();
  const [status, setStatus] = useState<"sending" | "done" | "error">("sending");

  useEffect(() => {
    if (!isLoaded || !getToken) return;
    const run = async () => {
      try {
        const token = await getToken();
        if (token && typeof window !== "undefined" && window.ReactNativeWebView?.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: "auth", token }));
          setStatus("done");
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    };
    void run();
  }, [isLoaded, getToken]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-muted/30">
      <div className="flex justify-center mb-6">
        <img src="/sglogo.png" alt="Small Group" width={52} height={52} />
      </div>
      <div className="text-center text-muted-foreground">
        {status === "sending" && <p>Signing you in…</p>}
        {status === "done" && <p>Sign-in successful. You can close this window.</p>}
        {status === "error" && <p>Something went wrong. Please try again from the app.</p>}
      </div>
    </div>
  );
}
