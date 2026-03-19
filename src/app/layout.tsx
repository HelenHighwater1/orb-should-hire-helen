import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ToasterClient } from "@/components/ToasterClient";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Orb Pricing Sandbox",
  description:
    "Watch a live invoice build in real time as usage events stream in. Change the pricing model and see how the same usage produces a completely different bill.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ToasterClient />
      </body>
    </html>
  );
}
