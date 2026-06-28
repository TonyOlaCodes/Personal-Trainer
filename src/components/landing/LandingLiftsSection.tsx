"use client";

import { LANDING_LIFTS } from "@/lib/landingMedia";
import { LandingMediaVideo } from "./LandingMediaVideo";

export function LandingLiftsSection() {
    return (
        <section className="py-14 sm:py-24 px-4 sm:px-6 bg-surface-muted/20">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-8 sm:mb-16">
                    <p className="text-brand-400 font-semibold text-xs sm:text-sm uppercase tracking-widest mb-2 sm:mb-3">
                        On the platform
                    </p>
                    <h2 className="heading-1 mb-3 sm:mb-4">Log it. See the numbers move.</h2>
                    <p className="subheading max-w-2xl mx-auto px-2">
                        Every session feeds your dashboard — PRs, volume, and check-in trends built from real training footage like this.
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
                    {LANDING_LIFTS.map((lift) => (
                        <article
                            key={lift.id}
                            className="card overflow-hidden border-surface-border/60 group hover:border-brand-500/30 transition-colors"
                        >
                            <LandingMediaVideo
                                category="videos"
                                filename={lift.video}
                                className="aspect-[4/5] sm:aspect-[3/4]"
                                overlayClassName="bg-gradient-to-t from-surface via-transparent to-black/20 group-hover:via-surface/10 transition-colors"
                            />
                            <div className="p-4 sm:p-5 border-t border-surface-border/40">
                                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-brand-400 mb-0.5 sm:mb-1">
                                    {lift.label}
                                </p>
                                <p className="text-xl sm:text-2xl font-black text-fg tabular-nums">{lift.stat}</p>
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}
