import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Pipeline - CSE Workflow",
  description: "Internal AI Pipeline for Postman CSE workflow",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
