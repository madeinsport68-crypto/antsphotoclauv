import "./globals.css";

export const metadata = {
  title: "PHOTOANTS : photos d'identité conformes",
  description: "Photos d'identité conformes ANTS, planche 10 × 15 cm prête à imprimer.",
  robots: { index: false, follow: false },
};

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#14213D" };

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className="bg-slate-300 text-ink antialiased">
        {/* Conteneur portrait centré : en-tête, contenu défilant, mention légale toujours visible */}
        <div className="mx-auto flex h-dvh w-full max-w-[520px] flex-col overflow-hidden bg-paper shadow-2xl">
          <header className="flex h-14 shrink-0 items-center justify-between bg-ink px-4 text-white">
            <span className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight">
              <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
                <rect width="32" height="32" rx="8" fill="#F2F2F2" />
                <circle cx="16" cy="13" r="5.5" fill="#14213D" />
                <path d="M5 30c1-8 6-11 11-11s10 3 11 11z" fill="#14213D" />
              </svg>
              PHOTOANTS
            </span>
            <span className="text-sm text-white/70">Photos d'identité</span>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
          <footer className="flex h-14 shrink-0 items-center justify-center border-t border-slate-300 bg-white px-4 text-center text-xs leading-snug text-slate-600">
            PHOTOANTS vous aide à être conforme, mais la validation finale reste à l'administration.
          </footer>
        </div>
      </body>
    </html>
  );
}
