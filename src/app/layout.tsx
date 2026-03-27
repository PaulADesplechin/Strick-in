import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Strick'in \u2014 Documentation",
  description: "Portail documentaire interne pour produits structur\u00E9s",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-background text-foreground min-h-screen">
        {/* Header */}
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
              <Link
                href="/resume"
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-violet/10 text-violet hover:bg-violet/20 transition-all"
              >
                \u{1F4CA} R\u00E9sum\u00E9
              </Link>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>

        {/* Footer */}
        <footer className="border-t border-grey-border py-6 text-center text-sm text-gray-400">
          Strick&apos;in \u2014 Portail documentaire interne \u2014 Mars 2026
        </footer>
      </body>
    </html>
  );
}
