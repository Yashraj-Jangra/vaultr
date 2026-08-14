import React from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { SiteConfigProvider } from "@/context/SiteConfigContext";
import { ThemeProvider } from "@/context/ThemeContext";

export const metadata: Metadata = {
  title: {
    default: "_vaultr — Zero-Knowledge Password Manager",
    template: "%s — _vaultr",
  },
  description: "_vaultr is a zero-knowledge password manager. Your passwords are encrypted before they leave your browser.",
  keywords: ["password manager", "zero knowledge", "AES-256", "encrypted", "secure", "vaultr"],
  icons: {
    icon: "/brand/vaultr-vr-dark-transparent.svg",
    shortcut: "/brand/vaultr-vr-dark-transparent.svg",
    apple: "/brand/vaultr-lock-dark-solid.png",
  },
  openGraph: {
    title: "_vaultr — Zero-Knowledge Password Manager",
    description: "_vaultr is a zero-knowledge password manager. Your passwords are encrypted before they leave your browser.",
    type: "website",
    images: [
      {
        url: "/brand/vaultr-full-dark-solid.png",
        width: 1200,
        height: 630,
        alt: "_vaultr",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "_vaultr — Zero-Knowledge Password Manager",
    description: "_vaultr is a zero-knowledge password manager. Your passwords are encrypted before they leave your browser.",
    images: ["/brand/vaultr-full-dark-solid.png"],
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full scroll-smooth antialiased`}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="min-h-full" suppressHydrationWarning>
        <div id="app-root" className="h-full min-h-full">
          <SiteConfigProvider>
            <ThemeProvider>
              {children}
            </ThemeProvider>
          </SiteConfigProvider>
        </div>
      </body>
    </html>
  );
}
