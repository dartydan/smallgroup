import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ClientClerkProvider } from "./clerk-provider";

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
    <html lang="en">
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Architects+Daughter&family=Merriweather:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@400;500;600;700&family=Source+Code+Pro:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ClientClerkProvider publishableKey={publishableKey}>
          {children}
        </ClientClerkProvider>
      </body>
    </html>
  );
}
