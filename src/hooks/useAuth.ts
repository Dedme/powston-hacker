"use client";

import { useState, useEffect } from "react";

type AuthState = {
  status: "loading" | "unauthenticated" | "authenticated";
  signIn: (apiKey: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  error: string | null;
};

export function useAuth(): AuthState {
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if we have a session cookie by hitting a lightweight endpoint
    fetch("/api/auth")
      .then((r) => r.json())
      .then((data) => {
        setStatus(data.authenticated ? "authenticated" : "unauthenticated");
      })
      .catch(() => setStatus("unauthenticated"));
  }, []);

  const signIn = async (apiKey: string): Promise<boolean> => {
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json();
      if (data.authenticated) {
        setStatus("authenticated");
        return true;
      }
      setError(data.error || "Authentication failed");
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      return false;
    }
  };

  const signOut = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setStatus("unauthenticated");
  };

  return { status, signIn, signOut, error };
}
