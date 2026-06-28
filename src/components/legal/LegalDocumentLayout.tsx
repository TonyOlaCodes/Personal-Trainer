import Link from "next/link";
import { Zap, ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/shared/BrandLogo";
import type { LegalSection } from "@/lib/legal/common";
import { LEGAL_DISCLAIMER, LEGAL_LAST_UPDATED } from "@/lib/legal/common";

type Props = {
    title: string;
    intro?: string;
    sections: LegalSection[];
};

export function LegalDocumentLayout({ title, intro, sections }: Props) {
    return (
        <div className="min-h-screen bg-surface text-fg">
            <header className="sticky top-0 z-40 glass glass-border border-b border-surface-border">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
                    <Link href="/" className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow-brand shrink-0">
                            <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                        </div>
                        <span className="font-bold text-sm sm:text-base tracking-tight truncate">
                            <BrandLogo />
                        </span>
                    </Link>
                    <Link
                        href="/"
                        className="btn-ghost btn-sm shrink-0 text-fg-muted hover:text-fg"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="hidden sm:inline">Back</span>
                    </Link>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 pb-20">
                <div className="rounded-2xl border border-warning/25 bg-warning-muted/10 px-4 py-3 sm:px-5 sm:py-4 mb-8">
                    <p className="text-xs sm:text-sm text-fg-muted leading-relaxed">
                        <span className="font-semibold text-warning">Notice:</span> {LEGAL_DISCLAIMER}
                    </p>
                </div>

                <div className="mb-10">
                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-fg mb-3">
                        {title}
                    </h1>
                    <p className="text-xs sm:text-sm text-fg-subtle">
                        Last updated: {LEGAL_LAST_UPDATED}
                    </p>
                    {intro ? (
                        <p className="mt-4 text-sm sm:text-base text-fg-muted leading-relaxed">
                            {intro}
                        </p>
                    ) : null}
                </div>

                <div className="space-y-10">
                    {sections.map((section) => (
                        <section key={section.title} className="space-y-3">
                            <h2 className="text-lg sm:text-xl font-bold text-fg tracking-tight">
                                {section.title}
                            </h2>
                            <div className="space-y-3">
                                {section.paragraphs.map((paragraph) => (
                                    <p
                                        key={paragraph.slice(0, 48)}
                                        className="text-sm sm:text-[0.9375rem] text-fg-muted leading-relaxed"
                                    >
                                        {paragraph}
                                    </p>
                                ))}
                            </div>
                            {section.bullets?.length ? (
                                <ul className="list-disc pl-5 space-y-2 text-sm sm:text-[0.9375rem] text-fg-muted leading-relaxed">
                                    {section.bullets.map((item) => (
                                        <li key={item.slice(0, 48)}>{item}</li>
                                    ))}
                                </ul>
                            ) : null}
                            {section.paragraphsAfter?.length ? (
                                <div className="space-y-3">
                                    {section.paragraphsAfter.map((paragraph) => (
                                        <p
                                            key={paragraph.slice(0, 48)}
                                            className="text-sm sm:text-[0.9375rem] text-fg-muted leading-relaxed"
                                        >
                                            {paragraph}
                                        </p>
                                    ))}
                                </div>
                            ) : null}
                        </section>
                    ))}
                </div>
            </main>
        </div>
    );
}
