"use client";

import { Edit3, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn, toDateKey, parseLogDate } from "@/lib/utils";
import { appendReturnTo, getReturnToFromSearchParams } from "@/lib/navigation";
import { notifyWorkoutStatsChanged } from "@/lib/workoutStatsRefresh";

interface Props {
    logId: string;
    workoutId: string;
    loggedAt?: string;
}

export function SessionActions({ logId, workoutId, loggedAt }: Props) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const returnTo = getReturnToFromSearchParams(searchParams);
    const [editing, setEditing] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleEdit = async () => {
        if (editing || deleting) return;
        setEditing(true);
        try {
            const res = await fetch(`/api/logs/${logId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "IN_PROGRESS" }),
            });
            if (res.ok) {
                const dateQuery = loggedAt
                    ? `?date=${encodeURIComponent(toDateKey(parseLogDate(loggedAt)))}`
                    : "";
                router.push(appendReturnTo(`/plans/log/${workoutId}${dateQuery}`, returnTo));
                router.refresh();
            } else {
                alert("Failed to reopen session. Try again.");
            }
        } catch (e) {
            console.error(e);
            alert("Error reopening session.");
        } finally {
            setEditing(false);
        }
    };

    const handleDelete = async () => {
        if (editing || deleting) return;
        if (!confirm("Delete this session permanently? All sets and notes will be lost.")) return;

        setDeleting(true);
        try {
            const res = await fetch(`/api/logs/${logId}`, { method: "DELETE" });
            if (res.ok) {
                notifyWorkoutStatsChanged();
                router.push(returnTo);
                router.refresh();
            } else {
                alert("Failed to delete session. Try again.");
            }
        } catch (e) {
            console.error(e);
            alert("Error deleting session.");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={handleDelete}
                disabled={editing || deleting}
                className="btn-secondary btn-sm flex items-center gap-2 text-danger hover:bg-danger/10 hover:border-danger/30 group relative overflow-hidden h-10 px-4"
            >
                <Trash2 className={cn("w-4 h-4", deleting && "animate-pulse")} />
                <span className="font-black uppercase tracking-widest text-[10px]">
                    {deleting ? "Deleting..." : "Delete"}
                </span>
            </button>
            <button
                type="button"
                onClick={handleEdit}
                disabled={editing || deleting}
                className="btn-secondary btn-sm flex items-center gap-2 text-brand-400 group relative overflow-hidden h-10 px-4"
            >
                <div className={cn(
                    "absolute inset-0 bg-brand-500/10 transition-transform duration-300 translate-y-full group-hover:translate-y-0",
                    editing && "translate-y-0"
                )} />
                <Edit3 className={cn("w-4 h-4 relative z-10 transition-transform duration-500 group-hover:rotate-12", editing && "animate-spin")} />
                <span className="relative z-10 font-black uppercase tracking-widest text-[10px]">
                    {editing ? "Reopening..." : "Edit Session"}
                </span>
            </button>
        </div>
    );
}
