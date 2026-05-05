import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "日历记账",
  description: "记录每一天",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-neutral-50 text-neutral-900">{children}</body>
    </html>
  );
}
