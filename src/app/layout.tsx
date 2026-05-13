import type { Metadata } from "next";
import { appConfig } from "@/app.config";
import { enabledPacks } from "@/packs.config";
import "./globals.css";

export const metadata: Metadata = {
  title: appConfig.appName,
  description: enabledPacks[0]?.description ?? appConfig.subtitle,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
