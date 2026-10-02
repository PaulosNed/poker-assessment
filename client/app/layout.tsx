import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "River — Hand Simulator",
  description: "A six-seat Texas Hold’em hand simulator. Every seat, every decision.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
