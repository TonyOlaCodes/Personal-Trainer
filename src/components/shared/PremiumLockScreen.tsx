"use client";

import { useState } from "react";
import { Lock, Ticket } from "lucide-react";
import { GainAccessModal } from "@/components/shared/GainAccessModal";
import { cn } from "@/lib/utils";

interface Props {
    title?: string;
    description?: string;
    codeHeading?: string;
    codeButtonLabel?: string;
    compact?: boolean;
}

export function PremiumLockScreen({ 
    title = "Premium Feature", 
    description = "This feature is reserved for Premium and Coached Premium members. Upgrade to unlock.",
    codeHeading = "Have an Access Code?",
    codeButtonLabel = "Unlock Access",
    compact = false,
}: Props) {
    const [code, setCode] = useState("");
    const [codeStatus, setCodeStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [codeMsg, setCodeMsg] = useState("");
    const [showGainAccess, setShowGainAccess] = useState(false);

    const redeemCode = async () => {
        setCodeStatus("loading");
        const res = await fetch("/api/codes/redeem", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (res.ok) {
            setCodeStatus("success");
            setCodeMsg("Code redeemed! Account upgraded.");
            setTimeout(() => window.location.reload(), 1500);
        } else {
            setCodeStatus("error");
            setCodeMsg(data.error ?? "Invalid code");
        }
    };

    return (
        <div className={cn(
            "card text-center mx-auto shadow-xl border-brand-600/20 bg-gradient-to-b from-surface-card to-surface",
            compact ? "p-5 max-w-sm" : "p-8 sm:p-12 max-w-xl"
        )}>
            <div className={cn(
                "bg-surface-muted rounded-full flex items-center justify-center mx-auto shadow-inner",
                compact ? "w-11 h-11 mb-3" : "w-16 h-16 mb-5"
            )}>
                <Lock className={cn("text-fg-subtle", compact ? "w-5 h-5" : "w-8 h-8")} />
            </div>
            
            <h3 className={cn("font-black text-fg", compact ? "text-lg mb-1" : "heading-2 mb-2")}>{title}</h3>
            <p className={cn("text-fg-muted leading-relaxed", compact ? "text-xs mb-4" : "text-sm mb-8 px-4")}>
                {description}
            </p>

            <div className={cn("bg-surface-muted/50 rounded-2xl border border-surface-border", compact ? "p-4 mb-4" : "p-6 mb-6")}>
                <div className={cn("flex items-center justify-center gap-2", compact ? "mb-3" : "mb-4")}>
                    <Ticket className="w-4 h-4 text-brand-400" />
                    <p className="font-semibold text-sm">{codeHeading}</p>
                </div>
                
                <div className="space-y-3 max-w-sm mx-auto">
                    <input
                        type="text"
                        className="input text-center uppercase tracking-widest font-mono text-lg font-bold"
                        placeholder="XXXXXXXX"
                        maxLength={8}
                        value={code}
                        onChange={(e) => { setCode(e.target.value.toUpperCase()); setCodeStatus("idle"); }}
                    />
                    <button
                        onClick={redeemCode}
                        disabled={code.length < 6 || codeStatus === "loading"}
                        className="btn-primary w-full shadow-glow-sm"
                    >
                        {codeStatus === "loading" ? "Checking..." : codeButtonLabel}
                    </button>
                    {codeMsg && (
                        <p className={cn("text-xs font-medium mt-2", codeStatus === "success" ? "text-success" : "text-danger")}>
                            {codeMsg}
                        </p>
                    )}
                </div>
            </div>

            <div className={cn("border-t border-surface-border", compact ? "pt-4" : "pt-6")}>
                <p className="text-xs text-fg-subtle mb-3">Want to upgrade or work with a coach?</p>
                <button
                    type="button"
                    onClick={() => setShowGainAccess(true)}
                    className="btn-ghost btn-sm mx-auto text-brand-400 hover:text-brand-300"
                >
                    Gain access
                </button>
            </div>
            <GainAccessModal open={showGainAccess} onClose={() => setShowGainAccess(false)} />
        </div>
    );
}
