import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";
import { TERMS_INTRO, TERMS_SECTIONS } from "@/lib/legal/termsSections";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
    title: "Terms of Service",
    description: `Terms governing use of the ${siteConfig.name} fitness tracking and coaching platform.`,
};

export default function TermsPage() {
    return (
        <LegalDocumentLayout
            title="Terms of Service"
            intro={TERMS_INTRO}
            sections={TERMS_SECTIONS}
        />
    );
}
