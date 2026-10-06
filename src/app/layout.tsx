import type { Metadata } from "next";
import { Barlow, Geist_Mono, Saira } from "next/font/google";
import "./globals.css";

/** Used only for the "Map Playground" wordmark. */
const saira = Saira({
  variable: "--font-saira-face",
  subsets: ["latin"],
  weight: ["600"],
  style: ["italic"],
});

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Map Playground",
  description: "Place inventory assets and draw geofences on a map",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${barlow.variable} ${saira.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full font-sans">{children}</body>
    </html>
  );
}
