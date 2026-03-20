"use client";

import { useState } from "react";
import { Lock, Ticket, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
    title?: string;
    description?: string;
}

export function PremiumLockScreen({ 
    title = "Premium Feature", 
    description = "This feature is reserved for Premium members and coached athletes. Upgrade to unlock." 
}: Props) {
    const [code, setCode] = useState("");
    const [codeStatus, setCodeStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [codeMsg, setCodeMsg] = useState("");

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
        <div className="card p-8 sm:p-12 text-center max-w-xl mx-auto shadow-xl border-brand-600/20 bg-gradient-to-b from-surface-card to-surface">
            <div className="w-16 h-16 bg-surface-muted rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
                <Lock className="w-8 h-8 text-fg-subtle" />
            </div>
            
            <h3 className="heading-2 mb-2 text-fg">{title}</h3>
            <p className="text-fg-muted text-sm mb-8 px-4 leading-relaxed">
                {description}
            </p>

            <div className="bg-surface-muted/50 p-6 rounded-2xl border border-surface-border mb-6">
                <div className="flex items-center justify-center gap-2 mb-4">
                    <Ticket className="w-4 h-4 text-brand-400" />
                    <p className="font-semibold text-sm">Have an Access Code?</p>
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
                        {codeStatus === "loading" ? "Checking..." : "Unlock Access"}
                    </button>
                    {codeMsg && (
                        <p className={cn("text-xs font-medium mt-2", codeStatus === "success" ? "text-success" : "text-danger")}>
                            {codeMsg}
                        </p>
                    )}
                </div>
            </div>

            <div className="pt-6 border-t border-surface-border">
                <p className="text-xs text-fg-subtle mb-3">Want to upgrade or work with a coach?</p>
                <a href="mailto:tonyolajide@gmail.com" className="btn-ghost btn-sm mx-auto text-brand-400 hover:text-brand-300">
                    <Mail className="w-4 h-4" />
                    Book Free Consultation
                </a>
            </div>
        </div>
    );
}
