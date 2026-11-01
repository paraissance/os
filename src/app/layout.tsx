import type { Metadata, Viewport } from "next";
import { Archivo, Cookie, IBM_Plex_Mono } from "next/font/google";
import { SHELL_SCRIPT } from "@/components/shell/shell-state";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

/** Only for the JodyOS name. */
const cookie = Cookie({
  variable: "--font-cookie",
  subsets: ["latin"],
  weight: "400",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: { default: "JodyOS", template: "%s · JodyOS" },
  description: "Private AI operating system.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0b" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The head script may add data-nav and data-theme before React hydrates.
    <html lang="en" className={`${archivo.variable} ${plexMono.variable} ${cookie.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SHELL_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
