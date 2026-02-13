import "./globals.css";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import AuthGate from "@/components/AuthGate";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Powston Hacker",
  description: "Rules template studio for Powston scripts."
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-slate-950`}>
        <div className="flex min-h-screen flex-col">
          <header className="flex h-12 items-center justify-between border-b border-slate-900 bg-slate-950/90 px-4 text-sm text-slate-200 backdrop-blur">
            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Powston Hacker
              </span>
              <nav className="flex items-center gap-3 text-xs text-slate-400">
                <a className="hover:text-white" href="/">
                  Studio
                </a>
                <a className="hover:text-white" href="/tests">
                  Tests
                </a>
                <a className="hover:text-white" href="/library">
                  Library
                </a>
              </nav>
            </div>
          </header>
          <div className="flex min-h-0 flex-1 flex-col">
            <AuthGate>{children}</AuthGate>
          </div>
        </div>
      </body>
    </html>
  );
}
