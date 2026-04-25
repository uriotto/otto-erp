import type { Metadata } from "next";
import { Assistant, Caveat } from "next/font/google";
import "./globals.css";

const assistant = Assistant({
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-assistant",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-caveat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OTTO ERP",
  description: "מערכת ERP/CRM פנימית של OTTO — אוטומציות לעצלנים",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${assistant.variable} ${caveat.variable} h-full antialiased`}
    >
      <body className="bg-cream text-ink min-h-full font-sans">{children}</body>
    </html>
  );
}
