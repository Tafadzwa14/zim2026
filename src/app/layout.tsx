import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Nunito, IBM_Plex_Mono } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display-var",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const body = Nunito({
  variable: "--font-body-var",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono-var",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Zim 2026",
  description: "A private family command centre for the Zimbabwe trip.",
  // Private family app — keep it out of search indexes (spec section 63).
  robots: { index: false, follow: false, nocache: true },
  applicationName: "Zim 2026",
  appleWebApp: { capable: true, title: "Zim 2026", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f5f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0e131c" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
