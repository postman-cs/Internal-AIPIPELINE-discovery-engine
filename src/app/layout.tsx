import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { CommandPalette } from "@/components/CommandPalette";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "CortexLab - CSE Intelligence Workflow",
  description: "CortexLab — Postman CSE discovery & intelligence platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable}`} style={{ colorScheme: "dark" }}>
      <body className="antialiased font-sans">
        <ToastProvider>
          {children}
          <CommandPalette />
        </ToastProvider>
      </body>
    </html>
  );
}
