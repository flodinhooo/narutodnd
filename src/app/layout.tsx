import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ToastProvider from "@/components/ToastProvider";
import BrandLogo from "@/components/BrandLogo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_APP_URL || "http://localhost:3000"),
  title: { default: "Shio no Kuni – Naruto D&D", template: "%s | Shio no Kuni – Naruto D&D" },
  applicationName: "Shio no Kuni – Naruto D&D",
  description: "Deine Naruto-D&D-Kampagne in Shiogakure: Charaktere, Jutsu, Missionen und Begegnungen gemeinsam verwalten.",
  icons: { icon: "/branding/icon-32.png", apple: "/branding/icon-180.png" },
  openGraph: { title: "Shio no Kuni – Naruto D&D", description: "Die Kampagnenplattform von Shiogakure.", locale: "de_CH", type: "website", images: [{ url: "/branding/social.png", width: 1200, height: 630, alt: "Offizielles Emblem von Shiogakure" }] },
  twitter: { card: "summary_large_image", title: "Shio no Kuni – Naruto D&D", images: ["/branding/social.png"] },
};
export const viewport: Viewport = { themeColor: "#db7656", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><header className="brand-header"><BrandLogo /></header>{children}<ToastProvider /></body>
    </html>
  );
}
