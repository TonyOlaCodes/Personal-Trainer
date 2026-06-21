"use client";

import { Heart, Shield, Zap, Copy, Check, Info } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function DonateClient() {
    const [copied, setCopied] = useState<string | null>(null);

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    const benefits = [
        {
            icon: Shield,
            title: "Hosting & security",
            desc: "Keeps the app online, data backed up, and accounts protected.",
            color: "text-brand-400",
            bg: "bg-brand-400/10",
        },
        {
            icon: Zap,
            title: "New features",
            desc: "Helps fund improvements to plans, logging, check-ins, and coach tools.",
            color: "text-success",
            bg: "bg-success/10",
        },
        {
            icon: Heart,
            title: "Direct support",
            desc: "If the app helps your training, a contribution keeps development going.",
            color: "text-warning",
            bg: "bg-warning/10",
        },
    ];

    return (
        <div className="space-y-10 animate-fade-in pb-20">
            <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-brand-900/40 via-surface-card to-surface-card border border-brand-500/20 p-8 sm:p-12 text-center">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-brand-500/10 blur-[120px] -z-10" />

                <div className="w-20 h-20 bg-brand-400/10 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-glow-brand-sm border border-brand-400/20">
                    <Heart className="w-10 h-10 text-brand-400 fill-brand-400/20" />
                </div>

                <h1 className="text-4xl md:text-5xl font-black text-fg tracking-tighter mb-4">
                    Support the app
                </h1>
                <p className="text-lg text-fg-muted max-w-2xl mx-auto leading-relaxed">
                    FitCoach Pro is built and maintained independently. Optional contributions help cover hosting, development time, and ongoing improvements.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {benefits.map((b) => (
                    <div key={b.title} className="card p-6 bg-surface-card/60 backdrop-blur-sm group hover:border-brand-500/30 transition-all">
                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110", b.bg)}>
                            <b.icon className={cn("w-6 h-6", b.color)} />
                        </div>
                        <h3 className="text-lg font-black text-fg tracking-tight mb-2">{b.title}</h3>
                        <p className="text-sm text-fg-muted leading-relaxed">{b.desc}</p>
                    </div>
                ))}
            </div>

            <div className="max-w-2xl mx-auto">
                <div className="card p-8 space-y-8 bg-surface-card">
                    <div className="space-y-1">
                        <h3 className="text-xl font-black text-fg tracking-tight">Bank transfer</h3>
                        <p className="text-xs text-fg-muted uppercase font-bold tracking-widest">Optional contribution</p>
                    </div>

                    <div className="space-y-4">
                        <div className="group relative">
                            <div className="p-5 bg-surface-elevated/50 rounded-2xl border border-surface-border transition-all group-hover:border-brand-500/40">
                                <p className="text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-1.5">Account Holder</p>
                                <p className="text-lg font-black text-fg">Tony Olajide</p>
                                <button
                                    onClick={() => handleCopy("Tony Olajide", "name")}
                                    className="absolute top-4 right-4 text-brand-400 hover:text-brand-300 transition-colors"
                                >
                                    {copied === "name" ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div className="group relative">
                            <div className="p-5 bg-surface-elevated/50 rounded-2xl border border-surface-border transition-all group-hover:border-brand-500/40">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <p className="text-[10px] font-black text-fg-subtle uppercase tracking-widest">IBAN</p>
                                    <div className="badge-warning text-[8px] px-1 py-0">IRELAND</div>
                                </div>
                                <p className="text-lg font-black text-fg font-mono tracking-wider break-all">IE40 AIBK 9332 4457 5430 25</p>
                                <button
                                    onClick={() => handleCopy("IE40AIBK93324457543025", "iban")}
                                    className="absolute top-4 right-4 text-brand-400 hover:text-brand-300 transition-colors"
                                >
                                    {copied === "iban" ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-brand-400/5 rounded-2xl border border-brand-400/10 flex items-start gap-3">
                        <Info className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-fg-muted leading-relaxed">
                            Contributions are optional. For business enquiries or support, use the contact options in Settings.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
