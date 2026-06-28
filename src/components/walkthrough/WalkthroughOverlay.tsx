"use client";

import { useLayoutEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrollLock } from "@/hooks/useScrollLock";
import type { WalkthroughStep } from "@/lib/walkthrough/steps";
import { getWalkthroughStepLabel } from "@/lib/walkthrough/steps";

type Props = {
    step: WalkthroughStep;
    stepIndex: number;
    totalSteps: number;
    canGoBack: boolean;
    onBack: () => void;
    onNext: () => void;
    onSkip: () => void;
    onFinish: () => void;
};

const SPOTLIGHT_PADDING = 10;

export function WalkthroughOverlay({
    step,
    stepIndex,
    totalSteps,
    canGoBack,
    onBack,
    onNext,
    onSkip,
    onFinish,
}: Props) {
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, height: 0 });
    const [isMobile, setIsMobile] = useState(false);
    const [visible, setVisible] = useState(false);

    useScrollLock(true);

    useLayoutEffect(() => {
        setVisible(false);

        const update = () => {
            setIsMobile(window.innerWidth < 768);
            const target = document.getElementById(step.targetId);
            if (!target) {
                setCoords({
                    top: window.innerHeight / 2 - 80,
                    left: window.innerWidth / 2 - 120,
                    width: 240,
                    height: 160,
                });
                return;
            }

            target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });

            window.requestAnimationFrame(() => {
                const rect = target.getBoundingClientRect();
                setCoords({
                    top: Math.max(8, rect.top - SPOTLIGHT_PADDING),
                    left: Math.max(8, rect.left - SPOTLIGHT_PADDING),
                    width: rect.width + SPOTLIGHT_PADDING * 2,
                    height: rect.height + SPOTLIGHT_PADDING * 2,
                });
                setVisible(true);
            });
        };

        update();
        const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
        const target = document.getElementById(step.targetId);
        if (target && resizeObserver) resizeObserver.observe(target);

        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, true);

        const timer = window.setTimeout(update, 320);

        return () => {
            window.clearTimeout(timer);
            window.removeEventListener("resize", update);
            window.removeEventListener("scroll", update, true);
            resizeObserver?.disconnect();
        };
    }, [step.targetId, step.id]);

    const position = isMobile ? "bottom" : step.position;
    const isFinishStep = Boolean(step.isFinish || stepIndex === totalSteps - 1);

    const cardStyle: React.CSSProperties = isMobile
        ? {
              left: "50%",
              bottom: 96,
              transform: "translateX(-50%)",
              top: "auto",
              width: "min(calc(100vw - 2rem), 22rem)",
          }
        : position === "bottom"
          ? {
                top: coords.top + coords.height + 16,
                left: coords.left + coords.width / 2,
                transform: "translateX(-50%)",
                width: "min(20rem, calc(100vw - 2rem))",
            }
          : position === "top"
            ? {
                  top: Math.max(16, coords.top - 16),
                  left: coords.left + coords.width / 2,
                  transform: "translate(-50%, -100%)",
                  width: "min(20rem, calc(100vw - 2rem))",
              }
            : position === "right"
              ? {
                    top: coords.top + coords.height / 2,
                    left: coords.left + coords.width + 16,
                    transform: "translateY(-50%)",
                    width: "min(20rem, calc(100vw - 2rem))",
                }
              : {
                    top: coords.top + coords.height / 2,
                    left: Math.max(16, coords.left - 16),
                    transform: "translate(-100%, -50%)",
                    width: "min(20rem, calc(100vw - 2rem))",
                };

    return (
        <div className="fixed inset-0 z-[120] pointer-events-none">
            <div
                className={cn(
                    "absolute inset-0 bg-black/75 transition-opacity duration-500",
                    visible ? "opacity-100" : "opacity-0"
                )}
                style={{
                    clipPath: visible
                        ? `polygon(
                            0% 0%, 0% 100%,
                            ${coords.left}px 100%,
                            ${coords.left}px ${coords.top}px,
                            ${coords.left + coords.width}px ${coords.top}px,
                            ${coords.left + coords.width}px ${coords.top + coords.height}px,
                            ${coords.left}px ${coords.top + coords.height}px,
                            ${coords.left}px 100%,
                            100% 100%, 100% 0%
                        )`
                        : undefined,
                }}
            />

            {visible ? (
                <div
                    className="absolute rounded-2xl border-2 border-brand-400/70 shadow-[0_0_0_4px_rgba(99,102,241,0.15)] transition-all duration-500 ease-out pointer-events-none"
                    style={{
                        top: coords.top,
                        left: coords.left,
                        width: coords.width,
                        height: coords.height,
                    }}
                />
            ) : null}

            <div
                className={cn(
                    "absolute pointer-events-auto bg-surface-elevated rounded-3xl p-5 sm:p-6 border border-brand-500/30 shadow-modal transition-all duration-500",
                    visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
                )}
                style={cardStyle}
            >
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <span className="badge-brand text-[9px] px-2 py-0.5">
                            {getWalkthroughStepLabel(stepIndex, totalSteps)}
                        </span>
                        <button
                            type="button"
                            onClick={onSkip}
                            className="text-[10px] font-black uppercase tracking-[0.16em] text-fg-subtle hover:text-fg transition-colors"
                        >
                            Skip Tour
                        </button>
                    </div>

                    <div>
                        <h4 className="font-black text-fg tracking-tight text-lg leading-tight">{step.title}</h4>
                        <p className="text-sm text-fg-muted mt-2 leading-relaxed">{step.description}</p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onBack}
                            disabled={!canGoBack}
                            className={cn(
                                "btn-ghost btn-sm",
                                !canGoBack && "opacity-0 pointer-events-none"
                            )}
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Back
                        </button>

                        <button
                            type="button"
                            onClick={isFinishStep ? onFinish : onNext}
                            className="btn-primary rounded-xl px-5 h-10 text-xs font-bold"
                        >
                            {isFinishStep ? "Finish" : "Next"}
                            {!isFinishStep ? <ChevronRight className="w-3.5 h-3.5" /> : null}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
