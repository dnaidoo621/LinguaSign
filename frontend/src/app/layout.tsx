import type { Metadata } from "next";
import "./globals.css";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "LinguaSign — understand every clause before you sign",
  description:
    "AI-assisted multilingual document comprehension: clause-linked translation, plain-language risk, and signing with a full audit trail.",
};

// Set theme/density before paint to avoid a flash of the wrong theme.
const themeInit = `(function(){try{var t=localStorage.getItem('linguasign.theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;document.documentElement.dataset.density=localStorage.getItem('linguasign.density')||'comfortable';}catch(e){document.documentElement.dataset.theme='light';document.documentElement.dataset.density='comfortable';}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;500;600&family=Noto+Serif+SC:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <div className="app">
          <TopBar />
          {children}
          <Footer />
        </div>
      </body>
    </html>
  );
}
