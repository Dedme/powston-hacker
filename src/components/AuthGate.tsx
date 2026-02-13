"use client";

import { useAuth } from "@/hooks/useAuth";
import SignIn from "@/components/SignIn";
import type { ReactNode } from "react";

export default function AuthGate({ children }: { children: ReactNode }) {
  const { status, signIn, signOut, error } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-sm text-slate-400">Loading...</div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <SignIn onSignIn={signIn} error={error} />;
  }

  return (
    <>
      {/* Sign out button injected into header area via portal or prop */}
      <div className="fixed right-4 top-2.5 z-50">
        <button
          type="button"
          className="rounded-md border border-slate-700 px-2.5 py-1 text-[10px] text-slate-400 hover:border-slate-500 hover:text-slate-200"
          onClick={signOut}
        >
          Sign out
        </button>
      </div>
      {children}
    </>
  );
}
