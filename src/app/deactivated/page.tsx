"use client";

import { useClerk } from "@clerk/nextjs";
import { AlertCircle, LogOut } from "lucide-react";

export default function DeactivatedPage() {
    const { signOut } = useClerk();

    return (
        <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-center">
            <div className="card max-w-sm p-8 space-y-6 border-danger/25 bg-danger/5 shadow-glow-danger-sm">
                <div className="w-16 h-16 rounded-2xl bg-danger/10 flex items-center justify-center mx-auto text-danger animate-pulse-slow">
                    <AlertCircle className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-xl font-black text-fg uppercase tracking-tight">Account Deactivated</h2>
                    <p className="text-sm text-fg-muted leading-relaxed">
                        Your account has been deactivated by your coach or administrator. Contact{" "}
                        <a href="mailto:tonyolajide@gmail.com" className="text-brand-400 underline">tonyolajide@gmail.com</a>{" "}
                        for help.
                    </p>
                </div>
                <button
                    onClick={() => signOut({ redirectUrl: "/?view=landing" })}
                    className="btn-secondary w-full text-xs font-bold uppercase tracking-wider py-3 flex items-center justify-center gap-2"
                >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                </button>
            </div>
        </div>
    );
}
