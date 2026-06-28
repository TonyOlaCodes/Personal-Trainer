"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { isClientRole } from "@/lib/roles";
import { CLIENT_WALKTHROUGH_STEPS } from "@/lib/walkthrough/steps";
import { WalkthroughOverlay } from "./WalkthroughOverlay";

type WalkthroughContextValue = {
    isActive: boolean;
    demoMode: boolean;
    currentStepId: string | null;
    startWalkthrough: () => void;
};

const WalkthroughContext = createContext<WalkthroughContextValue | null>(null);

export function useWalkthrough() {
    const ctx = useContext(WalkthroughContext);
    if (!ctx) {
        return {
            isActive: false,
            demoMode: false,
            currentStepId: null as string | null,
            startWalkthrough: () => {},
        };
    }
    return ctx;
}

type Props = {
    children: ReactNode;
    userRole: string;
    initialWalkthroughDone: boolean;
};

export function AppWalkthroughProvider({
    children,
    userRole,
    initialWalkthroughDone,
}: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const [walkthroughDone, setWalkthroughDone] = useState(initialWalkthroughDone);
    const [isActive, setIsActive] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);
    const [ready, setReady] = useState(false);
    const autoStartedRef = useRef(false);

    const eligible = isClientRole(userRole);
    const steps = CLIENT_WALKTHROUGH_STEPS;
    const currentStep = isActive ? steps[stepIndex] : null;

    const persistCompletion = useCallback(async () => {
        try {
            await fetch("/api/user/walkthrough", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "complete" }),
            });
        } catch (error) {
            console.error("[Walkthrough] Failed to persist completion", error);
        }
        setWalkthroughDone(true);
        setIsActive(false);
        setStepIndex(0);
    }, []);

    const startWalkthrough = useCallback(() => {
        if (!eligible || walkthroughDone) return;
        setStepIndex(0);
        setIsActive(true);
        if (pathname !== steps[0]?.route) {
            router.push(steps[0].route);
        }
    }, [eligible, walkthroughDone, steps, pathname, router]);

    const skipWalkthrough = useCallback(async () => {
        await persistCompletion();
    }, [persistCompletion]);

    const goToStep = useCallback(
        (nextIndex: number) => {
            const step = steps[nextIndex];
            if (!step) return;
            setStepIndex(nextIndex);
            if (pathname !== step.route) {
                router.push(step.route);
            }
        },
        [steps, pathname, router]
    );

    const goNext = useCallback(() => {
        if (stepIndex >= steps.length - 1) {
            void persistCompletion();
            return;
        }
        goToStep(stepIndex + 1);
    }, [stepIndex, steps.length, persistCompletion, goToStep]);

    const goBack = useCallback(() => {
        if (stepIndex <= 0) return;
        goToStep(stepIndex - 1);
    }, [stepIndex, goToStep]);

    useEffect(() => {
        setReady(true);
    }, []);

    useEffect(() => {
        if (!ready || !eligible || walkthroughDone || autoStartedRef.current) return;

        const params = new URLSearchParams(window.location.search);
        const shouldStart = params.get("walkthrough") === "1";

        if (shouldStart) {
            autoStartedRef.current = true;
            window.history.replaceState({}, document.title, window.location.pathname);
            startWalkthrough();
            return;
        }

        if (userRole === "PREMIUM" && pathname === "/dashboard") {
            autoStartedRef.current = true;
            const timer = window.setTimeout(() => startWalkthrough(), 600);
            return () => window.clearTimeout(timer);
        }
    }, [ready, eligible, walkthroughDone, userRole, pathname, startWalkthrough]);

    useEffect(() => {
        const onReset = () => {
            setWalkthroughDone(false);
            autoStartedRef.current = false;
        };
        window.addEventListener("walkthrough:reset", onReset);
        return () => window.removeEventListener("walkthrough:reset", onReset);
    }, []);

    const value = useMemo<WalkthroughContextValue>(
        () => ({
            isActive,
            demoMode: isActive,
            currentStepId: currentStep?.id ?? null,
            startWalkthrough,
        }),
        [isActive, currentStep?.id, startWalkthrough]
    );

    return (
        <WalkthroughContext.Provider value={value}>
            {children}
            {isActive && currentStep && pathname === currentStep.route ? (
                <WalkthroughOverlay
                    step={currentStep}
                    stepIndex={stepIndex}
                    totalSteps={steps.length}
                    onBack={goBack}
                    onNext={goNext}
                    onSkip={skipWalkthrough}
                    onFinish={persistCompletion}
                    canGoBack={stepIndex > 0}
                />
            ) : null}
        </WalkthroughContext.Provider>
    );
}

export function notifyWalkthroughReset() {
    window.dispatchEvent(new Event("walkthrough:reset"));
}
