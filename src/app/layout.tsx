import type { Metadata, Viewport } from "next";
import { Archivo, Cookie, IBM_Plex_Mono } from "next/font/google";
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
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${plexMono.variable} ${cookie.variable}`}>
      <body>{children}</body>
    </html>
  );
}
