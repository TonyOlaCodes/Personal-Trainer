"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { LANDING_TRANSFORMATION, landingMediaSlot } from "@/lib/landingMedia";

export function LandingHeroTransformation() {
    const { beforeKg, afterKg, progressLabel, caption } = LANDING_TRANSFORMATION;

    return (
        <div className="relative w-full max-w-[620px] mx-auto animate-slide-up animate-delay-200">
            <div
                className="absolute -inset-4 sm:-inset-8 rounded-[1.5rem] sm:rounded-[2rem] pointer-events-none opacity-80"
                aria-hidden
                style={{
                    background:
                        "radial-gradient(ellipse at 50% 50%, rgba(99,102,241,0.22) 0%, rgba(34,197,94,0.08) 45%, transparent 70%)",
                }}
            />
            <div className="absolute -inset-3 sm:-inset-4 bg-brand-600/10 rounded-3xl blur-2xl pointer-events-none" />

            <div className="relative rounded-xl sm:rounded-2xl border border-surface-border/50 bg-surface-card/90 backdrop-blur-md shadow-glow-sm px-4 py-5 sm:px-8 sm:py-8">
                <header className="text-center mb-4 sm:mb-7">
                    <p className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.16em] sm:tracking-[0.22em] text-fg-subtle">
                        My Transformation
                    </p>
                    <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-sm font-semibold uppercase tracking-[0.12em] sm:tracking-[0.18em] text-brand-400">
                        {progressLabel}
                    </p>
                </header>

                <div className="flex items-center justify-center gap-1.5 sm:gap-4">
                    <div className="relative flex-1 min-w-0 max-w-[108px] sm:max-w-none sm:flex-none sm:w-[240px] aspect-[3/4] rounded-xl sm:rounded-2xl overflow-hidden border border-surface-border/60 bg-surface-muted shadow-[0_12px_28px_-10px_rgba(0,0,0,0.55)] sm:shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55)]">
                        <Image
                            src={landingMediaSlot("transformations", "before")}
                            alt={`Before transformation at ${beforeKg} kg`}
                            fill
                            className="object-cover object-top"
                            sizes="(max-width: 640px) 108px, 240px"
                            priority
                        />
                    </div>

                    <div className="flex shrink-0 flex-col items-center justify-center px-0.5 sm:px-0" aria-hidden>
                        <div className="relative flex h-8 w-8 sm:h-11 sm:w-11 items-center justify-center rounded-full border border-surface-border/80 bg-surface-muted/80">
                            <ArrowRight className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-brand-400 animate-arrow-pulse" />
                        </div>
                        <div className="mt-1.5 sm:mt-2 flex gap-0.5 sm:gap-1">
                            <span className="h-0.5 w-0.5 sm:h-1 sm:w-1 rounded-full bg-brand-400/40 animate-bounce [animation-delay:0ms]" />
                            <span className="h-0.5 w-0.5 sm:h-1 sm:w-1 rounded-full bg-brand-400/70 animate-bounce [animation-delay:150ms]" />
                            <span className="h-0.5 w-0.5 sm:h-1 sm:w-1 rounded-full bg-brand-400 animate-bounce [animation-delay:300ms]" />
                        </div>
                    </div>

                    <div className="relative flex-1 min-w-0 max-w-[108px] sm:max-w-none sm:flex-none sm:w-[240px] aspect-[3/4] rounded-xl sm:rounded-2xl overflow-hidden border border-success/25 bg-surface-muted shadow-[0_12px_28px_-10px_rgba(34,197,94,0.2)] sm:shadow-[0_18px_40px_-12px_rgba(34,197,94,0.25)]">
                        <Image
                            src={landingMediaSlot("transformations", "after")}
                            alt={`After transformation at ${afterKg} kg`}
                            fill
                            className="object-cover object-top"
                            sizes="(max-width: 640px) 108px, 240px"
                            priority
                        />
                    </div>
                </div>

                <footer className="mt-4 sm:mt-7 space-y-1 sm:space-y-1.5 text-center">
                    <p className="text-xs sm:text-sm text-fg-muted">
                        Started at{" "}
                        <span className="font-semibold text-fg tabular-nums">{beforeKg} kg</span>
                    </p>
                    <p className="text-sm sm:text-base text-fg">
                        Currently{" "}
                        <span className="font-bold text-success tabular-nums">{afterKg} kg</span>
                    </p>
                    <p className="mx-auto max-w-[22rem] sm:max-w-[26rem] pt-1 sm:pt-2 text-[11px] sm:text-sm leading-relaxed text-fg-subtle px-1">
                        {caption}
                    </p>
                </footer>
            </div>
        </div>
    );
}
