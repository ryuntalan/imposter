import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { GameStateProvider } from "@/lib/context";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Impostor - Multiplayer Party Game",
  description: "A real-time multiplayer party game built with Next.js and Supabase",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans`}>
        <GameStateProvider>
          {children}
        </GameStateProvider>
      </body>
    </html>
  );
}
