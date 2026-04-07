import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s | FitCoach Pro",
    default: "FitCoach Pro — Premium Fitness Coaching Platform",
  },
  description:
    "Transform your body with personalised coaching, AI-driven workout plans, and real-time progress tracking.",
  keywords: ["fitness", "coaching", "workout", "gym", "personal trainer"],
  openGraph: {
    siteName: "FitCoach Pro",
    type: "website",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        <ClerkProvider
          appearance={{
            baseTheme: dark,
            variables: {
              colorPrimary: "#6366f1",
              colorBackground: "#111118",
              colorInputBackground: "#16161f",
              colorInputText: "#f8f8fc",
              borderRadius: "0.75rem",
              fontFamily: "Inter, sans-serif",
            },
            elements: {
              card: "shadow-modal",
              formButtonPrimary: "bg-gradient-brand hover:opacity-90",
            },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
