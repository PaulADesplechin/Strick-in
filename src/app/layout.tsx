import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Strick'in — Documentation",
  description: "Portail documentaire interne Strick'in — Produits structurés",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-grey-border">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet rounded-xl flex items-center justify-center">
                <span className="text-white font-display font-bold text-lg">S</span>
              </div>
              <div>
                <h1 className="font-display font-bold text-xl text-violet">Strick&apos;in</h1>
                <p className="text-xs text-gray-500">Documentation interne</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="badge bg-violet-light text-violet">179 documents</span>
              <span className="badge bg-green-100 text-green-700">9 catégories</span>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
        {/* Footer */}
        <footer className="border-t border-grey-border py-6 text-center text-sm text-gray-400">
          Strick&apos;in — Portail documentaire interne — Mars 2026
        </footer>
      </body>
    </html>
  );
}
