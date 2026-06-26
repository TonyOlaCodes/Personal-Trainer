import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { siteConfig, siteUrl } from "@/lib/site";
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
  },
  twitter: {
    card: "summary",
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.shortDescription,
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
    <html lang="en" className="dark" data-theme="midnight" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased w-full max-w-full max-md:overflow-x-hidden`}>
        <Script id="pt-theme-init" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem("pt-theme");var v=["midnight","neon","solar","arctic","jungle","velvet"];var m={emerald:"jungle",ocean:"arctic",rose:"velvet"};if(m[t])t=m[t];if(v.indexOf(t)===-1)t="midnight";document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`}
        </Script>
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
