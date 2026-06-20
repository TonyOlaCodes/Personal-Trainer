"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { getReturnToFromSearchParams } from "@/lib/navigation";

interface Props {
    fallback?: string;
    label?: string;
    className?: string;
}

export function BackButton({ fallback = "/dashboard", label = "Back", className }: Props) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const returnTo = getReturnToFromSearchParams(searchParams, fallback);

    const handleBack = () => {
        if (searchParams.get("from")) {
            router.push(returnTo);
            return;
        }

        if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
            return;
        }

        router.push(fallback);
    };

    return (
        <button
            type="button"
            onClick={handleBack}
            className={cn("btn-ghost btn-sm text-fg-subtle flex items-center gap-2", className)}
        >
            <ChevronLeft className="w-4 h-4" />
            {label}
        </button>
    );
}
