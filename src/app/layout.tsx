import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Muni SMA Analyst",
  description: "Cursor SDK municipal SMA analyst with generative UI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
