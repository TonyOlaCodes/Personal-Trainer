import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";
import { PRIVACY_INTRO, PRIVACY_SECTIONS } from "@/lib/legal/privacySections";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
    title: "Privacy Policy",
    description: `How ${siteConfig.name} collects, uses, and protects your personal data.`,
};

export default function PrivacyPage() {
    return (
        <LegalDocumentLayout
            title="Privacy Policy"
            intro={PRIVACY_INTRO}
            sections={PRIVACY_SECTIONS}
        />
    );
}
