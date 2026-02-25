import type { Metadata, Viewport } from "next";
import {
  Architects_Daughter,
  Merriweather,
  Montserrat,
  Source_Code_Pro,
} from "next/font/google";
import "./globals.css";
import { ClientClerkProvider } from "./clerk-provider";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-montserrat",
});

const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-merriweather",
});

const architectsDaughter = Architects_Daughter({
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
  variable: "--font-architects-daughter",
});

const sourceCodePro = Source_Code_Pro({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-source-code-pro",
});

export const metadata: Metadata = {
  title: "Small Group",
  description: "Small Group app",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#f8f5f0" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const publishableKey =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
    process.env.CLERK_PUBLISHABLE_KEY;

  return (
    <html
      lang="en"
      className={`${montserrat.variable} ${merriweather.variable} ${architectsDaughter.variable} ${sourceCodePro.variable}`}
    >
      <head>
        <meta name="theme-color" content="#f8f5f0" />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content="#f8f5f0"
        />
        <meta name="color-scheme" content="light" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="default"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="icon" href="/sglogo.png" type="image/png" />
      </head>
      <body>
        <ClientClerkProvider publishableKey={publishableKey}>
          {children}
        </ClientClerkProvider>
      </body>
    </html>
  );
}
