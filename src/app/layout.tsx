import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "T-Echo Monitor — Панель управления Meshtastic сетью",
  description: "Мониторинг и управление сетью T-Echo устройств с Meshtastic. Статус узлов, карта, настройки каналов.",
  keywords: ["T-Echo", "Meshtastic", "LoRa", "LoRaWAN", "monitoring", "dashboard", "mesh network"],
  authors: [{ name: "T-Echo Monitor" }],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "T-Echo Monitor",
    description: "Панель управления Meshtastic сетью",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
