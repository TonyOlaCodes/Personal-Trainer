import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { siteConfig, siteUrl } from "@/lib/site";
import { landingMediaSlot } from "@/lib/landingMedia";
import { AppIntroSplash } from "@/components/shared/AppIntroSplash";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    template: `%s | ${siteConfig.name}`,
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
  },
  description: siteConfig.shortDescription,
  keywords: [...siteConfig.keywords],
  applicationName: siteConfig.name,
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  category: "fitness",
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    url: siteUrl(),
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    images: [
      {
        url: landingMediaSlot("photos", "ogShare"),
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} — ${siteConfig.tagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.shortDescription,
    images: [landingMediaSlot("photos", "ogShare")],
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: siteUrl(),
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
      <body className={`${inter.variable} antialiased w-full max-w-full max-md:overflow-x-hidden`}>
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
          <AppIntroSplash />
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
