"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Walkthrough } from "@/components/shared/Walkthrough";
import { RecentSessionsExplorer, PREVIEW_LIMIT } from "@/components/shared/RecentSessionsExplorer";
import { ReturnLink } from "@/components/shared/ReturnLink";
import { ActiveSessionBanner } from "@/components/shared/ActiveSessionBanner";
import { CheckInsClient } from "@/app/(app)/checkins/CheckInsClient";
import { Dumbbell, ChevronRight, Clock, Flame, Activity, Calendar, Ticket, Check, Edit3, Trash2, Scale, Utensils, Footprints, Moon, AlertCircle, X } from "lucide-react";
import { formatDate, formatRelative, cn, toDateKey, parseLogDate, toLoggedAtIso } from "@/lib/utils";
import { appendReturnTo } from "@/lib/navigation";
import { notifyWorkoutStatsChanged } from "@/lib/workoutStatsRefresh";
import { useCurrentPath } from "@/hooks/useNavigation";
import { useCurrentDate } from "@/hooks/useCurrentDate";
import { useScrollLock } from "@/hooks/useScrollLock";
import { formatWeightDistanceFromGoal } from "@/lib/bodyweight";

interface Exercise {
    id: string;
    name: string;
    sets: number;
    reps: string;
    weightTargetKg?: number | null;
    muscleGroup?: string | null;
}

interface Workout {
    id: string;
    name: string;
    exercises: Exercise[];
    notes?: string | null;
}

interface RecentLog {
    id: string;
    workoutId: string;
    workoutName: string;
    loggedAt: string;
}

interface Props {
    user: { 
        name?: string | null; 
        role: string; 
        weightKg?: number | null; 
        targetWeightKg?: number | null;
        goal?: string | null;
        hiddenGoals?: string[];
    };
    activePlan: { name: string } | null;
    todayWorkout: Workout | null;
    nextTrainingDay: { id: string; name: string; date: string; dayLabel: string } | null;
    todayCompleted?: boolean;
    activeSession: { id: string; workoutId: string; workoutName: string; loggedAt?: string } | null;
    recentLogs: RecentLog[];
    avgDurationMin?: number;
    currentCheckin?: {
        id: string;
        weekNumber: number;
        status: string;
    } | null;
    checkInDueState: {
        isConfigured: boolean;
        isDueToday: boolean;
        isOverdue: boolean;
        daysUntilNext: number | null;
        dueDayLabel: string | null;
        frequencyWeeks: number | null;
    };
    checkInPanel?: {
        checkIns: Array<{
            id: string;
            userId?: string;
            createdAt: string;
            weekNumber: number;
            bodyweightKg?: number | null;
            feedback: string | null;
            notes?: string | null;
            status: "PENDING" | "REVIEWED";
            coachResponse?: string | null;
            respondedAt?: string | null;
            sleepRating?: number | null;
            dietRating?: number | null;
            energyRating?: number | null;
            stressRating?: number | null;
            intensityRating?: number | null;
            frontImageUrl?: string | null;
            sideImageUrl?: string | null;
            videoUrl?: string | null;
            coachVideoUrl?: string | null;
        }>;
        workoutsThisWeek: number;
        workoutsTarget: number;
        bodyweightWeeklyAverage: {
            averageWeightKg: number | null;
            entries: number;
            previousAverageWeightKg: number | null;
            previousEntries: number;
        };
        checkInSchedule: {
            day: number | null;
            frequencyWeeks: number | null;
            startDate: string | null;
        };
    } | null;
    bodyweight: {
        selectedDate: string;
        selectedWeightKg: number | null;
        selectedPreviousWeightKg: number | null;
        latestWeightKg: number | null;
        latestPreviousWeightKg: number | null;
        latestDate: string | null;
    };
    dailyMetrics: {
        selectedDate: string;
        calories: number | null;
        steps: number | null;
        sleepHours: number | null;
        latestCalories: number | null;
        latestSteps: number | null;
        latestSleepHours: number | null;
        targets: {
            targetCalories: number | null;
            targetSteps: number | null;
            targetSleepHours: number | null;
        };
    };
}

export function DashboardClient({ user, activePlan, todayWorkout, nextTrainingDay, todayCompleted, activeSession, recentLogs, avgDurationMin, currentCheckin, checkInDueState, checkInPanel, bodyweight, dailyMetrics }: Props) {
    const router = useRouter();
    const currentPath = useCurrentPath();
    const now = useCurrentDate();
    const todayDate = toDateKey(now);
    const prevTodayDateRef = useRef(todayDate);
    const viewingTodayRef = useRef(true);
    const [code, setCode] = useState("");
    const [codeStatus, setCodeStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [codeMsg, setCodeMsg] = useState("");
    const [showTour, setShowTour] = useState(false);
    const [weightDate, setWeightDate] = useState(todayDate);
    const [weight, setWeight] = useState(
        bodyweight.selectedDate === todayDate && bodyweight.selectedWeightKg
            ? bodyweight.selectedWeightKg.toFixed(2)
            : ""
    );
    const [latestWeight, setLatestWeight] = useState(bodyweight.latestWeightKg);
    const [selectedPreviousWeight, setSelectedPreviousWeight] = useState(
        bodyweight.selectedDate === todayDate ? bodyweight.selectedPreviousWeightKg : null
    );
    const [weightLogged, setWeightLogged] = useState(
        bodyweight.selectedDate === todayDate && Boolean(bodyweight.selectedWeightKg)
    );
    const [weightMsg, setWeightMsg] = useState("");
    const [savingWeight, setSavingWeight] = useState(false);
    const [calories, setCalories] = useState(
        dailyMetrics.selectedDate === todayDate && dailyMetrics.calories ? String(dailyMetrics.calories) : ""
    );
    const [steps, setSteps] = useState(
        dailyMetrics.selectedDate === todayDate && dailyMetrics.steps ? String(dailyMetrics.steps) : ""
    );
    const [sleepHours, setSleepHours] = useState(
        dailyMetrics.selectedDate === todayDate && dailyMetrics.sleepHours ? dailyMetrics.sleepHours.toString() : ""
    );
    const [caloriesLogged, setCaloriesLogged] = useState(
        dailyMetrics.selectedDate === todayDate && Boolean(dailyMetrics.calories)
    );
    const [stepsLogged, setStepsLogged] = useState(
        dailyMetrics.selectedDate === todayDate && Boolean(dailyMetrics.steps)
    );
    const [sleepLogged, setSleepLogged] = useState(
        dailyMetrics.selectedDate === todayDate && Boolean(dailyMetrics.sleepHours)
    );
    const [latestCalories, setLatestCalories] = useState(dailyMetrics.latestCalories);
    const [latestSteps, setLatestSteps] = useState(dailyMetrics.latestSteps);
    const [latestSleepHours, setLatestSleepHours] = useState(dailyMetrics.latestSleepHours);
    const [metricsMsg, setMetricsMsg] = useState("");
    const [savingMetrics, setSavingMetrics] = useState(false);
    const [localActiveSession, setLocalActiveSession] = useState(activeSession);
    const [sessionsExplorerOpen, setSessionsExplorerOpen] = useState(false);
    const [sessionsExplorerInitialId, setSessionsExplorerInitialId] = useState<string | null>(null);
    const [showCheckInPanel, setShowCheckInPanel] = useState(false);
    const [startingWorkout, setStartingWorkout] = useState(false);

    useScrollLock(showCheckInPanel);

    useEffect(() => {
        setLocalActiveSession(activeSession);
    }, [activeSession]);

    useEffect(() => {
        const prevToday = prevTodayDateRef.current;
        if (prevToday === todayDate) return;

        prevTodayDateRef.current = todayDate;

        if (viewingTodayRef.current || weightDate === prevToday) {
            viewingTodayRef.current = true;
            setWeightDate(todayDate);
            setWeight("");
            setWeightLogged(false);
            setSelectedPreviousWeight(null);
            setWeightMsg("");
            setCalories("");
            setSteps("");
            setSleepHours("");
            setCaloriesLogged(false);
            setStepsLogged(false);
            setSleepLogged(false);
            setMetricsMsg("");
        }

        router.refresh();
    }, [todayDate, weightDate, router]);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("tour") === "true") {
            setShowTour(true);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        const sessionId = urlParams.get("sessionId");
        if (sessionId) {
            setSessionsExplorerInitialId(sessionId);
            setSessionsExplorerOpen(true);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    const deleteLog = async (logId: string) => {
        if (!confirm("Delete this session permanently? All sets and notes will be lost.")) return;
        try {
            const res = await fetch(`/api/logs/${logId}`, { method: "DELETE" });
            if (res.ok) {
                if (sessionsExplorerInitialId === logId) {
                    setSessionsExplorerOpen(false);
                    setSessionsExplorerInitialId(null);
                }
                notifyWorkoutStatsChanged();
                router.refresh();
            } else {
                alert("Failed to delete session.");
            }
        } catch (e) {
            console.error(e);
            alert("Error deleting session.");
        }
    };

    const uncompleteLog = async (logId: string, workoutId: string, loggedAt?: string) => {
        try {
            const res = await fetch(`/api/logs/${logId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "IN_PROGRESS" })
            });
            if (res.ok) {
                const dateQuery = loggedAt
                    ? `?date=${encodeURIComponent(toDateKey(parseLogDate(loggedAt)))}`
                    : "";
                router.push(appendReturnTo(`/plans/log/${workoutId}${dateQuery}`, currentPath));
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        let cancelled = false;
        async function loadBodyweight() {
            setSavingWeight(true);
            setWeightMsg("");
            try {
                const res = await fetch(`/api/bodyweight?date=${weightDate}`);
                const data = await res.json();
                if (!res.ok || cancelled) return;
                setWeight(data.selected?.weightKg ? data.selected.weightKg.toFixed(2) : "");
                setWeightLogged(Boolean(data.selected));
                setSelectedPreviousWeight(data.selectedPrevious?.weightKg ?? null);
                setLatestWeight(data.latest?.weightKg ?? null);
            } catch (e) {
                console.error(e);
                if (!cancelled) setWeightMsg("Could not load weight");
            } finally {
                if (!cancelled) setSavingWeight(false);
            }
        }

        loadBodyweight();

        return () => {
            cancelled = true;
        };
    }, [weightDate]);

    useEffect(() => {
        let cancelled = false;
        async function loadDailyMetrics() {
            setSavingMetrics(true);
            setMetricsMsg("");
            try {
                const res = await fetch(`/api/daily-metrics?date=${weightDate}`);
                const data = await res.json();
                if (!res.ok || cancelled) return;
                setCalories(data.selected?.calories ? String(data.selected.calories) : "");
                setSteps(data.selected?.steps ? String(data.selected.steps) : "");
                setSleepHours(data.selected?.sleepHours ? data.selected.sleepHours.toString() : "");
                setCaloriesLogged(data.selected?.calories !== null && data.selected?.calories !== undefined);
                setStepsLogged(data.selected?.steps !== null && data.selected?.steps !== undefined);
                setSleepLogged(data.selected?.sleepHours !== null && data.selected?.sleepHours !== undefined);
                setLatestCalories(data.latest?.calories ?? null);
                setLatestSteps(data.latest?.steps ?? null);
                setLatestSleepHours(data.latest?.sleepHours ?? null);
            } catch (e) {
                console.error(e);
                if (!cancelled) setMetricsMsg("Could not load daily targets");
            } finally {
                if (!cancelled) setSavingMetrics(false);
            }
        }

        loadDailyMetrics();

        return () => {
            cancelled = true;
        };
    }, [weightDate]);

    async function handleUpdateWeight(val: string) {
        if (!val || savingWeight) return;
        const parsedWeight = Math.round(Number(val) * 100) / 100;
        if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) return;

        setSavingWeight(true);
        setWeightMsg("");
        try {
            const res = await fetch("/api/bodyweight", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ date: weightDate, weightKg: parsedWeight })
            });
            const data = await res.json();
            if (res.ok) {
                setWeight(data.selected?.weightKg ? data.selected.weightKg.toFixed(2) : parsedWeight.toFixed(2));
                setWeightLogged(true);
                setSelectedPreviousWeight(data.selectedPrevious?.weightKg ?? null);
                setLatestWeight(data.latest?.weightKg ?? parsedWeight);
                setWeightMsg("");
                router.refresh();
            } else {
                setWeightMsg(data.error ?? "Could not save");
            }
        } catch (e) {
            console.error(e);
            setWeightMsg("Could not save");
        } finally {
            setSavingWeight(false);
        }
    }

    async function handleUpdateDailyMetric(key: "calories" | "steps" | "sleepHours", val: string) {
        if (savingMetrics) return;

        const nextCalories = key === "calories" ? val : calories;
        const nextSteps = key === "steps" ? val : steps;
        const nextSleepHours = key === "sleepHours" ? val : sleepHours;

        if (!nextCalories && !nextSteps && !nextSleepHours) return;

        const payload = {
            date: weightDate,
            calories: nextCalories ? Number(nextCalories) : null,
            steps: nextSteps ? Number(nextSteps) : null,
            sleepHours: nextSleepHours ? Number(nextSleepHours) : null,
        };

        setSavingMetrics(true);
        setMetricsMsg("");
        try {
            const res = await fetch("/api/daily-metrics", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok) {
                setCalories(data.selected?.calories ? String(data.selected.calories) : "");
                setSteps(data.selected?.steps ? String(data.selected.steps) : "");
                setSleepHours(data.selected?.sleepHours ? data.selected.sleepHours.toString() : "");
                setCaloriesLogged(data.selected?.calories !== null && data.selected?.calories !== undefined);
                setStepsLogged(data.selected?.steps !== null && data.selected?.steps !== undefined);
                setSleepLogged(data.selected?.sleepHours !== null && data.selected?.sleepHours !== undefined);
                setLatestCalories(data.latest?.calories ?? payload.calories);
                setLatestSteps(data.latest?.steps ?? payload.steps);
                setLatestSleepHours(data.latest?.sleepHours ?? payload.sleepHours);
            } else {
                setMetricsMsg(data.error ?? "Could not save daily targets");
            }
        } catch (e) {
            console.error(e);
            setMetricsMsg("Could not save daily targets");
        } finally {
            setSavingMetrics(false);
        }
    }

    const isWeightDateToday = weightDate === todayDate;

    const bodyweightStatus = () => {
        if (weightMsg) return weightMsg;
        if (weightLogged) {
            const current = parseFloat(weight);
            if (
                user.targetWeightKg != null
                && user.targetWeightKg > 0
                && Number.isFinite(current)
            ) {
                return formatWeightDistanceFromGoal(current, user.targetWeightKg, user.goal);
            }
            return isWeightDateToday ? "Logged today" : "Logged";
        }
        return "Tap to log weight";
    };

    const dailyMetricStatus = (key: string, logged: boolean) => {
        if (metricsMsg) return metricsMsg;
        if (logged) return isWeightDateToday ? "Logged today" : "Logged";
        if (key === "calories") return "Tap to log calories";
        if (key === "steps") return "Add daily steps";
        if (key === "sleepHours") return "Track your sleep";
        return "Tap to log";
    };

    const getMetricInsight = (key: string, logged: boolean) => {
        if (key === "weight") {
            if (logged && user.targetWeightKg != null && user.targetWeightKg > 0) {
                return `Goal ${user.targetWeightKg.toFixed(1)} kg`;
            }
            if (logged && selectedPreviousWeight != null && weight) {
                const current = parseFloat(weight);
                if (Number.isFinite(current)) {
                    const delta = Math.round((current - selectedPreviousWeight) * 10) / 10;
                    if (Math.abs(delta) < 0.05) return "Same as last log";
                    const sign = delta > 0 ? "+" : "";
                    return `${sign}${delta.toFixed(1)} kg vs last log`;
                }
            }
            return logged ? "Weight logged" : "Log today for trends";
        }
        if (key === "calories") {
            return logged ? "Fueling recovery" : "Log to check limit";
        }
        if (key === "steps") {
            return logged ? "Active moving streak" : "Steps lower than usual";
        }
        if (key === "sleepHours") {
            return logged ? "Sleep improving" : "Track rest quality";
        }
        return "";
    };

    const greeting = () => {
        const h = now.getHours();
        if (h < 12) return "Good morning";
        if (h < 18) return "Good afternoon";
        return "Good evening";
    };

    const goToWorkoutLog = (workoutId: string, date?: string) => {
        const dateQuery = date ? `?date=${encodeURIComponent(date)}` : "";
        router.push(appendReturnTo(`/plans/log/${workoutId}${dateQuery}`, currentPath));
    };

    const handleStartTodayWorkout = async () => {
        if (!todayWorkout || startingWorkout) return;

        if (localActiveSession?.workoutId === todayWorkout.id) {
            goToWorkoutLog(
                todayWorkout.id,
                localActiveSession.loggedAt
                    ? toDateKey(parseLogDate(localActiveSession.loggedAt))
                    : todayDate
            );
            return;
        }

        setStartingWorkout(true);
        try {
            const flattenedSets = todayWorkout.exercises.flatMap((ex, exOrder) =>
                Array.from({ length: ex.sets }, (_, i) => ({
                    exerciseId: ex.id,
                    exerciseName: ex.name,
                    exerciseOrder: exOrder,
                    setNumber: i + 1,
                    reps: 0,
                    isWarmup: false,
                    isCompleted: false,
                }))
            );

            const res = await fetch("/api/logs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workoutId: todayWorkout.id,
                    status: "IN_PROGRESS",
                    loggedAt: toLoggedAtIso(todayDate),
                    sets: flattenedSets,
                }),
            });

            if (!res.ok) {
                alert("Could not start workout. Try again.");
                return;
            }

            goToWorkoutLog(todayWorkout.id, todayDate);
            router.refresh();
        } catch (e) {
            console.error(e);
            alert("Could not start workout.");
        } finally {
            setStartingWorkout(false);
        }
    };

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
            setCodeMsg("Access Granted!");
            // Refresh with tour flag
            setTimeout(() => {
                window.location.href = "/dashboard?tour=true";
            }, 1000);
        } else {
            setCodeStatus("error");
            setCodeMsg(data.error ?? "Invalid code");
        }
    };

    const tourSteps = [
        {
            targetId: "nav-dashboard",
            title: "Dashboard",
            description: "Your daily overview. See your current plan, stats, and today's mission at a glance.",
            position: "right" as const
        },
        {
            targetId: "nav-plans",
            title: "Training Plans",
            description: "Access your training programs. View every exercise, set, and rep assigned by your coach.",
            position: "right" as const
        },
        {
            targetId: "nav-calendar",
            title: "Workout Calendar",
            description: "A bird's eye view of your schedule. See what's coming up and what you've already crushed.",
            position: "right" as const
        },
        {
            targetId: "nav-progress",
            title: "Progress Tracking",
            description: "Analyze your gains. Track body metrics and strength plateaus over time.",
            position: "right" as const
        },
        {
            targetId: "dashboard-check-in",
            title: "Weekly Check-ins",
            description: "Submit your weekly check-ins and progress photos to your coach for feedback.",
            position: "bottom" as const
        },
        {
            targetId: "nav-chat",
            title: "Coach Chat",
            description: "Instant access to your coach. Ask questions or get form checks any time.",
            position: "right" as const
        },
        {
            targetId: "today-workout",
            title: "Start Workout",
            description: "Tap Start Workout to begin today's scheduled session immediately.",
            position: "bottom" as const
        }
    ];

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <RecentSessionsExplorer
                open={sessionsExplorerOpen}
                onClose={() => {
                    setSessionsExplorerOpen(false);
                    setSessionsExplorerInitialId(null);
                }}
                title="Workout History"
                subtitle="All completed workouts"
                fetchHistoryOnOpen
                sessions={recentLogs.map((log) => ({
                    id: log.id,
                    workoutName: log.workoutName,
                    date: log.loggedAt,
                }))}
                initialSessionId={sessionsExplorerInitialId}
                canDelete
                onDeleted={() => {
                    setSessionsExplorerOpen(false);
                    setSessionsExplorerInitialId(null);
                    router.refresh();
                }}
            />
            {showTour && <Walkthrough steps={tourSteps} onComplete={() => setShowTour(false)} />}

            {/* Greeting */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-fg tracking-tight">
                        {greeting()}, {user.name?.split(" ")[0] ?? "Athlete"}
                    </h2>
                    <div className="flex items-center gap-3 mt-1">
                        <p className="text-sm text-fg-muted font-medium">
                            {activePlan ? `Active plan: ${activePlan.name}` : "No active plan - pick one to get started."}
                        </p>
                        {avgDurationMin !== undefined && avgDurationMin > 0 && (
                            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-muted border border-surface-border text-[10px] font-bold text-fg-subtle uppercase tracking-widest">
                                <Clock className="w-3 h-3 text-brand-400" />
                                Avg {avgDurationMin} min
                            </span>
                        )}
                    </div>
                </div>

                {user.role === "FREE" && (
                    <div id="unlock-card" className="card p-4 bg-brand-500/5 border-brand-500/20 max-w-sm w-full animate-fade-in">
                        <div className="flex items-center gap-2 mb-3">
                            <Ticket className="w-3.5 h-3.5 text-brand-400" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-400">Unlock Full Access</p>
                        </div>
                        <div className="flex gap-2">
                            <input
                                placeholder="ACCESS CODE"
                                className="input-sm flex-1 text-center font-mono font-bold uppercase tracking-widest text-xs h-9 bg-white text-black placeholder:text-gray-400"
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                maxLength={8}
                            />
                            <button
                                onClick={redeemCode}
                                disabled={code.length < 6 || codeStatus === "loading"}
                                className="btn-primary btn-sm h-9 px-4"
                            >
                                {codeStatus === "loading" ? "..." : <Check className="w-4 h-4" />}
                            </button>
                        </div>
                        {codeMsg && (
                            <p className={cn(
                                "text-[9px] font-bold mt-2 uppercase tracking-wider text-center",
                                codeStatus === "success" ? "text-success" : "text-danger"
                            )}>
                                {codeMsg}
                            </p>
                        )}
                    </div>
                )}
            </div>
             
            {/* Daily Metrics Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-brand-400" />
                    <h3 className="heading-3">Daily Metrics & Quick Updates</h3>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            viewingTodayRef.current = true;
                            setWeightDate(todayDate);
                        }}
                        className={cn(
                            "h-9 px-3.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all",
                            isWeightDateToday
                                ? "border-success/30 bg-success/10 text-success shadow-glow-success-sm"
                                : "border-surface-border bg-surface-muted/40 text-fg-muted hover:text-fg"
                        )}
                    >
                        Today
                    </button>
                    <label className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface-muted/40 px-3 py-1.5 text-xs font-bold text-fg-muted cursor-pointer hover:border-brand-500/20 transition-all">
                        <Calendar className="w-3.5 h-3.5 text-brand-400" />
                        <input
                            type="date"
                            value={weightDate}
                            onChange={(e) => {
                                const next = e.target.value;
                                viewingTodayRef.current = next === todayDate;
                                setWeightDate(next);
                            }}
                            className="bg-transparent text-fg focus:outline-none cursor-pointer"
                        />
                    </label>
                </div>
            </div>

            <div id="weekly-metrics" className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                {/* Daily Weight Update */}
                {!user.hiddenGoals?.includes("weight") && (
                    <div className={cn(
                        "card p-3 sm:p-4 flex items-center gap-2 sm:gap-3 transition-all relative overflow-hidden group",
                        weightLogged
                            ? "bg-success/10 border-success/30 shadow-glow-success-sm"
                            : "bg-surface-muted/10 border-brand-500/10 hover:border-brand-500/30"
                    )}>
                    <div className={cn(
                        "w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform",
                        weightLogged ? "bg-success/15" : "bg-brand-500/5"
                    )}>
                        {weightLogged ? <Check className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-success" /> : <Scale className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-brand-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className={cn(
                            "text-[9px] font-black tracking-widest uppercase mb-0.5",
                            weightLogged ? "text-success" : "text-fg-subtle"
                        )}>
                            Weight
                        </p>
                        <div className="flex items-baseline gap-1">
                            <input 
                                type="number" 
                                step="0.01"
                                value={weight}
                                onChange={(e) => setWeight(e.target.value)}
                                onBlur={(e) => handleUpdateWeight(e.target.value)}
                                className="w-16 sm:w-20 bg-transparent text-lg sm:text-2xl font-black text-fg focus:outline-none focus:text-brand-400 transition-colors"
                                placeholder={latestWeight ? latestWeight.toFixed(2) : "--"}
                            />
                            <span className="text-[10px] font-semibold text-fg-muted uppercase">kg</span>
                        </div>
                        <p className={cn(
                            "text-[10px] font-bold mt-1 truncate",
                            weightLogged ? "text-success" : "text-fg-subtle"
                        )}>
                            {bodyweightStatus()}
                        </p>
                        <p className="text-[8px] sm:text-[9px] text-brand-400 font-semibold mt-0.5 opacity-80 leading-none truncate">
                            {getMetricInsight("weight", weightLogged)}
                        </p>
                    </div>
                    {savingWeight && (
                        <div className="absolute top-2 right-2">
                            <div className="w-3 h-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}
                    </div>
                )}

                {[
                    {
                        key: "calories" as const,
                        label: "Calories",
                        unit: "kcal",
                        icon: Utensils,
                        value: calories,
                        setValue: setCalories,
                        logged: caloriesLogged,
                        latest: latestCalories,
                        target: dailyMetrics.targets.targetCalories,
                        step: "1",
                    },
                    {
                        key: "steps" as const,
                        label: "Steps",
                        unit: "steps",
                        icon: Footprints,
                        value: steps,
                        setValue: setSteps,
                        logged: stepsLogged,
                        latest: latestSteps,
                        target: dailyMetrics.targets.targetSteps,
                        step: "1",
                    },
                    {
                        key: "sleepHours" as const,
                        label: "Sleep",
                        unit: "hrs",
                        icon: Moon,
                        value: sleepHours,
                        setValue: setSleepHours,
                        logged: sleepLogged,
                        latest: latestSleepHours,
                        target: dailyMetrics.targets.targetSleepHours,
                        step: "0.1",
                    },
                ]
                .filter(m => {
                    const matchKey = m.key === "sleepHours" ? "sleep" : m.key;
                    return !user.hiddenGoals?.includes(matchKey);
                })
                .map((metric) => {
                    const Icon = metric.icon;
                    return (
                        <div
                            key={metric.key}
                            className={cn(
                                "card p-3 sm:p-4 flex items-center gap-2 sm:gap-3 transition-all relative overflow-hidden",
                                metric.logged
                                    ? "bg-success/10 border-success/30 shadow-glow-success-sm"
                                    : "bg-surface-muted/10 border-brand-500/10 hover:border-brand-500/30"
                            )}
                        >
                            <div className={cn(
                                "w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0",
                                metric.logged ? "bg-success/15" : "bg-brand-500/5"
                            )}>
                                {metric.logged ? <Check className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-success" /> : <Icon className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-brand-400" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className={cn(
                                    "text-[9px] font-black tracking-widest uppercase mb-0.5",
                                    metric.logged ? "text-success" : "text-fg-subtle"
                                )}>
                                    {metric.label}
                                </p>
                                <div className="flex items-baseline gap-1">
                                    <input
                                        type="number"
                                        step={metric.step}
                                        value={metric.value}
                                        onChange={(e) => metric.setValue(e.target.value)}
                                        onBlur={(e) => handleUpdateDailyMetric(metric.key, e.target.value)}
                                        className="w-16 sm:w-20 bg-transparent text-lg sm:text-2xl font-black text-fg focus:outline-none focus:text-brand-400 transition-colors"
                                        placeholder={metric.latest ? metric.latest.toString() : metric.target ? metric.target.toString() : "--"}
                                    />
                                    <span className="text-[10px] font-semibold text-fg-muted uppercase">{metric.unit}</span>
                                </div>
                                <p className={cn(
                                    "text-[10px] font-bold mt-1 truncate",
                                    metric.logged ? "text-success" : "text-fg-subtle"
                                )}>
                                    {dailyMetricStatus(metric.key, metric.logged)}
                                </p>
                                <p className="text-[8px] sm:text-[9px] text-brand-400 font-semibold mt-0.5 opacity-80 leading-none truncate">
                                    {getMetricInsight(metric.key, metric.logged)}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            {/* Active Session Prompt */}
            {localActiveSession && (
                <ActiveSessionBanner
                    session={localActiveSession}
                    onDiscarded={() => setLocalActiveSession(null)}
                />
            )}

            {/* Check-in Widget */}
            {user.role !== "FREE" && (checkInDueState.isConfigured || !!currentCheckin) && (
                <button
                    type="button"
                    id="dashboard-check-in"
                    onClick={() => checkInPanel && setShowCheckInPanel(true)}
                    className="block group w-full text-left"
                >
                    <div className={cn(
                        "card p-4 flex items-center justify-between transition-all hover:shadow-glow-sm",
                        currentCheckin 
                            ? "border-success/20 bg-success/5 shadow-glow-success-sm" 
                            : checkInDueState.isOverdue
                                ? "border-danger/20 bg-danger/5 shadow-glow-danger-sm"
                                : checkInDueState.isDueToday
                                    ? "border-warning/20 bg-warning/5 shadow-glow-warning-sm"
                                    : "border-surface-border bg-surface-muted/30"
                    )}>
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                currentCheckin 
                                    ? "bg-success/15" 
                                    : checkInDueState.isOverdue
                                        ? "bg-danger/10"
                                        : "bg-warning/10"
                            )}>
                                {currentCheckin 
                                    ? <Check className="w-5 h-5 text-success" />
                                    : checkInDueState.isOverdue
                                        ? <AlertCircle className="w-5 h-5 text-danger animate-pulse-slow" />
                                        : <Calendar className="w-5 h-5 text-warning animate-pulse-slow" />
                                }
                            </div>
                            <div>
                                <p className="text-sm font-black text-fg">
                                    {currentCheckin ? `Week ${currentCheckin.weekNumber} Check-in` : "Weekly Check-in"}
                                </p>
                                <p className="text-xs text-fg-muted mt-0.5">
                                    {currentCheckin 
                                        ? currentCheckin.status === "REVIEWED" ? "✅ Coach reviewed" : "⏳ Awaiting coach review"
                                        : !checkInDueState.isConfigured
                                            ? "Tap to submit weekly check-in"
                                            : checkInDueState.isOverdue
                                                ? "Check-in overdue"
                                                : checkInDueState.isDueToday
                                                    ? "Check-in is due today"
                                                    : checkInDueState.daysUntilNext === 1
                                                        ? "Next check-in is tomorrow"
                                                        : checkInDueState.daysUntilNext !== null
                                                            ? `Next check-in in ${checkInDueState.daysUntilNext} days`
                                                            : `Scheduled for ${checkInDueState.dueDayLabel}`
                                    }
                                </p>
                            </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-fg-subtle group-hover:text-fg transition-colors" />
                    </div>
                </button>
            )}


            {/* Today's Workout */}
            <div id="today-workout">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
                        <h3 className="heading-3">Today&apos;s Workout</h3>
                        {(nextTrainingDay && (!todayWorkout || todayCompleted)) && (
                            <ReturnLink
                                href={`/plans/log/${nextTrainingDay.id}?date=${encodeURIComponent(nextTrainingDay.date)}`}
                                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-brand-300 hover:text-brand-200 transition-colors"
                            >
                                Next training day — preview {nextTrainingDay.name} ({nextTrainingDay.dayLabel} {formatDate(nextTrainingDay.date, { day: "numeric", month: "long" })})
                                <ChevronRight className="w-3 h-3" />
                            </ReturnLink>
                        )}
                    </div>
                    {(todayWorkout && !todayCompleted) && (
                        <span className="text-xs text-brand-400 font-black uppercase tracking-widest animate-pulse-slow">
                            {localActiveSession?.workoutId === todayWorkout.id ? "Active now" : "Scheduled today"}
                        </span>
                    )}
                </div>

                {todayCompleted ? (
                    <div className="card p-10 text-center space-y-4 bg-success-950/20 border-success-500/30">
                        <Check className="w-12 h-12 text-success mx-auto opacity-80" />
                        <div>
                            <p className="font-black text-lg text-success uppercase tracking-tight">Session Completed</p>
                            <p className="text-sm text-fg-muted max-w-xs mx-auto mt-2">
                                Great job! You have crushed today&apos;s scheduled workout. Take some time to rest and recover.
                            </p>
                        </div>
                    </div>
                ) : todayWorkout ? (
                    <div className="card p-5">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h4 className="font-semibold text-lg text-fg">{todayWorkout.name}</h4>
                                <p className="text-sm text-fg-muted mt-0.5">
                                    {todayWorkout.exercises.length} exercises
                                    {todayWorkout.notes && ` · ${todayWorkout.notes}`}
                                </p>
                            </div>
                            <div className="badge-muted">
                                <Clock className="w-3 h-3" />
                                ~60 min
                            </div>
                        </div>

                        <div className="space-y-2">
                            {todayWorkout.exercises.slice(0, 5).map((ex) => (
                                <div
                                    key={ex.id}
                                    className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-surface-muted border border-surface-border"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-brand-950 flex items-center justify-center">
                                            <Dumbbell className="w-3.5 h-3.5 text-brand-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-fg">{ex.name}</p>
                                            {ex.muscleGroup && (
                                                <p className="text-xs text-fg-subtle">{ex.muscleGroup}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-fg">
                                            {isCardio(ex.name, ex.muscleGroup)
                                                ? `${ex.sets > 1 ? `${ex.sets} × ` : ""}${ex.reps} min`
                                                : `${ex.sets} × ${ex.reps}`}
                                        </p>
                                        {ex.weightTargetKg && (
                                            <p className="text-xs text-fg-muted">
                                                {isCardio(ex.name, ex.muscleGroup) ? `Lvl ${ex.weightTargetKg}` : `${ex.weightTargetKg.toFixed(2)}kg`}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {todayWorkout.exercises.length > 5 && (
                                <p className="text-xs text-fg-muted text-center pt-1">
                                    +{todayWorkout.exercises.length - 5} more exercises
                                </p>
                            )}
                        </div>

                        {/* Centered Start / Resume CTA */}
                        <div className="mt-6 pt-4 border-t border-surface-border/50 flex justify-center">
                            <button
                                type="button"
                                onClick={handleStartTodayWorkout}
                                disabled={startingWorkout}
                                className={cn(
                                    "btn-primary w-full max-w-md py-4 text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-glow-brand disabled:opacity-60",
                                    localActiveSession?.workoutId === todayWorkout.id ? "shadow-glow-success bg-success border-success hover:bg-success-600" : ""
                                )}
                            >
                                <Flame className={cn("w-4.5 h-4.5", localActiveSession?.workoutId === todayWorkout.id && "animate-pulse")} />
                                {startingWorkout
                                    ? "Starting..."
                                    : localActiveSession?.workoutId === todayWorkout.id
                                        ? "Resume Workout Session"
                                        : "Start Workout"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="card p-10 text-center space-y-4 bg-surface-muted/30 border-dashed">
                        <Dumbbell className="w-12 h-12 text-brand-400 mx-auto opacity-40" />
                        <div>
                            <p className="font-black text-lg text-fg uppercase tracking-tight">
                                {activePlan ? "Rest Day" : "No Active Plan"}
                            </p>
                            <p className="text-sm text-fg-muted max-w-xs mx-auto mt-2">
                                {activePlan
                                    ? "Nothing scheduled today — good time to recover or stretch."
                                    : "You don't have an active plan yet. Pick one to start tracking your sessions."}
                            </p>
                        </div>
                        <Link
                            href="/plans"
                            className="btn-primary shadow-glow-brand-sm mx-auto px-8 h-11 text-[10px] font-black uppercase tracking-widest"
                        >
                            {activePlan ? "View Full Plan" : "Start a Plan →"}
                        </Link>
                    </div>
                )}
            </div>

            {/* Recent Workouts */}
            <div id="recent-sessions">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="heading-3">Recent Workouts</h3>
                    {recentLogs.length > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                setSessionsExplorerInitialId(null);
                                setSessionsExplorerOpen(true);
                            }}
                            className="btn-ghost btn-sm text-brand-400"
                        >
                            View All
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {recentLogs.length > 0 ? (
                    <div className="card divide-y divide-surface-border">
                        {recentLogs.slice(0, PREVIEW_LIMIT).map((log) => (
                            <div
                                onClick={() => {
                                    setSessionsExplorerInitialId(log.id);
                                    setSessionsExplorerOpen(true);
                                }}
                                key={log.id}
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-muted/30 transition-colors text-left cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-success-muted flex items-center justify-center">
                                        <Activity className="w-3.5 h-3.5 text-success" />
                                    </div>
                                    <p className="text-sm font-medium text-fg">{log.workoutName}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <p className="text-xs text-fg-muted">{formatRelative(log.loggedAt)}</p>
                                    <button 
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            deleteLog(log.id);
                                        }}
                                        className="btn-icon w-7 h-7 bg-surface-elevated hover:bg-danger/10 hover:text-danger transition-all shadow-sm"
                                        title="Delete session"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            uncompleteLog(log.id, log.workoutId, log.loggedAt);
                                        }}
                                        className="btn-icon w-7 h-7 bg-surface-elevated hover:bg-brand-500 hover:text-white transition-all shadow-sm"
                                        title="Uncomplete and Edit"
                                    >
                                        <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <ChevronRight className="w-4 h-4 text-fg-subtle" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="card p-6 text-center">
                        <p className="text-fg-muted text-sm">No sessions logged yet. Start your first workout!</p>
                    </div>
                )}
            </div>

            {user.role === "FREE" && (
                <div className="card p-6 bg-brand-950/10 border-brand-500/10 flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                    <div>
                        <h4 className="text-sm font-bold text-fg">Ready for more?</h4>
                        <p className="text-xs text-fg-muted">Reach out to your coach for an access code to unlock Premium insights, chat, and check-ins.</p>
                    </div>
                    <Link href="/settings" className="btn-secondary btn-sm shrink-0 font-bold uppercase tracking-wide text-[10px]">
                        Redeem Code
                    </Link>
                </div>
            )}


            {showCheckInPanel && checkInPanel && (
                <div className="fixed inset-0 z-[60] flex overflow-hidden overscroll-none flex-col md:items-center md:justify-center md:p-6 bg-surface md:bg-black/60 md:backdrop-blur-sm animate-fade-in">
                    <div className="relative flex flex-col w-full h-full md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-2xl md:border md:border-surface-border md:shadow-modal bg-surface overflow-hidden">
                        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-surface-border bg-surface-card/95 backdrop-blur-md shrink-0">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-400">Weekly</p>
                                <h2 className="text-lg font-black text-fg tracking-tight">Check-in</h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowCheckInPanel(false);
                                    router.refresh();
                                }}
                                className="btn-icon w-9 h-9"
                                aria-label="Close check-in"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-24 md:pb-6 p-4 sm:p-6">
                            <Suspense fallback={<div className="min-h-[320px] animate-pulse rounded-2xl bg-surface-muted" />}>
                                <CheckInsClient
                                    checkIns={checkInPanel.checkIns.map((c) => ({
                                        ...c,
                                        feedback: c.feedback ?? "",
                                    }))}
                                    isCoach={false}
                                    userRole={user.role}
                                    targetWeightKg={user.targetWeightKg}
                                    workoutsThisWeek={checkInPanel.workoutsThisWeek}
                                    workoutsTarget={checkInPanel.workoutsTarget}
                                    bodyweightWeeklyAverage={checkInPanel.bodyweightWeeklyAverage}
                                    checkInDueState={checkInDueState}
                                    checkInSchedule={checkInPanel.checkInSchedule}
                                    hiddenGoals={user.hiddenGoals ?? []}
                                />
                            </Suspense>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
