"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
    realRole: "FREE" | "PREMIUM" | "COACH" | "SUPER_ADMIN";
    isClientMode: boolean;
    compact?: boolean;
}

export function RoleSwitcher({ realRole, isClientMode, compact }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    if (realRole !== "COACH" && realRole !== "SUPER_ADMIN") return null;

    const toggle = () => {
        startTransition(() => {
            const nextMode = isClientMode ? "COACH" : "CLIENT";
            document.cookie = `viewMode=${nextMode}; path=/; max-age=31536000`;
            router.push(nextMode === "COACH" ? "/coach" : "/dashboard");
            router.refresh();
        });
    };

    if (compact) {
        return (
            <button
                onClick={toggle}
                disabled={isPending}
                className={cn("btn-icon text-brand-400 hover:bg-brand-500/10", isPending && "opacity-50")}
                title={isClientMode ? "Switch to Coach Mode" : "Switch to Client Mode"}
            >
                <ArrowRightLeft className="w-4 h-4" />
            </button>
        );
    }

    return (
        <button
            onClick={toggle}
            disabled={isPending}
            className={cn(
                "w-full flex items-center justify-between px-3 py-3 rounded-xl border transition-all disabled:opacity-50",
                isClientMode
                    ? "bg-warning/10 border-warning/20 text-warning hover:bg-warning/20"
                    : "bg-surface-muted border-surface-border text-fg-muted hover:bg-surface-elevated"
            )}
        >
            <div className="flex items-center gap-2.5">
                <ArrowRightLeft className="w-4 h-4" />
                <span className="text-sm font-bold">
                    {isClientMode ? "Client Mode" : "Coach View"}
                </span>
            </div>
            <span className="text-[9px] uppercase font-black tracking-widest px-2 py-0.5 rounded-md bg-black/20">
                Switch
            </span>
        </button>
    );
}
