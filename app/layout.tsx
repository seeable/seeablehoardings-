import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight, Anton } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/auth-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-inter-tight",
  display: "swap",
});

const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SEEABLE Hoardings",
    template: "%s · SEEABLE Hoardings",
  },
  description:
    "Discover, compare, and request outdoor advertising space in Bengaluru.",
};

export const viewport: Viewport = {
  themeColor: "#faf9f6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${interTight.variable} ${anton.variable}`}
    >
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
