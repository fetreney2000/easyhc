import type { Metadata, Viewport } from "next";
import { MantineProvider } from "@/components/providers/MantineProvider";
import "./globals.css";
import { strings } from "@/lib/i18n/strings";

export const metadata: Metadata = {
  title: strings.appName,
  description: strings.appDescription,
  manifest: "/manifest.json",
};

// Next 14: viewport/themeColor belong in their own export, otherwise they
// trigger "Unsupported metadata ..." warnings on every route.
export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ms" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <MantineProvider>{children}</MantineProvider>
      </body>
    </html>
  );
}