"use client";

import { Edit3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
    logId: string;
    workoutId: string;
}

export function EditSessionButton({ logId, workoutId }: Props) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleEdit = async () => {
        if (loading) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/logs/${logId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "IN_PROGRESS" })
            });
            if (res.ok) {
                router.push(`/plans/log/${workoutId}`);
                router.refresh();
            } else {
                alert("Failed to reopen session. Try again.");
            }
        } catch (e) {
            console.error(e);
            alert("Error reopening session.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <button 
            onClick={handleEdit}
            disabled={loading}
            className="btn-secondary btn-sm flex items-center gap-2 text-brand-400 group relative overflow-hidden h-10 px-4"
        >
            <div className={cn(
                "absolute inset-0 bg-brand-500/10 transition-transform duration-300 translate-y-full group-hover:translate-y-0",
                loading && "translate-y-0"
            )} />
            <Edit3 className={cn("w-4 h-4 relative z-10 transition-transform duration-500 group-hover:rotate-12", loading && "animate-spin")} />
            <span className="relative z-10 font-black uppercase tracking-widest text-[10px]">
                {loading ? "Reopening..." : "Edit Session"}
            </span>
        </button>
    );
}
