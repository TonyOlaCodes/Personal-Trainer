import { siteConfig } from "@/lib/site";

export const LEGAL_LAST_UPDATED = "25 June 2026";

export const LEGAL_DISCLAIMER =
    "This document is provided as a practical template for TOLGcoaching. It should be reviewed by qualified legal counsel before commercial launch or reliance.";

export const LEGAL_CONTACT_EMAIL = siteConfig.contactEmail;

export const LEGAL_PLATFORM_NAME = siteConfig.name;

export type LegalSection = {
    title: string;
    paragraphs: string[];
    bullets?: string[];
    paragraphsAfter?: string[];
};
