"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
    Users, Activity, Calendar, MessageSquare,
    MapPin, Info, Dumbbell, Award, Scale, MoreHorizontal, ChevronRight, CheckCircle2, Edit3, Zap, Settings,
    Trash2, AlertTriangle, Clock, Search, X, Send
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line
} from "recharts";
import Link from "next/link";
import { ReturnLink } from "@/components/shared/ReturnLink";
import { ExerciseHistoryTooltipContent } from "@/components/shared/ExerciseHistoryTooltip";
import { RecentSessionsExplorer, PREVIEW_LIMIT } from "@/components/shared/RecentSessionsExplorer";
import { cn, formatDate, getInitials } from "@/lib/utils";
import { resolveUploadUrl } from "@/lib/uploadUrls";
import { formatCoachPlanLabel } from "@/lib/coachPlans";

const CHECK_IN_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const CHECK_IN_FREQUENCIES = [
    { value: 1, label: "Weekly" },
    { value: 2, label: "Every 2 weeks" },
    { value: 4, label: "Every 4 weeks" },
];

interface Client {
    id: string;
    name?: string | null;
    email: string;
    role: string;
    assignedCoachName?: string | null;
    avatarUrl?: string | null;
    activePlan: { id: string; name: string } | null;
    experience?: string | null;
    goal?: string | null;
    trainingLocation?: string | null;
    trainingDaysPerWeek?: number | null;
    checkInSchedule: {
        day: number | null;
        frequencyWeeks: number | null;
        startDate: string | null;
    };
    targetWeightKg?: number | null;
    currentWeightKg?: number | null;
    targetCalories?: number | null;
    targetSteps?: number | null;
    targetSleepHours?: number | null;
    adherencePercentage?: number;
    adherenceTrend?: "UP" | "DOWN" | "STABLE";
    lastActiveAt?: string | null;
    hiddenGoals?: string[];
}

interface ClientLog {
    id: string;
    workoutName: string;
    date: string;
    setCount: number;
}

interface ClientCheckIn {
    id: string;
    week: number;
    date: string;
    status: string;
}

interface ClientWorkoutNote {
    id: string;
    workoutLogId: string;
    text: string;
    createdAt: string;
    workoutName: string;
}

interface WorkoutHistoryEntry {
    id: string;
    workoutName: string;
    date: string;
    duration: number;
    volume: number;
}

interface Props {
    client: Client;
    currentUserId: string;
    availablePlans: { id: string; name: string; type: string }[];
    logs: ClientLog[];
    checkIns: ClientCheckIn[];
    bodyweightHistory: { date: string; weightKg: number }[];
    workoutNotes: ClientWorkoutNote[];
    workoutHistory: WorkoutHistoryEntry[];
    exerciseHistory: Record<string, Array<{ date: string, weight: number, reps: number, volume: number, oneRM: number, bestSetRpe?: number | null }>>;
    exerciseLastDone: Record<string, number>;
    readOnly?: boolean;
}

export function ClientDetailView({ client, currentUserId, availablePlans, logs, checkIns, bodyweightHistory, workoutNotes, workoutHistory, exerciseHistory, exerciseLastDone, readOnly = false }: Props) {
    const canEdit = !readOnly;
    const [assigning, setAssigning] = useState(false);
    const [assignMode, setAssignMode] = useState<"MENU" | "LIST" | "IMPORT">("MENU");
    const [updating, setUpdating] = useState(false);
    const [shareCode, setShareCode] = useState("");
    const [importing, setImporting] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [confirmEmail, setConfirmEmail] = useState("");
    const [checkInDay, setCheckInDay] = useState(client.checkInSchedule.day ?? 6);
    const [checkInFrequency, setCheckInFrequency] = useState(client.checkInSchedule.frequencyWeeks ?? 1);
    const [savingSchedule, setSavingSchedule] = useState(false);
    const [targetWeightKg, setTargetWeightKg] = useState(client.targetWeightKg ? String(client.targetWeightKg) : "");
    const [targetCalories, setTargetCalories] = useState(client.targetCalories ? String(client.targetCalories) : "");
    const [targetSteps, setTargetSteps] = useState(client.targetSteps ? String(client.targetSteps) : "");
    const [targetSleepHours, setTargetSleepHours] = useState(client.targetSleepHours ? String(client.targetSleepHours) : "");
    const [isEditingTargets, setIsEditingTargets] = useState(canEdit && client.checkInSchedule.day === null);

    useEffect(() => {
        setCheckInDay(client.checkInSchedule.day ?? 6);
        setCheckInFrequency(client.checkInSchedule.frequencyWeeks ?? 1);
        setTargetWeightKg(client.targetWeightKg ? String(client.targetWeightKg) : "");
        setTargetCalories(client.targetCalories ? String(client.targetCalories) : "");
        setTargetSteps(client.targetSteps ? String(client.targetSteps) : "");
        setTargetSleepHours(client.targetSleepHours ? String(client.targetSleepHours) : "");
        setIsEditingTargets(canEdit && client.checkInSchedule.day === null);
    }, [client, canEdit]);

    const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; date: string; weightKg: number } | null>(null);
    const [hoveredVolPoint, setHoveredVolPoint] = useState<{ id: string; workoutName: string; date: string; formattedDate: string; volume: number; x: number; y: number } | null>(null);
    const isWeightHidden = client.hiddenGoals?.includes("weight");
    const [activeChartTab, setActiveChartTab] = useState<"weight" | "volume">(isWeightHidden ? "volume" : "weight");
    
    useEffect(() => {
        if (isWeightHidden && activeChartTab === "weight") {
            setActiveChartTab("volume");
        }
    }, [isWeightHidden, activeChartTab]);

    const [selectedExercise, setSelectedExercise] = useState<string>("");
    const [exerciseSearchQuery, setExerciseSearchQuery] = useState("");
    const [weightTimeframe, setWeightTimeframe] = useState<"week" | "month" | "year" | "all">("all");
    
    // Quick Chat and Real-time Presence state hooks
    const [showQuickChat, setShowQuickChat] = useState(false);
    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [sendingChat, setSendingChat] = useState(false);
    const chatScrollRef = useRef<HTMLDivElement>(null);
    const isNearBottomRef = useRef(true);
    const shouldForceScrollRef = useRef(false);

    const scrollChatToBottom = () => {
        const container = chatScrollRef.current;
        if (!container) return;
        container.scrollTop = container.scrollHeight;
    };

    const isScrollNearBottom = (container: HTMLDivElement) =>
        container.scrollHeight - container.scrollTop - container.clientHeight < 80;
    const [showAllSessions, setShowAllSessions] = useState(false);
    const [sessionsInitialId, setSessionsInitialId] = useState<string | null>(null);

    const router = useRouter();

    const updatePlan = async (planId: string) => {
        if (!canEdit) return;
        setUpdating(true);
        try {
            const res = await fetch("/api/coach/clients/plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientId: client.id, planId }),
            });
            if (res.ok) {
                window.location.reload();
            } else {
                alert("Failed to update plan");
            }
        } catch (e) {
            alert("Network error.");
        } finally {
            setUpdating(false);
        }
    };

    const handleImport = async () => {
        if (!canEdit || !shareCode) return;
        setImporting(true);
        try {
            const res = await fetch("/api/plans/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: shareCode }),
            });
            if (res.ok) {
                const data = await res.json();
                
                await fetch("/api/coach/clients/plan", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ clientId: client.id, planId: data.id }),
                });

                window.location.reload();
            } else {
                const data = await res.json();
                alert(data.error || "Import failed.");
            }
        } catch (e) {
            alert("Network error.");
        } finally {
            setImporting(false);
        }
    };

    const handleRemoveClient = async () => {
        if (!canEdit) return;
        if (confirmEmail.toLowerCase() !== client.email.toLowerCase()) {
            alert("Email mismatch. Operation aborted.");
            return;
        }

        setUpdating(true);
        try {
            const res = await fetch("/api/coach/clients/remove", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientId: client.id }),
            });
            if (res.ok) {
                router.push("/coach");
            } else {
                alert("Failed to remove client.");
            }
        } catch (e) {
            alert("Network error.");
        } finally {
            setUpdating(false);
        }
    };

    const saveClientConfiguration = async () => {
        if (!canEdit) return;
        setSavingSchedule(true);
        try {
            // Save schedule
            const scheduleRes = await fetch("/api/coach/clients/checkin-schedule", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientId: client.id,
                    day: checkInDay,
                    frequencyWeeks: checkInFrequency,
                }),
            });
            if (!scheduleRes.ok) throw new Error("Failed to update check-in schedule.");

            // Save goals
            const goalsRes = await fetch("/api/coach/clients/goals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientId: client.id,
                    targetCalories: targetCalories ? Math.round(Number(targetCalories)) : null,
                    targetSteps: targetSteps ? Math.round(Number(targetSteps)) : null,
                    targetSleepHours: targetSleepHours ? Number(targetSleepHours) : null,
                    targetWeightKg: targetWeightKg ? Number(targetWeightKg) : null,
                }),
            });
            if (!goalsRes.ok) throw new Error("Failed to update targets.");

            router.refresh();
        } catch (e: any) {
            alert(e.message || "Network error.");
        } finally {
            setSavingSchedule(false);
        }
    };

    // Presence state selector
    const presence = useMemo(() => {
        if (!client.lastActiveAt) return { color: "bg-fg-muted/40", text: "Away" };
        const lastActive = new Date(client.lastActiveAt);
        const diffMs = Date.now() - lastActive.getTime();
        const diffMins = diffMs / (1000 * 60);
        const diffHours = diffMs / (1000 * 60 * 60);
        
        if (diffMins < 15) {
            return { color: "bg-success shadow-glow-success animate-pulse", text: "Active Now" };
        } else if (diffHours < 24) {
            return { color: "bg-warning", text: "Active today" };
        } else {
            const days = Math.max(1, Math.floor(diffHours / 24));
            return { color: "bg-fg-muted/30", text: days === 1 ? "Away 1d" : `Away ${days}d` };
        }
    }, [client.lastActiveAt]);

    // Quick Chat Fetch & Polling
    useEffect(() => {
        if (!showQuickChat) return;

        const fetchChat = async () => {
            try {
                const res = await fetch(`/api/messages?with=${client.id}`);
                if (res.ok) {
                    const data = await res.json();
                    setChatMessages(data);
                }
            } catch (e) {
                console.error("Failed to load chat in detail view", e);
            }
        };

        fetchChat();
        const interval = setInterval(fetchChat, 3000);
        return () => clearInterval(interval);
    }, [showQuickChat, client.id]);

    useEffect(() => {
        if (showQuickChat) {
            shouldForceScrollRef.current = true;
            isNearBottomRef.current = true;
        }
    }, [showQuickChat]);

    useEffect(() => {
        const container = chatScrollRef.current;
        if (!container || !showQuickChat) return;
        const onScroll = () => {
            isNearBottomRef.current = isScrollNearBottom(container);
        };
        container.addEventListener("scroll", onScroll, { passive: true });
        return () => container.removeEventListener("scroll", onScroll);
    }, [showQuickChat]);

    useEffect(() => {
        if (!showQuickChat) return;
        if (!shouldForceScrollRef.current && !isNearBottomRef.current) return;
        requestAnimationFrame(() => {
            scrollChatToBottom();
            shouldForceScrollRef.current = false;
            isNearBottomRef.current = true;
        });
    }, [chatMessages, showQuickChat]);

    const sendChatMessage = async () => {
        if (!canEdit || !chatInput.trim() || sendingChat) return;
        setSendingChat(true);

        const text = chatInput.trim();
        setChatInput("");

        // Optimistic UI update
        const tempId = `temp-${Date.now()}`;
        const optimisticMsg = {
            id: tempId,
            content: text,
            createdAt: new Date().toISOString(),
            sender: { id: currentUserId, role: "COACH" },
        };
        shouldForceScrollRef.current = true;
        setChatMessages(prev => [...prev, optimisticMsg]);

        try {
            const res = await fetch("/api/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: text,
                    isGeneral: false,
                    receiverId: client.id,
                    type: "TEXT",
                }),
            });
            if (res.ok) {
                const newRealMsg = await res.json();
                setChatMessages(prev => prev.map(m => m.id === tempId ? newRealMsg : m));
            } else {
                setChatMessages(prev => prev.filter(m => m.id !== tempId));
            }
        } catch (e) {
            setChatMessages(prev => prev.filter(m => m.id !== tempId));
        } finally {
            setSendingChat(false);
        }
    };

    const filteredBodyweightHistory = useMemo(() => {
        if (weightTimeframe === "all") return bodyweightHistory;
        const now = new Date();
        const cutoff = new Date();
        if (weightTimeframe === "week") {
            cutoff.setDate(now.getDate() - 7);
        } else if (weightTimeframe === "month") {
            cutoff.setDate(now.getDate() - 30);
        } else if (weightTimeframe === "year") {
            cutoff.setDate(now.getDate() - 365);
        }
        return bodyweightHistory.filter(h => new Date(h.date) >= cutoff);
    }, [bodyweightHistory, weightTimeframe]);

    const chartValues = filteredBodyweightHistory.map(r => r.weightKg);
    if (client.targetWeightKg) chartValues.push(client.targetWeightKg);
    const chartMin = chartValues.length > 0 ? Math.floor(Math.min(...chartValues) - 2) : 0;
    const chartMax = chartValues.length > 0 ? Math.ceil(Math.max(...chartValues) + 2) : 1;
    const chartRange = Math.max(chartMax - chartMin, 1);
    const chartWidth = 640;
    const chartHeight = 240;
    const chartPadding = { top: 20, right: 24, bottom: 34, left: 42 };
    const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
    const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
    const toX = (index: number) => chartPadding.left + (filteredBodyweightHistory.length === 1 ? plotWidth / 2 : (index / (filteredBodyweightHistory.length - 1)) * plotWidth);
    const toY = (weight: number) => chartPadding.top + ((chartMax - weight) / chartRange) * plotHeight;
    const chartPoints = filteredBodyweightHistory.map((row, index) => ({ ...row, x: toX(index), y: toY(row.weightKg) }));
    const linePath = chartPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
    const areaPath = chartPoints.length > 0
        ? `${linePath} L ${chartPoints[chartPoints.length - 1].x.toFixed(1)} ${(chartPadding.top + plotHeight).toFixed(1)} L ${chartPoints[0].x.toFixed(1)} ${(chartPadding.top + plotHeight).toFixed(1)} Z`
        : "";
    const targetY = client.targetWeightKg ? toY(client.targetWeightKg) : null;

    // Sort workout history ascending for chart progression
    const volumeHistory = [...workoutHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const volumeValues = volumeHistory.map(h => h.volume);
    
    const volMin = volumeValues.length > 0 ? Math.max(0, Math.floor(Math.min(...volumeValues) - 200)) : 0;
    const volMax = volumeValues.length > 0 ? Math.ceil(Math.max(...volumeValues) + 200) : 1000;
    const volRange = Math.max(volMax - volMin, 1);
    
    const volChartWidth = 640;
    const volChartHeight = 240;
    const volChartPadding = { top: 20, right: 24, bottom: 34, left: 48 };
    const volPlotWidth = volChartWidth - volChartPadding.left - volChartPadding.right;
    const volPlotHeight = volChartHeight - volChartPadding.top - volChartPadding.bottom;
    
    const toVolX = (index: number) => volChartPadding.left + (volumeHistory.length === 1 ? volPlotWidth / 2 : (index / (volumeHistory.length - 1)) * volPlotWidth);
    const toVolY = (vol: number) => volChartPadding.top + ((volMax - vol) / volRange) * volPlotHeight;
    
    const volChartPoints = volumeHistory.map((row, index) => ({ 
        ...row, 
        formattedDate: new Date(row.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        x: toVolX(index), 
        y: toVolY(row.volume) 
    }));
    
    const volLinePath = volChartPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
    const volAreaPath = volChartPoints.length > 0
        ? `${volLinePath} L ${volChartPoints[volChartPoints.length - 1].x.toFixed(1)} ${(volChartPadding.top + volPlotHeight).toFixed(1)} L ${volChartPoints[0].x.toFixed(1)} ${(volChartPadding.top + volPlotHeight).toFixed(1)} Z`
        : "";

    // Average duration math
    const validDurations = workoutHistory.filter(h => h.duration > 0);
    const totalDuration = validDurations.reduce((sum, h) => sum + h.duration, 0);
    const avgDuration = validDurations.length > 0 ? Math.round(totalDuration / validDurations.length) : 0;

    const exerciseListOrdered = useMemo(() => {
        const names = Object.keys(exerciseHistory);
        return names.sort((a, b) => (exerciseLastDone[b] || 0) - (exerciseLastDone[a] || 0));
    }, [exerciseHistory, exerciseLastDone]);

    useEffect(() => {
        if (!selectedExercise && exerciseListOrdered.length > 0) {
            setSelectedExercise(exerciseListOrdered[0]);
        }
    }, [exerciseListOrdered, selectedExercise]);

    const getRegex = (q: string) => {
        try {
            return new RegExp(q.trim().split('').map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*'), 'i');
        } catch { return new RegExp(q, 'i'); }
    };

    const exerciseListFiltered = useMemo(() => {
        return exerciseListOrdered.filter(ex => 
            exerciseSearchQuery ? getRegex(exerciseSearchQuery).test(ex) : true
        );
    }, [exerciseListOrdered, exerciseSearchQuery]);

    const selectedExerciseStats = useMemo(() => {
        if (!selectedExercise) return null;
        const history = exerciseHistory[selectedExercise] || [];
        if (history.length === 0) return null;
        const currentMax = Math.max(...history.map((h: any) => h.weight || 0));
        const estimatedMax = Math.max(...history.map((h: any) => h.oneRM || 0));
        return { currentMax, estimatedMax };
    }, [exerciseHistory, selectedExercise]);

    return (
        <div className="space-y-8 animate-fade-in">
            <RecentSessionsExplorer
                open={showAllSessions}
                onClose={() => {
                    setShowAllSessions(false);
                    setSessionsInitialId(null);
                }}
                title={`${client.name ?? "Client"} Workouts`}
                subtitle="Full workout history"
                fetchHistoryOnOpen
                historyUserId={client.id}
                sessions={logs}
                initialSessionId={sessionsInitialId}
                canAddCoachNote={canEdit}
            />
            {readOnly && (
                <div className="card p-4 border-warning/30 bg-warning/5 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-bold text-fg">View only — account inactive</p>
                        <p className="text-xs text-fg-muted mt-1">
                            This athlete&apos;s account was deleted or deactivated. You can review history, but plans, goals, messages, and settings cannot be changed.
                        </p>
                    </div>
                </div>
            )}
            {/* Client Profile Header */}
            <div className="card p-6 flex flex-col sm:flex-row items-center gap-6 justify-between text-center sm:text-left">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-brand flex items-center justify-center text-xl font-bold text-white shadow-glow-brand shrink-0">
                        {client.avatarUrl ? <img src={resolveUploadUrl(client.avatarUrl)} alt="avatar" className="w-full h-full object-cover rounded-3xl" /> : getInitials(client.name)}
                    </div>
                    <div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 justify-center sm:justify-start">
                            <h2 className="text-2xl font-bold text-fg tracking-tight">{client.name || "Strength Athlete"}</h2>
                            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-muted/50 border border-surface-border w-fit h-fit mx-auto sm:mx-0">
                                <span className={cn("w-1.5 h-1.5 rounded-full", presence.color)} />
                                <span className="text-[9px] text-fg-subtle font-black uppercase tracking-wider">{presence.text}</span>
                            </div>
                        </div>
                        <p className="text-sm text-fg-muted mb-1 mt-1 sm:mt-0">{client.email}</p>
                        <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                            <span className="badge-brand text-[9px] uppercase font-bold tracking-widest">{client.role} Member</span>
                            {client.assignedCoachName && (
                                <span className="badge text-[9px] bg-surface-muted text-fg-muted border border-surface-border">
                                    Coach: {client.assignedCoachName}
                                </span>
                            )}
                            {client.goal && <span className="badge text-[9px] bg-brand-500/10 text-brand-400 border border-brand-500/20">{client.goal.replace("_", " ")}</span>}
                            {client.experience && <span className="badge text-[9px] bg-warning-500/10 text-warning border border-warning-500/20">{client.experience.replace("_", " ")}</span>}
                            {client.trainingLocation && <span className="badge text-[9px] bg-success-500/10 text-success border border-success-500/20">{client.trainingLocation} Training</span>}
                            {client.trainingDaysPerWeek && <span className="badge text-[9px] bg-surface-muted text-fg-muted border border-surface-border">{client.trainingDaysPerWeek} Days / Wk</span>}
                        </div>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setShowQuickChat(true)} 
                        disabled={!canEdit}
                        title={canEdit ? "Message athlete" : "Cannot message inactive accounts"}
                        className={cn(
                            "btn-secondary px-6 h-11 transition-all",
                            !canEdit && "opacity-50 cursor-not-allowed",
                            showQuickChat && "bg-brand-500/20 text-brand-400 border-brand-500/30"
                        )}
                    >
                        <MessageSquare className="w-4 h-4" /> Message
                    </button>
                </div>
            </div>

            {/* Performance Intelligence Card (moved to top of details for better optimized hierarchy) */}
            <div className="card p-6 border-brand-500/20 bg-gradient-brand/5 shadow-glow-brand-sm">
                <div className="flex items-center gap-2 mb-6 text-brand-400">
                    <Zap className="w-4 h-4" />
                    <h4 className="text-[10px] font-black uppercase tracking-widest italic">Performance Intelligence</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Adherence (30d)</p>
                        <p className="text-2xl font-black text-fg leading-none italic">{client.adherencePercentage ?? 0}<span className="text-brand-400">%</span></p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Workouts</p>
                        <p className="text-2xl font-black text-fg leading-none italic">{workoutHistory.length}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Avg Duration</p>
                        <p className="text-2xl font-black text-fg leading-none italic">
                            {avgDuration}<span className="text-xs text-indigo-400 ml-0.5 font-sans not-italic">m</span>
                        </p>
                    </div>
                    <div className="space-y-1 text-right">
                        <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Trend</p>
                        <p className={cn(
                            "text-2xl font-black leading-none italic font-mono",
                            client.adherenceTrend === "UP" ? "text-success" : client.adherenceTrend === "DOWN" ? "text-danger" : "text-fg-muted"
                        )}>
                            {client.adherenceTrend === "UP" ? "↗" : client.adherenceTrend === "DOWN" ? "↘" : "→"}
                        </p>
                    </div>
                </div>
            </div>

            {/* Trends Grid: Weight/Volume Chart (2/3 width) & Check-ins Sidebar (1/3 width) */}
            <div className="grid lg:grid-cols-3 gap-8">
                {/* Weight/Volume chart */}
                <div className="card p-5 lg:col-span-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-surface-border/50">
                        <div className="flex flex-wrap items-center gap-6">
                            <div className="flex items-center gap-4">
                                {!isWeightHidden && (
                                    <button
                                        onClick={() => setActiveChartTab("weight")}
                                        className={cn(
                                            "text-sm font-black uppercase tracking-wider pb-2 border-b-2 transition-all",
                                            activeChartTab === "weight" 
                                                ? "border-brand-500 text-fg" 
                                                : "border-transparent text-fg-muted hover:text-fg"
                                        )}
                                    >
                                        Bodyweight Trend
                                    </button>
                                )}
                                <button
                                    onClick={() => setActiveChartTab("volume")}
                                    className={cn(
                                        "text-sm font-black uppercase tracking-wider pb-2 border-b-2 transition-all",
                                        activeChartTab === "volume" 
                                            ? "border-brand-500 text-fg" 
                                            : "border-transparent text-fg-muted hover:text-fg"
                                    )}
                                >
                                    Training Volume
                                </button>
                            </div>
                            
                            {activeChartTab === "weight" && (
                                <div className="flex items-center gap-1 bg-surface-muted/50 p-1 rounded-xl border border-surface-border/60">
                                    {(["week", "month", "year", "all"] as const).map((tf) => (
                                        <button
                                            key={tf}
                                            onClick={() => setWeightTimeframe(tf)}
                                            className={cn(
                                                "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                                                weightTimeframe === tf
                                                    ? "bg-brand-500 text-white shadow-sm"
                                                    : "text-fg-muted hover:text-fg"
                                            )}
                                        >
                                            {tf}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {activeChartTab === "weight" ? (
                            <div className="text-right">
                                <p className="text-xl font-black text-fg leading-none">{client.currentWeightKg ? `${client.currentWeightKg.toFixed(1)}kg` : "--"}</p>
                                <p className="text-[10px] text-fg-subtle font-bold uppercase tracking-widest mt-1">
                                    Target {client.targetWeightKg ? `${client.targetWeightKg.toFixed(1)}kg` : "--"}
                                </p>
                            </div>
                        ) : (
                            <div className="text-right">
                                <p className="text-xl font-black text-fg leading-none font-mono">
                                    {volumeHistory.length > 0 ? `${volumeHistory[volumeHistory.length - 1].volume.toLocaleString()}kg` : "--"}
                                </p>
                                <p className="text-[10px] text-fg-subtle font-bold uppercase tracking-widest mt-1">
                                    Last Workout Volume
                                </p>
                            </div>
                        )}
                    </div>
                    {activeChartTab === "weight" ? (
                        filteredBodyweightHistory.length > 0 ? (
                            <div className="h-64 relative">
                                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-full w-full" role="img" aria-label="Bodyweight trend chart">
                                    <defs>
                                        <linearGradient id="clientBodyweightFill" x1="0" x2="0" y1="0" y2="1">
                                            <stop offset="5%" stopColor="#38bdf8" stopOpacity="0.35" />
                                            <stop offset="95%" stopColor="#38bdf8" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    {[0, 1, 2, 3].map((line) => {
                                        const y = chartPadding.top + (line / 3) * plotHeight;
                                        const value = chartMax - (line / 3) * chartRange;
                                        return (
                                            <g key={line}>
                                                <line x1={chartPadding.left} x2={chartWidth - chartPadding.right} y1={y} y2={y} stroke="rgba(148,163,184,0.16)" strokeDasharray="4 4" />
                                                <text x={10} y={y + 4} fill="#94a3b8" fontSize="11" fontWeight="700">{value.toFixed(0)}</text>
                                            </g>
                                        );
                                    })}
                                    {targetY !== null && (
                                        <g>
                                            <line x1={chartPadding.left} x2={chartWidth - chartPadding.right} y1={targetY} y2={targetY} stroke="#f87171" strokeDasharray="6 6" strokeWidth="2" />
                                            <text x={chartWidth - chartPadding.right - 54} y={Math.max(14, targetY - 7)} fill="#f87171" fontSize="11" fontWeight="800">Target</text>
                                        </g>
                                    )}
                                    <path d={areaPath} fill="url(#clientBodyweightFill)" />
                                    <path d={linePath} fill="none" stroke="#38bdf8" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                                    {chartPoints.map((point) => (
                                        <g key={`${point.date}-${point.weightKg}`}>
                                            <circle 
                                                cx={point.x} 
                                                cy={point.y} 
                                                r={hoveredPoint?.date === point.date ? "6" : "4"} 
                                                fill={hoveredPoint?.date === point.date ? "#38bdf8" : "#0f172a"} 
                                                stroke="#38bdf8" 
                                                strokeWidth="3"
                                                className="transition-all duration-150"
                                            />
                                            <circle
                                                cx={point.x}
                                                cy={point.y}
                                                r="12"
                                                fill="transparent"
                                                className="cursor-pointer"
                                                onMouseEnter={() => setHoveredPoint(point)}
                                                onMouseLeave={() => setHoveredPoint(null)}
                                            />
                                        </g>
                                    ))}
                                    {chartPoints[0] && (
                                        <text x={chartPoints[0].x} y={chartHeight - 10} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="700">{chartPoints[0].date}</text>
                                    )}
                                    {chartPoints.length > 1 && (
                                        <text x={chartPoints[chartPoints.length - 1].x} y={chartHeight - 10} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="700">{chartPoints[chartPoints.length - 1].date}</text>
                                    )}
                                </svg>
                                {hoveredPoint && (
                                    <div 
                                        className="absolute z-10 pointer-events-none bg-surface-elevated/95 backdrop-blur-md border border-brand-500/30 px-3 py-1.5 rounded-xl text-center shadow-glow-brand-sm -translate-x-1/2 -translate-y-full transition-all duration-150 animate-scale-in"
                                        style={{
                                            left: `${(hoveredPoint.x / chartWidth) * 100}%`,
                                            top: `${(hoveredPoint.y / chartHeight) * 100 - 4}%`,
                                        }}
                                    >
                                        <p className="text-[9px] font-black text-brand-400 uppercase tracking-widest leading-none mb-1">
                                            {formatDate(hoveredPoint.date)}
                                        </p>
                                        <p className="text-xs font-black text-fg leading-none font-mono">
                                            {hoveredPoint.weightKg.toFixed(1)}<span className="text-[9px] text-fg-muted ml-0.5">kg</span>
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="h-64 rounded-2xl border border-dashed border-surface-border flex items-center justify-center text-sm text-fg-muted">
                                No bodyweight logs recorded for this timeframe.
                            </div>
                        )
                    ) : (
                        volumeHistory.length > 0 ? (
                            <div className="h-64 relative">
                                <svg viewBox={`0 0 ${volChartWidth} ${volChartHeight}`} className="h-full w-full" role="img" aria-label="Training volume progression chart">
                                    <defs>
                                        <linearGradient id="clientVolumeFill" x1="0" x2="0" y1="0" y2="1">
                                            <stop offset="5%" stopColor="#818cf8" stopOpacity="0.35" />
                                            <stop offset="95%" stopColor="#818cf8" stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    {[0, 1, 2, 3].map((line) => {
                                        const y = volChartPadding.top + (line / 3) * volPlotHeight;
                                        const value = volMax - (line / 3) * volRange;
                                        return (
                                            <g key={line}>
                                                <line x1={volChartPadding.left} x2={volChartWidth - volChartPadding.right} y1={y} y2={y} stroke="rgba(148,163,184,0.16)" strokeDasharray="4 4" />
                                                <text x={10} y={y + 4} fill="#94a3b8" fontSize="10" fontWeight="700">{value.toLocaleString()}</text>
                                            </g>
                                        );
                                    })}
                                    <path d={volAreaPath} fill="url(#clientVolumeFill)" />
                                    <path d={volLinePath} fill="none" stroke="#818cf8" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                                    {volChartPoints.map((point) => (
                                        <g key={`${point.id}-${point.volume}`}>
                                            <circle 
                                                cx={point.x} 
                                                cy={point.y} 
                                                r={hoveredVolPoint?.id === point.id ? "6" : "4"} 
                                                fill={hoveredVolPoint?.id === point.id ? "#818cf8" : "#0f172a"} 
                                                stroke="#818cf8" 
                                                strokeWidth="3"
                                                className="transition-all duration-150"
                                            />
                                            <circle
                                                cx={point.x}
                                                cy={point.y}
                                                r="12"
                                                fill="transparent"
                                                className="cursor-pointer"
                                                onMouseEnter={() => setHoveredVolPoint(point)}
                                                onMouseLeave={() => setHoveredVolPoint(null)}
                                            />
                                        </g>
                                    ))}
                                    {volChartPoints[0] && (
                                        <text x={volChartPoints[0].x} y={volChartHeight - 10} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="700">{volChartPoints[0].formattedDate}</text>
                                    )}
                                    {volChartPoints.length > 1 && (
                                        <text x={volChartPoints[volChartPoints.length - 1].x} y={volChartHeight - 10} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="700">{volChartPoints[volChartPoints.length - 1].formattedDate}</text>
                                    )}
                                </svg>
                                {hoveredVolPoint && (
                                    <div 
                                        className="absolute z-10 pointer-events-none bg-surface-elevated/95 backdrop-blur-md border border-indigo-500/30 px-3 py-1.5 rounded-xl text-center shadow-glow-brand-sm -translate-x-1/2 -translate-y-full transition-all duration-150 animate-scale-in"
                                        style={{
                                            left: `${(hoveredVolPoint.x / volChartWidth) * 100}%`,
                                            top: `${(hoveredVolPoint.y / volChartHeight) * 100 - 4}%`,
                                        }}
                                    >
                                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">
                                            {hoveredVolPoint.workoutName}
                                        </p>
                                        <p className="text-[9px] text-fg-subtle font-bold mb-1">
                                            {new Date(hoveredVolPoint.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                        </p>
                                        <p className="text-xs font-black text-fg leading-none font-mono">
                                            {hoveredVolPoint.volume.toLocaleString()}<span className="text-[9px] text-fg-muted ml-0.5">kg</span>
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="h-64 rounded-2xl border border-dashed border-surface-border flex items-center justify-center text-sm text-fg-muted">
                                No workout logs recorded for this client.
                            </div>
                        )
                    )}
                </div>

                {/* Sidebar: Goals/Schedule & Check-ins */}
                <div className="space-y-6 lg:col-span-1">
                    {/* Athlete Targets & Schedule Card */}
                    <div className={cn(
                        "card p-5 space-y-4 border transition-all",
                        client.checkInSchedule.day === null 
                            ? "border-warning/30 bg-warning/5 shadow-glow-warning-sm animate-pulse-slow" 
                            : "border-brand-500/10 hover:border-brand-500/20 bg-surface-card"
                    )}>
                        {/* Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-surface-border/50">
                            <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4 text-brand-400" />
                                <h3 className="text-xs font-black uppercase tracking-widest text-fg">Goals & Schedule</h3>
                            </div>
                            {client.checkInSchedule.day === null ? (
                                canEdit ? (
                                <span className="px-2 py-0.5 rounded-lg bg-warning/10 border border-warning/25 text-warning text-[9px] font-black uppercase tracking-widest">
                                    Setup Required
                                </span>
                                ) : (
                                <span className="px-2 py-0.5 rounded-lg bg-surface-muted border border-surface-border text-fg-subtle text-[9px] font-black uppercase tracking-widest">
                                    View Only
                                </span>
                                )
                            ) : canEdit ? (
                                <button
                                    onClick={() => setIsEditingTargets(prev => !prev)}
                                    className="text-brand-400 hover:text-brand-350 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors"
                                >
                                    {isEditingTargets ? (
                                        <>
                                            <X className="w-3 h-3" /> Cancel
                                        </>
                                    ) : (
                                        <>
                                            <Edit3 className="w-3 h-3" /> Edit
                                        </>
                                    )}
                                </button>
                            ) : null}
                        </div>

                        {/* Content */}
                        {!canEdit || (!isEditingTargets && client.checkInSchedule.day !== null) ? (
                            // VIEW MODE
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-surface-muted/30 rounded-xl border border-surface-border/50 space-y-1">
                                        <div className="flex items-center gap-1.5 text-fg-subtle">
                                            <Scale className="w-3.5 h-3.5" />
                                            <span className="text-[9px] font-black uppercase tracking-widest">Weight Goal</span>
                                        </div>
                                        <p className="text-sm font-black text-fg">
                                            {client.targetWeightKg ? `${client.targetWeightKg.toFixed(1)} kg` : "--"}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-surface-muted/30 rounded-xl border border-surface-border/50 space-y-1">
                                        <div className="flex items-center gap-1.5 text-fg-subtle">
                                            <Zap className="w-3.5 h-3.5" />
                                            <span className="text-[9px] font-black uppercase tracking-widest">Calories</span>
                                        </div>
                                        <p className="text-sm font-black text-fg">
                                            {client.targetCalories ? `${client.targetCalories.toLocaleString()} kcal` : "--"}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-surface-muted/30 rounded-xl border border-surface-border/50 space-y-1">
                                        <div className="flex items-center gap-1.5 text-fg-subtle">
                                            <Activity className="w-3.5 h-3.5" />
                                            <span className="text-[9px] font-black uppercase tracking-widest">Steps</span>
                                        </div>
                                        <p className="text-sm font-black text-fg">
                                            {client.targetSteps ? `${client.targetSteps.toLocaleString()} steps` : "--"}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-surface-muted/30 rounded-xl border border-surface-border/50 space-y-1">
                                        <div className="flex items-center gap-1.5 text-fg-subtle">
                                            <Clock className="w-3.5 h-3.5" />
                                            <span className="text-[9px] font-black uppercase tracking-widest">Sleep</span>
                                        </div>
                                        <p className="text-sm font-black text-fg">
                                            {client.targetSleepHours ? `${client.targetSleepHours.toFixed(1)} hrs` : "--"}
                                        </p>
                                    </div>
                                </div>

                                <div className="p-3 border border-brand-500/10 bg-brand-500/5 rounded-xl flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-brand-400" />
                                        <div>
                                            <p className="text-[8px] font-black uppercase tracking-widest text-fg-subtle">Check-in Day</p>
                                            <p className="text-xs font-black text-fg">
                                                {client.checkInSchedule.day != null
                                                    ? CHECK_IN_DAYS[client.checkInSchedule.day]
                                                    : "Not Set"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] font-black uppercase tracking-widest text-fg-subtle">Frequency</p>
                                        <p className="text-xs font-black text-brand-400">
                                            {CHECK_IN_FREQUENCIES.find(f => f.value === client.checkInSchedule.frequencyWeeks)?.label || "Weekly"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            // EDIT MODE
                            <div className="space-y-4">
                                {client.checkInSchedule.day === null && (
                                    <p className="text-[11px] text-warning font-semibold leading-relaxed">
                                        Athlete targets and check-in schedule must be set to complete onboarding for this client.
                                    </p>
                                )}
                                <div className="grid grid-cols-2 gap-3">
                                    <label className="space-y-1 block">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Check-in Day</span>
                                        <select
                                            value={checkInDay}
                                            onChange={(e) => setCheckInDay(Number(e.target.value))}
                                            className="input h-10 text-xs font-bold bg-surface-muted/30"
                                        >
                                            {CHECK_IN_DAYS.map((day, idx) => (
                                                <option key={day} value={idx}>{day}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="space-y-1 block">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Frequency</span>
                                        <select
                                            value={checkInFrequency}
                                            onChange={(e) => setCheckInFrequency(Number(e.target.value))}
                                            className="input h-10 text-xs font-bold bg-surface-muted/30"
                                        >
                                            {CHECK_IN_FREQUENCIES.map((freq) => (
                                                <option key={freq.value} value={freq.value}>{freq.label}</option>
                                            ))}
                                        </select>
                                    </label>
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <label className="space-y-1 block">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Calories (kcal)</span>
                                        <input
                                            type="number"
                                            placeholder="e.g. 2500"
                                            value={targetCalories}
                                            onChange={(e) => setTargetCalories(e.target.value)}
                                            className="input h-10 text-xs font-bold bg-surface-muted/30"
                                        />
                                    </label>
                                    <label className="space-y-1 block">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Daily Steps</span>
                                        <input
                                            type="number"
                                            placeholder="e.g. 10000"
                                            value={targetSteps}
                                            onChange={(e) => setTargetSteps(e.target.value)}
                                            className="input h-10 text-xs font-bold bg-surface-muted/30"
                                        />
                                    </label>
                                    <label className="space-y-1 block">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Sleep (hrs)</span>
                                        <input
                                            type="number"
                                            step="0.5"
                                            placeholder="e.g. 8.0"
                                            value={targetSleepHours}
                                            onChange={(e) => setTargetSleepHours(e.target.value)}
                                            className="input h-10 text-xs font-bold bg-surface-muted/30"
                                        />
                                    </label>
                                    <label className="space-y-1 block">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Weight Goal (kg)</span>
                                        <input
                                            type="number"
                                            step="0.1"
                                            placeholder="e.g. 75.0"
                                            value={targetWeightKg}
                                            onChange={(e) => setTargetWeightKg(e.target.value)}
                                            className="input h-10 text-xs font-bold bg-surface-muted/30"
                                        />
                                    </label>
                                </div>

                                <button
                                    onClick={async () => {
                                        await saveClientConfiguration();
                                        setIsEditingTargets(false);
                                    }}
                                    disabled={savingSchedule}
                                    className="btn-primary w-full h-10 text-xs font-black uppercase tracking-widest shadow-glow-brand mt-2"
                                >
                                    {savingSchedule ? "Saving..." : "Save Configuration"}
                                </button>
                            </div>
                        )}
                    </div>

                    <h3 className="heading-3 px-2 flex items-center gap-2 uppercase tracking-widest text-[11px] font-black text-success">
                        <Calendar className="w-4 h-4" />
                        Check-ins
                    </h3>
                    <div className="space-y-3 max-h-[340px] overflow-y-auto no-scrollbar pr-1">
                        {checkIns.length === 0 ? (
                            <div className="card p-12 text-center border-dashed opacity-50 flex flex-col items-center">
                                <Calendar className="w-8 h-8 text-fg-subtle mb-3" />
                                <p className="text-xs text-fg-muted font-black uppercase tracking-widest italic">No check-ins yet.</p>
                            </div>
                        ) : (
                            checkIns.map((ci) => (
                                <Link 
                                    href={`/checkins?highlight=${ci.id}`}
                                    key={ci.id} 
                                    className={cn(
                                        "card-hover p-5 border transition-all flex items-center justify-between group",
                                        ci.status === "Pending" ? "border-brand-500/40 bg-brand-500/5 shadow-glow-brand-sm" : "hover:bg-surface-subtle"
                                    )}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "w-12 h-12 rounded-2xl flex items-center justify-center border transition-all",
                                            ci.status === "Pending" ? "bg-brand-500/10 border-brand-500/30 text-brand-400" : "bg-surface-muted text-fg-subtle group-hover:border-brand-500/30"
                                        )}>
                                            <Scale className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-fg uppercase tracking-widest">Week {ci.week} Check-in</p>
                                            <p className="text-[10px] text-fg-subtle font-bold uppercase tracking-[0.1em] mt-0.5">{formatDate(ci.date)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {ci.status === "Pending" ? (
                                            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-500 text-white text-[9px] font-black uppercase tracking-widest shadow-glow-brand animate-pulse">Review</span>
                                        ) : (
                                            <span className="text-[9px] font-black uppercase tracking-widest text-success border border-success/30 px-3 py-1.5 rounded-xl">Reviewed</span>
                                        )}
                                        <ChevronRight className="w-4 h-4 text-fg-subtle group-hover:text-brand-400 group-hover:translate-x-1 transition-all" />
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Workouts Management & Notes Grid */}
            <div className="grid lg:grid-cols-3 gap-8">
                {/* Workouts Management Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Active Programme */}
                    <div className="space-y-4">
                        <h3 className="heading-3 px-2 flex items-center gap-2 uppercase tracking-widest text-[11px] font-black text-brand-400">
                            <Dumbbell className="w-4 h-4" />
                            Active Programme
                        </h3>
                        {client.activePlan ? (
                            <div className="card p-6 border-brand-800/20 bg-brand-950/10 shadow-glow-brand-sm">
                                <Link href={`/plans/create?id=${client.activePlan.id}&view=true`} className="group flex items-start justify-between cursor-pointer hover:bg-white/5 p-4 -m-4 rounded-xl transition-all mb-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="text-xl font-black text-fg">{client.activePlan.name}</h4>
                                            <ChevronRight className="w-4 h-4 text-brand-400 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
                                        </div>
                                        <p className="text-sm text-fg-muted">Currently deployed to athlete. Click to view.</p>
                                    </div>
                                    <Award className="w-8 h-8 text-brand-400 opacity-40 shrink-0 group-hover:opacity-100 transition-opacity" />
                                </Link>

                                {canEdit && assigning ? (
                                    <div className="mt-6 space-y-3 animate-fade-in bg-surface-muted/50 p-4 rounded-2xl border border-surface-border">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">Select New Plan</p>
                                        <div className="flex flex-col gap-2">
                                            {availablePlans.map((p) => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => updatePlan(p.id)}
                                                    disabled={updating}
                                                    className="flex items-center justify-between p-3 rounded-xl bg-surface hover:bg-surface-elevated border border-surface-border text-left group transition-all"
                                                >
                                                    <span className="text-sm font-bold text-fg group-hover:text-brand-400">{p.name}</span>
                                                    <span className="text-[8px] bg-brand-500/10 text-brand-400 px-1.5 py-0.5 rounded uppercase font-black">{p.type}</span>
                                                </button>
                                            ))}
                                        </div>
                                        <button 
                                            onClick={() => setAssigning(false)}
                                            className="text-[10px] font-bold text-fg-subtle uppercase tracking-widest hover:text-fg w-full text-center py-2"
                                        >
                                            Cancel Deployment
                                        </button>
                                    </div>
                                ) : (
                                    <div className="mt-2 flex flex-col sm:flex-row gap-2">
                                        {canEdit && (
                                        <>
                                        <Link href={`/plans/create?id=${client.activePlan.id}&clientId=${client.id}`} className="btn-primary btn-sm flex-1 flex items-center justify-center gap-2 h-11 border border-brand-500/30">
                                            <Edit3 className="w-4 h-4" /> Edit Plan
                                        </Link>
                                        <button 
                                            onClick={() => setAssigning(true)}
                                            className="btn-secondary btn-sm flex-1 h-11 font-bold uppercase tracking-wide border border-surface-border hover:bg-surface-elevated"
                                        >
                                            Assign New
                                        </button>
                                        </>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="card p-8 text-center border-dashed bg-surface-muted/30">
                                {canEdit && assigning ? (
                                    <div className="space-y-6 animate-fade-in text-left">
                                        {assignMode === "MENU" && (
                                            <>
                                                <div className="space-y-1 text-center mb-6">
                                                    <h4 className="text-sm font-black uppercase tracking-widest text-fg">Assign New Plan</h4>
                                                    <p className="text-[10px] text-fg-muted font-bold uppercase tracking-widest leading-relaxed">Choose a strategic path for this athlete.</p>
                                                </div>
                                                <div className="grid gap-3">
                                                    <button 
                                                        onClick={() => setAssignMode("LIST")}
                                                        className="card-hover p-4 flex items-center justify-between border-brand-500/20 bg-brand-500/5 group"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-400">
                                                                <Calendar className="w-5 h-5" />
                                                            </div>
                                                            <div className="text-left">
                                                                <p className="text-sm font-black text-fg uppercase tracking-tight group-hover:text-brand-400">Existing Programme</p>
                                                                <p className="text-[9px] text-fg-muted font-bold uppercase tracking-widest italic">From your saved database</p>
                                                            </div>
                                                        </div>
                                                        <ChevronRight className="w-4 h-4 text-fg-subtle" />
                                                    </button>

                                                    <Link 
                                                        href={`/plans/create?clientId=${client.id}`}
                                                        className="card-hover p-4 flex items-center justify-between border-warning/20 bg-warning/5 group"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center text-warning">
                                                                <Dumbbell className="w-5 h-5" />
                                                            </div>
                                                            <div className="text-left">
                                                                <p className="text-sm font-black text-fg uppercase tracking-tight group-hover:text-warning">Create New Plan</p>
                                                                <p className="text-[9px] text-fg-muted font-bold uppercase tracking-widest italic">Build from scratch for this client</p>
                                                            </div>
                                                        </div>
                                                        <ChevronRight className="w-4 h-4 text-fg-subtle" />
                                                    </Link>

                                                    <button 
                                                        onClick={() => setAssignMode("IMPORT")}
                                                        className="card-hover p-4 flex items-center justify-between border-success/20 bg-success/5 group"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center text-success">
                                                                <Zap className="w-5 h-5" />
                                                            </div>
                                                            <div className="text-left">
                                                                <p className="text-sm font-black text-fg uppercase tracking-tight group-hover:text-success">Import via Code</p>
                                                                <p className="text-[9px] text-fg-muted font-bold uppercase tracking-widest italic">Deploy via plan share key</p>
                                                            </div>
                                                        </div>
                                                        <ChevronRight className="w-4 h-4 text-fg-subtle" />
                                                    </button>
                                                </div>
                                                <button 
                                                    onClick={() => setAssigning(false)}
                                                    className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-fg-subtle hover:text-fg transition-all"
                                                >
                                                    Cancel Operations
                                                </button>
                                            </>
                                        )}

                                        {assignMode === "LIST" && (
                                            <div className="space-y-4">
                                                <button onClick={() => setAssignMode("MENU")} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-fg-muted hover:text-fg">
                                                    <ChevronRight className="w-3 h-3 rotate-180" /> Back
                                                </button>
                                                <div className="grid gap-2 max-h-[300px] overflow-y-auto no-scrollbar">
                                                    {availablePlans.length === 0 ? (
                                                        <p className="p-8 text-center text-[10px] font-bold uppercase tracking-widest text-fg-subtle italic">No plans found in database.</p>
                                                    ) : availablePlans.map((p) => (
                                                        <button
                                                            key={p.id}
                                                            onClick={() => updatePlan(p.id)}
                                                            className="flex items-center justify-between p-4 rounded-xl bg-surface-muted hover:bg-surface-elevated border border-surface-border transition-all group"
                                                        >
                                                            <span className="font-bold text-sm text-fg group-hover:text-brand-400">{p.name}</span>
                                                            <ChevronRight className="w-4 h-4" />
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {assignMode === "IMPORT" && (
                                            <div className="space-y-5">
                                                <button onClick={() => setAssignMode("MENU")} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-fg-muted hover:text-fg">
                                                    <ChevronRight className="w-3 h-3 rotate-180" /> Back
                                                </button>
                                                <div className="card p-6 bg-surface-card border-brand-500/20 shadow-glow-brand-sm">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-brand-400 mb-2 block">Plan Share Key</label>
                                                    <div className="flex gap-2">
                                                        <input 
                                                            type="text"
                                                            placeholder="E.G. ALPHA-99"
                                                            className="input flex-1 font-mono uppercase font-black tracking-widest"
                                                            value={shareCode}
                                                            onChange={(e) => setShareCode(e.target.value)}
                                                        />
                                                        <button 
                                                            onClick={handleImport}
                                                            disabled={importing || !shareCode}
                                                            className="btn-primary h-12 px-6 shadow-glow-brand"
                                                        >
                                                            {importing ? "..." : "Import"}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex justify-center mb-4">
                                            <div className="w-12 h-12 rounded-2xl bg-surface-muted flex items-center justify-center text-fg-subtle border border-surface-border">
                                                <Settings className="w-6 h-6 animate-spin-slow" />
                                            </div>
                                        </div>
                                        <p className="text-fg-muted text-[10px] font-black uppercase tracking-widest italic mb-6">No plan currently deployed to this client.</p>
                                        {canEdit ? (
                                        <button onClick={() => { setAssigning(true); setAssignMode("MENU"); }} className="btn-primary px-10 h-12 shadow-glow-brand">Deploy New Plan</button>
                                        ) : (
                                        <p className="text-xs text-fg-subtle">Plans cannot be assigned to inactive accounts.</p>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Recent Output */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="heading-3 flex items-center gap-2 uppercase tracking-widest text-[11px] font-black text-warning">
                                <Activity className="w-4 h-4" />
                                Recent Sessions
                            </h3>
                            {logs.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSessionsInitialId(null);
                                        setShowAllSessions(true);
                                    }}
                                    className="btn-ghost btn-sm text-brand-400 text-[10px] font-black uppercase tracking-widest"
                                >
                                    View all
                                    <ChevronRight className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                        <div className="space-y-2">
                            {logs.length === 0 ? (
                                <p className="text-sm text-fg-muted px-2 italic">No sessions logged yet.</p>
                            ) : (
                                logs.slice(0, PREVIEW_LIMIT).map((l) => (
                                    <button
                                        key={l.id}
                                        type="button"
                                        onClick={() => {
                                            setSessionsInitialId(l.id);
                                            setShowAllSessions(true);
                                        }}
                                        className="card p-4 flex items-center justify-between group hover:border-brand-500/40 transition-all cursor-pointer w-full text-left"
                                    >
                                        <div>
                                            <h5 className="font-black text-fg text-sm tracking-tight group-hover:text-brand-400">{l.workoutName}</h5>
                                            <p className="text-[10px] text-fg-muted font-bold uppercase tracking-widest">{l.setCount} sets verified</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-fg-subtle font-black uppercase tracking-widest">{formatDate(l.date)}</p>
                                            <ChevronRight className="w-4 h-4 text-fg-subtle ml-auto mt-1 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Workout Notes Column */}
                <div className="lg:col-span-1">
                    <div className="card p-5 h-full flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <MessageSquare className="w-4 h-4 text-warning" />
                                <h3 className="heading-3">Workout Notes</h3>
                            </div>
                            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 no-scrollbar">
                                {workoutNotes.length === 0 ? (
                                    <p className="text-sm text-fg-muted italic">No notes recorded for this client.</p>
                                ) : workoutNotes.map(note => (
                                    <div key={note.id} className="w-full text-left rounded-xl border border-surface-border bg-surface-muted/30 p-3">
                                        <p className="text-[10px] font-black text-brand-400 uppercase tracking-widest">{formatDate(note.createdAt)}</p>
                                        <p className="text-sm font-bold text-fg mt-1">{note.workoutName}</p>
                                        <p className="text-xs text-fg-muted mt-1 line-clamp-3">{note.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {canEdit && (
                        <div className="pt-4 border-t border-surface-border/50 text-center mt-4">
                            <Link href={`/plans/create?clientId=${client.id}`} className="text-xs font-black text-brand-400 hover:text-brand-300 transition-colors uppercase tracking-widest flex items-center justify-center gap-1.5">
                                <Dumbbell className="w-3.5 h-3.5" /> Modify Workouts
                            </Link>
                        </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── EXERCISE PROGRESSION HISTORY ── */}
            <section className="space-y-4 border-t border-surface-border pt-12 mt-12">
                <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-brand-400" />
                    <h3 className="heading-3 uppercase tracking-widest text-[11px] font-black text-brand-400">Exercise Progression History</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Chart */}
                    <div className="lg:col-span-8 card overflow-hidden">
                        <div className="p-5 border-b border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <h4 className="text-base font-black text-fg tracking-tight">{selectedExercise || "Select an exercise"}</h4>
                                <p className="text-[10px] text-fg-muted font-bold uppercase tracking-wide mt-0.5">Performance curve over time</p>
                            </div>
                            {selectedExerciseStats && (
                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="text-center px-3 py-1.5 rounded-xl bg-warning/10 border border-warning/20">
                                        <p className="text-[9px] font-black text-warning/70 uppercase tracking-widest">Est. Max</p>
                                        <p className="text-sm font-black text-warning">{selectedExerciseStats.estimatedMax}<span className="text-[9px] ml-0.5 font-bold">kg</span></p>
                                    </div>
                                    <div className="text-center px-3 py-1.5 rounded-xl bg-brand-500/10 border border-brand-500/20">
                                        <p className="text-[9px] font-black text-brand-400/70 uppercase tracking-widest">Current Max</p>
                                        <p className="text-sm font-black text-brand-400">{selectedExerciseStats.currentMax}<span className="text-[9px] ml-0.5 font-bold">kg</span></p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-5 sm:p-6 bg-surface/10">
                            {selectedExercise ? (
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={exerciseHistory[selectedExercise] || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="exGrad" x1="0" x2="0" y1="0" y2="1">
                                                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                                            <XAxis dataKey="date" stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} />
                                            <YAxis stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                                            <Tooltip
                                                content={({ active, payload, label }) => {
                                                    if (active && payload && payload.length) {
                                                        return (
                                                            <ExerciseHistoryTooltipContent
                                                                label={label}
                                                                data={payload[0].payload}
                                                            />
                                                        );
                                                    }
                                                    return null;
                                                }}
                                             />
                                             <Area
                                                 type="monotone" dataKey="weight" stroke="#818cf8" strokeWidth={3}
                                                 fill="url(#exGrad)"
                                                 dot={{ r: 4, fill: "#818cf8", stroke: "#0F172A", strokeWidth: 2 }}
                                                 activeDot={{ r: 6, fill: "#a5b4fc", strokeWidth: 0 }}
                                                 animationDuration={800}
                                             />
                                             <Line 
                                                 type="monotone" 
                                                 dataKey="oneRM" 
                                                 stroke="#FACC15" 
                                                 strokeWidth={2} 
                                                 strokeDasharray="5 5" 
                                                 dot={false}
                                                 activeDot={false}
                                             />
                                         </AreaChart>
                                     </ResponsiveContainer>
                                 </div>
                             ) : (
                                 <div className="h-[300px] flex items-center justify-center text-sm text-fg-muted">
                                     No exercise history recorded for this client.
                                 </div>
                             )}
                         </div>
                     </div>

                     {/* Exercise Library */}
                     <div className="lg:col-span-4 card flex flex-col h-[412px] overflow-hidden">
                         <div className="p-4 border-b border-surface-border">
                             <div className="relative">
                                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-subtle" />
                                 <input
                                     type="text"
                                     className="pl-9 pr-4 py-2.5 w-full bg-surface-elevated border border-surface-border rounded-xl text-xs font-bold outline-none focus:border-brand-500/50 transition-all text-fg"
                                     placeholder="Search exercises..."
                                     value={exerciseSearchQuery}
                                     onChange={(e) => setExerciseSearchQuery(e.target.value)}
                                 />
                             </div>
                         </div>
                         <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
                             {exerciseListFiltered.length === 0 ? (
                                 <p className="text-xs text-fg-muted italic p-4 text-center">No exercises found.</p>
                             ) : (
                                 exerciseListFiltered.map(ex => {
                                     const hist = exerciseHistory[ex] || [];
                                     const latest = hist[hist.length - 1];
                                     const isActive = selectedExercise === ex;
                                     return (
                                         <button
                                             key={ex}
                                             onClick={() => setSelectedExercise(ex)}
                                             className={cn(
                                                 "w-full flex items-center justify-between p-3 rounded-xl transition-all text-left",
                                                 isActive ? "bg-brand-500/10 border border-brand-500/20" : "hover:bg-surface-elevated border border-transparent"
                                             )}
                                         >
                                             <div className="flex items-center gap-3 min-w-0">
                                                 <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", isActive ? "bg-brand-500 text-white" : "bg-surface-muted text-fg-subtle")}>
                                                     <Dumbbell className="w-3.5 h-3.5" />
                                                 </div>
                                                 <div className="min-w-0">
                                                     <p className={cn("text-xs font-black truncate", isActive ? "text-brand-400" : "text-fg")}>{ex}</p>
                                                     <p className="text-[10px] text-fg-muted truncate">Best: {latest?.weight}kg · {hist.length} sessions</p>
                                                 </div>
                                             </div>
                                             <ChevronRight className={cn("w-4 h-4 shrink-0 transition-opacity", isActive ? "text-brand-400 opacity-100" : "opacity-0")} />
                                         </button>
                                     );
                                 })
                             )}
                         </div>
                     </div>
                 </div>
             </section>

             {/* Danger Zone */}
             {canEdit && (
             <div className="border-t border-surface-border pt-12 mt-12">
                <div className="card p-6 border-danger-500/20 bg-danger-500/5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                        <div className="space-y-1">
                            <h4 className="text-sm font-black text-danger uppercase tracking-widest flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                Danger Zone
                            </h4>
                            <p className="text-xs text-fg-muted max-w-md mt-2">
                                Revoking this athlete&apos;s premium access will remove them from your stable and reset their status to Free. They will no longer see your assigned plans.
                            </p>
                        </div>

                        {!removing ? (
                            <button 
                                onClick={() => setRemoving(true)}
                                className="btn-secondary border-danger-500/30 text-danger hover:bg-danger-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest h-10 px-6"
                            >
                                Remove Client
                            </button>
                        ) : (
                            <div className="w-full sm:w-auto space-y-3 animate-fade-in">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">Confirm Athlete Email To Proceed</label>
                                    <input 
                                        type="email"
                                        placeholder={client.email}
                                        className="input input-sm border-danger-500/30 font-mono text-xs"
                                        value={confirmEmail}
                                        onChange={(e) => setConfirmEmail(e.target.value)}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={handleRemoveClient}
                                        disabled={updating || !confirmEmail}
                                        className="btn-primary bg-danger border-danger hover:bg-danger-600 shadow-glow-danger-sm flex-1 text-[10px] font-black uppercase tracking-widest h-10"
                                    >
                                        Authorize Removal
                                    </button>
                                    <button 
                                        onClick={() => { setRemoving(false); setConfirmEmail(""); }}
                                        className="btn-secondary flex-1 text-[10px] font-black uppercase tracking-widest h-10"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            )}

            {/* Quick Chat Slide-over Sheet */}
            {showQuickChat && (
                <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-fade-in"
                        onClick={() => setShowQuickChat(false)}
                    />
                    
                    {/* Drawer Content */}
                    <div className="relative w-full max-w-md h-full bg-surface-card border-l border-surface-border shadow-modal flex flex-col z-10 animate-slide-left">
                        {/* Header */}
                        <div className="p-4 border-b border-surface-border flex items-center justify-between bg-surface-muted/30">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center text-sm font-bold text-white shadow-glow-brand-sm shrink-0">
                                    {client.avatarUrl ? <img src={resolveUploadUrl(client.avatarUrl)} alt="avatar" className="w-full h-full object-cover rounded-xl" /> : getInitials(client.name)}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-sm text-fg truncate">{client.name}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className={cn("w-1.5 h-1.5 rounded-full", presence.color)} />
                                        <span className="text-[8px] text-fg-subtle font-black uppercase tracking-wider">{presence.text}</span>
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowQuickChat(false)}
                                className="btn-icon w-8 h-8 rounded-lg bg-surface hover:bg-surface-elevated text-fg-muted hover:text-fg transition-all"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        
                        {/* Messages Log */}
                        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar bg-surface/10">
                            {chatMessages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-60">
                                    <MessageSquare className="w-10 h-10 text-brand-400/50 mb-3" />
                                    <p className="text-xs font-black uppercase tracking-widest text-fg-subtle">No messages yet</p>
                                    <p className="text-[10px] text-fg-muted mt-1 max-w-[200px]">Send a note to keep your athlete on track.</p>
                                </div>
                            ) : (
                                chatMessages.map((msg) => {
                                    const isSelf = msg.sender.id === currentUserId;
                                    return (
                                        <div 
                                            key={msg.id} 
                                            className={cn("flex flex-col max-w-[80%] space-y-1", isSelf ? "ml-auto items-end" : "mr-auto items-start")}
                                        >
                                            <div className={cn(
                                                "p-3 rounded-2xl text-xs font-medium leading-relaxed shadow-sm",
                                                isSelf 
                                                    ? "bg-brand-500 text-white rounded-tr-none shadow-glow-brand-sm" 
                                                    : "bg-surface-elevated text-fg border border-surface-border rounded-tl-none"
                                            )}>
                                                {msg.content}
                                            </div>
                                            <span className="text-[8px] text-fg-subtle px-1">
                                                {formatDate(msg.createdAt)}
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        
                        {/* Input Footer */}
                        <div className="p-4 border-t border-surface-border bg-surface-card flex gap-2 items-center">
                            <input 
                                type="text"
                                className="input flex-1 h-10 text-xs bg-surface-muted/50 focus:border-brand-500/40 rounded-xl"
                                placeholder="Write instructions..."
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") sendChatMessage();
                                }}
                            />
                            <button 
                                onClick={sendChatMessage}
                                disabled={sendingChat || !chatInput.trim()}
                                className="btn-primary h-10 w-10 p-0 flex items-center justify-center rounded-xl shadow-glow-brand shrink-0"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
