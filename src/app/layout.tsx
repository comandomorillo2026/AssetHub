import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import PwaRegister from "@/components/pwa/pwa-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: '#0f766e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AssetHub',
  },
};

export const metadata: Metadata = {
  title: "AssetHub — Asset Management System | Zeitgeist Business Solution",
  description: "Modern, multi-tenant asset tracking and inventory management platform. QR-powered, offline-capable, built for institutions across the Caribbean.",
  keywords: ["asset management", "inventory", "QR codes", "asset tracking", "SaaS", "Caribbean", "Trinidad and Tobago", "Zeitgeist", "PWA"],
  authors: [{ name: "Zeitgeist Business Solution" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/icon-152x152.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AssetHub",
  },
  openGraph: {
    type: "website",
    title: "AssetHub — Asset Management for Caribbean Institutions",
    description: "QR-powered asset tracking and inventory management. Built for government, banks, schools, and beyond.",
    siteName: "AssetHub",
    locale: "en_TT",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-152x152.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <PwaRegister />
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}