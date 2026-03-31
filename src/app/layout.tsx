import type { Metadata } from "next";
import Link from "next/link";
import ChatWidget from "@/components/ChatWidget";
import "./globals.css";

export const metadata: Metadata = {
  title: "Strick'in - Documentation",
  description: "Portail documentaire interne pour produits structures",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-background text-foreground min-h-screen">
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-grey-border">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 rounded-xl bg-violet flex items-center justify-center">
                <span className="text-white font-bold text-lg">S</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-800">Strick&apos;in</h1>
                <p className="text-xs text-gray-400">Documentation interne</p>
              </div>
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/resume" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-violet/10 text-violet hover:bg-violet/20 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
                Resume
              </Link>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
        <footer className="border-t border-grey-border py-6 text-center text-sm text-gray-400">
          Strick&apos;in - Portail documentaire interne - Mars 2026
        </footer>
      <ChatWidget />
      </body>
    </html>
  );
}
