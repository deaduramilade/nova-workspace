import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppProviders from "../components/AppProviders";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nova Workspace",
  description: "AI-native collaborative browser workspace",
  icons: { icon: "/favicon.ico" },
};

// Strong mobile + desktop-on-phone support.
// The main "desktop view" (Neko remote Firefox) benefits from good scaling + pinch on phones.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: 'yes',
  viewportFit: 'cover',
  themeColor: '#050810',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} nova-bg`}>
        <AppProviders>
          <div className="nova-content">{children}</div>
        </AppProviders>
      </body>
    </html>
  );
}