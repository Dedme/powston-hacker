"use client";

import { useState } from "react";

type Props = {
  onSignIn: (apiKey: string) => Promise<boolean>;
  error: string | null;
};

const POWSTON_URL = "https://app.powston.com";

export default function SignIn({ onSignIn, error }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setIsSubmitting(true);
    await onSignIn(apiKey.trim());
    setIsSubmitting(false);
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl">
        <div className="text-center">
          <h1 className="text-xl font-bold text-white">
            Sign in to Powston Hacker
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Connect your Powston account to get started.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="apiKey"
              className="block text-xs font-medium text-slate-300"
            >
              Powston API Key
            </label>
            <input
              id="apiKey"
              type="password"
              className="mt-1 h-10 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-100 focus:border-cobalt focus:outline-none focus:ring-1 focus:ring-cobalt"
              placeholder="Paste your API key..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoFocus
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-800/50 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !apiKey.trim()}
            className="h-10 w-full rounded-lg bg-cobalt font-semibold text-white shadow-lg shadow-cobalt/20 hover:bg-cobalt/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-6 border-t border-slate-800 pt-4">
          <button
            type="button"
            className="w-full text-center text-xs text-slate-400 hover:text-slate-200"
            onClick={() => setShowHelp(!showHelp)}
          >
            {showHelp ? "Hide instructions" : "How do I get my API key?"}
          </button>

          {showHelp && (
            <div className="mt-3 space-y-3 text-xs text-slate-400">
              <ol className="list-inside list-decimal space-y-2">
                <li>
                  <a
                    href={POWSTON_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cobalt underline hover:text-cobalt/80"
                  >
                    Open Powston app
                  </a>{" "}
                  and sign in to your account
                </li>
                <li>
                  Go to{" "}
                  <a
                    href={`${POWSTON_URL}/api/user_api_key`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cobalt underline hover:text-cobalt/80"
                  >
                    {POWSTON_URL}/api/user_api_key
                  </a>
                </li>
                <li>Copy the API key shown on that page</li>
                <li>Paste it above and click Sign In</li>
              </ol>

              <div className="flex gap-2">
                <a
                  href={`${POWSTON_URL}/api/user_api_key`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-lg border border-slate-700 py-2 text-center text-xs text-slate-300 hover:border-slate-500 hover:text-white"
                >
                  Open API Key Page →
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
