"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, Trash2 } from "lucide-react";
import { ReturnLink } from "@/components/shared/ReturnLink";
import { parseLogDate, toDateKey } from "@/lib/utils";

export interface ActiveSessionInfo {
    id: string;
    workoutId: string;
    workoutName: string;
    loggedAt?: string;
}

interface Props {
    session: ActiveSessionInfo;
    onDiscarded?: () => void;
}

export function ActiveSessionBanner({ session, onDiscarded }: Props) {
    const router = useRouter();
    const [discarding, setDiscarding] = useState(false);

    const discardSession = async () => {
        if (!confirm("Are you sure you want to discard this session? All progress will be lost.")) return;
        setDiscarding(true);
        try {
            const res = await fetch(`/api/logs/${session.id}`, { method: "DELETE" });
            if (res.ok) {
                onDiscarded?.();
                router.refresh();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setDiscarding(false);
        }
    };

    const resumeHref = `/plans/log/${session.workoutId}${
        session.loggedAt ? `?date=${encodeURIComponent(toDateKey(parseLogDate(session.loggedAt)))}` : ""
    }`;

    return (
        <div className="card-hover p-4 bg-gradient-to-r from-brand-600/20 to-brand-950 border-brand-500/40 border shadow-glow-brand animate-pulse-slow">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-brand-400 flex items-center justify-center shrink-0">
                        <Flame className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0">
                        <h4 className="font-bold text-fg">Active Session in Progress</h4>
                        <p className="text-sm text-brand-300 truncate">{session.workoutName}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={discardSession}
                        disabled={discarding}
                        className="btn-ghost text-brand-300 hover:text-white hover:bg-brand-500/20 px-4 flex items-center gap-2"
                    >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Discard</span>
                    </button>
                    <ReturnLink href={resumeHref} className="btn-primary shadow-glow-brand px-6">
                        {discarding ? "..." : "Resume"}
                    </ReturnLink>
                </div>
            </div>
        </div>
    );
}
