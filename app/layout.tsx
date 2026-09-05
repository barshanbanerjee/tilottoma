import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import MainMap from "@/components/Map/MainMap";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Kolkata Street History",
  description: "Discover the history behind Kolkata's streets",
};

import MapProvider from "@/components/Map/MapProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col overflow-hidden">
        <MapProvider>
          <MainMap>
            {children}
          </MainMap>
        </MapProvider>
      </body>
    </html>
  );
}
