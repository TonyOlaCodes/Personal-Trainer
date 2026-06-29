"use client";

import { useScrollLock } from "@/hooks/useScrollLock";
import { cn } from "@/lib/utils";
import type { MouseEvent, ReactNode } from "react";

interface ModalOverlayProps {
    open?: boolean;
    onClose?: () => void;
    className?: string;
    children: ReactNode;
    closeOnBackdrop?: boolean;
    alignToAppShell?: boolean;
}

export function ModalOverlay({
    open = true,
    onClose,
    className,
    children,
    closeOnBackdrop = Boolean(onClose),
    alignToAppShell = false,
}: ModalOverlayProps) {
    useScrollLock(open);

    if (!open) return null;

    const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
        if (closeOnBackdrop && onClose && event.target === event.currentTarget) {
            onClose();
        }
    };

    return (
        <div
            className={cn(
                "fixed inset-0 z-[60] flex overflow-hidden overscroll-none items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in sm:p-4",
                alignToAppShell && "md:left-[var(--sidebar-width)]",
                className
            )}
            onClick={handleBackdropClick}
            role="presentation"
        >
            {children}
        </div>
    );
}
