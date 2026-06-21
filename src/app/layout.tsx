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
    default: "FitCoach Pro — Fitness Coaching Platform",
  },
  description:
    "Workout plans, progress tracking, check-ins, and direct coach communication in one place.",
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
              colorText: "#f8f8fc",
              colorTextSecondary: "#c9c9dc",
              colorNeutral: "#c9c9dc",
              colorInputBackground: "#16161f",
              colorInputText: "#f8f8fc",
              borderRadius: "0.75rem",
              fontFamily: "Inter, sans-serif",
            },
            elements: {
              card: "shadow-modal bg-surface-card border border-surface-border text-fg",
              formButtonPrimary: "bg-gradient-brand hover:opacity-90 text-white",
              formFieldLabel: "text-fg-muted",
              formFieldInput: "bg-surface-elevated text-fg border-surface-border placeholder:text-fg-subtle",
              footerActionText: "text-fg-muted",
              footerActionLink: "text-brand-400 hover:text-brand-300",
              identityPreviewText: "text-fg",
              identityPreviewEditButton: "text-brand-400",
              modalContent: "bg-surface-card text-fg",
              navbarButton: "text-fg-muted hover:text-fg",
              navbarButtonText: "text-inherit",
              profileSectionTitle: "text-fg",
              profileSectionContent: "text-fg-muted",
              userButtonPopoverActionButton: "text-fg hover:bg-surface-muted",
              userButtonPopoverActionButtonText: "text-fg",
              userButtonPopoverCard: "bg-surface-card border border-surface-border text-fg",
              userPreviewMainIdentifier: "text-fg",
              userPreviewSecondaryIdentifier: "text-fg-muted",
            },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
