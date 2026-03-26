"use client";

import { useState } from "react";
import {
    Scale, Send, Check, Camera, TrendingUp, TrendingDown,
    Minus, Calendar, MessageSquare, CheckCircle2,
    Zap, Moon, Brain, Activity, ChevronDown, AlertCircle,
    Dumbbell, Flame, Edit2
} from "lucide-react";
import { formatDate, getWeekNumber, cn } from "@/lib/utils";
import { PremiumLockScreen } from "@/components/shared/PremiumLockScreen";

/* ─────────────────────────── Types ─────────────────────────── */
interface CheckIn {
    id: string; createdAt: string; weekNumber: number;
    bodyweightKg?: number | null; feedback: string; notes?: string | null;
    status: "PENDING" | "REVIEWED"; coachResponse?: string | null;
    respondedAt?: string | null;
    sleepRating?: number | null; stressRating?: number | null;
    energyRating?: number | null; intensityRating?: number | null;
    frontImageUrl?: string | null; sideImageUrl?: string | null;
    user?: { name: string; email: string };
}
interface Props {
    checkIns: CheckIn[]; isCoach: boolean; userRole: string;
    workoutsThisWeek: number; workoutsTarget: number;
}

/* ─────────────────── Rating bar component ───────────────────── */
const ENERGY_LABELS  = ["Low",    "Fair",   "Good",  "High",  "🔥 Peak"];
const SLEEP_LABELS   = ["Poor",   "Fair",   "Okay",  "Good",  "Great"];
const STRESS_LABELS  = ["None",   "Little", "Some",  "High",  "Max"];
const TRAIN_LABELS   = ["Skipped","Light",  "Solid", "Hard",  "Beast"];

function RatingBar({ icon: Icon, label, sublabels, value, onChange, inverse = false }: {
    icon: any; label: string; sublabels: string[];
    value: number; onChange: (v: number) => void; inverse?: boolean;
}) {
    // This function decides color based on the *currently selected value* for the *entire active portion*
    const getColor = (s: number, isActive: boolean, currentVal: number) => {
        if (!isActive) return "bg-surface-muted border-surface-border text-fg-subtle opacity-40";
        
        // Use the color of the final selected value for the entire line up to that point
        const target = currentVal || 0;
        if (inverse) {
            if (target <= 2) return "bg-success/30 border-success/60 text-success shadow-glow-success-sm";
            if (target === 3) return "bg-warning/30 border-warning/60 text-warning shadow-glow-warning-sm";
            return "bg-danger/30 border-danger/60 text-danger shadow-glow-danger-sm";
        }
        if (target <= 2) return "bg-danger/30 border-danger/60 text-danger shadow-glow-danger-sm";
        if (target === 3) return "bg-warning/30 border-warning/60 text-warning shadow-glow-warning-sm";
        return "bg-success/30 border-success/60 text-success shadow-glow-success-sm";
    };

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-fg-subtle" />
                    <span className="text-[11px] font-bold text-fg-muted uppercase tracking-widest">{label}</span>
                </div>
                <span className={cn(
                    "text-[11px] font-black px-2 py-0.5 rounded-full",
                    value > 0 ? "text-fg bg-surface-muted" : "text-fg-subtle"
                )}>
                    {value > 0 ? sublabels[value - 1] : "—"}
                </span>
            </div>
            <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map(s => (
                    <button
                        key={s} type="button"
                        onClick={() => onChange(s === value ? 0 : s)}
                        className={cn(
                            "flex-1 h-11 rounded-xl text-sm font-black border transition-all duration-200 active:scale-90",
                            getColor(s, s <= value, value)
                        )}
                    >
                        {s}
                    </button>
                ))}
            </div>
        </div>
    );
}

/* ─────────────────── Smart feedback generator ───────────────── */
function getSmartFeedback(energy: number, sleep: number, stress: number, training: number): { msg: string; color: string } | null {
    if (!energy && !sleep && !stress && !training) return null;
    const avg = [energy, sleep, training].filter(Boolean);
    const avgScore = avg.length ? avg.reduce((a, b) => a + b, 0) / avg.length : 0;
    const highStress = stress >= 4;
    const badSleep = sleep <= 2;
    const greatWeek = avgScore >= 4 && stress <= 2;

    if (greatWeek) return { msg: "🔥 Great week overall — keep it up!", color: "text-success bg-success/10 border-success/20 shadow-glow-success-sm" };
    if (highStress && badSleep) return { msg: "⚠️ High stress + poor sleep — recovery needs attention", color: "text-warning bg-warning/10 border-warning/20 shadow-glow-warning-sm" };
    if (highStress) return { msg: "😤 Stress is spiking — communicate this to your coach", color: "text-warning bg-warning/10 border-warning/20 shadow-glow-warning-sm" };
    if (badSleep) return { msg: "😴 Sleep is low — prioritise rest this week", color: "text-brand-400 bg-brand-950/40 border-brand-500/20 shadow-glow-brand-sm" };
    if (avgScore >= 3) return { msg: "💪 Solid effort this week", color: "text-brand-400 bg-brand-950/40 border-brand-500/20 shadow-glow-brand-sm" };
    return { msg: "📈 Keep pushing — every session counts", color: "text-fg-muted bg-surface-muted border-surface-border" };
}

/* ─────────────────── Previous check-in summary ─────────────── */
function PrevCheckInCard({ prev }: { prev: CheckIn }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="rounded-2xl border border-surface-border bg-surface-muted/30 overflow-hidden">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
                <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-fg-subtle" />
                    <span className="text-xs font-bold text-fg-muted">Week {prev.weekNumber} check-in</span>
                    {prev.bodyweightKg && (
                        <span className="text-xs font-black text-fg">{prev.bodyweightKg}kg</span>
                    )}
                </div>
                <ChevronDown className={cn("w-3.5 h-3.5 text-fg-subtle transition-transform", open && "rotate-180")} />
            </button>
            {open && (
                <div className="px-4 pb-4 space-y-3 border-t border-surface-border/50 pt-3 animate-fade-in">
                    {/* Mini ratings */}
                    <div className="flex flex-wrap gap-2">
                        {[
                            { l: "Energy", v: prev.energyRating },
                            { l: "Sleep", v: prev.sleepRating },
                            { l: "Stress", v: prev.stressRating },
                            { l: "Training", v: prev.intensityRating },
                        ].filter(r => r.v).map(r => (
                            <div key={r.l} className="flex items-center gap-1.5 px-3 py-1 bg-surface-card rounded-xl border border-surface-border font-black text-fg">
                                <span className="text-[10px] font-bold text-fg-subtle">{r.l}</span>
                                <span className="text-[10px]">{r.v}/5</span>
                            </div>
                        ))}
                    </div>
                    {/* Notes */}
                    {prev.feedback && (
                        <p className="text-xs text-fg-muted leading-relaxed italic border-l-2 border-surface-border pl-3">
                            "{prev.feedback}"
                        </p>
                    )}
                    {/* Coach response */}
                    {prev.coachResponse && (
                        <div className="bg-success/5 border border-success/20 rounded-xl p-3">
                            <p className="text-[10px] font-black text-success uppercase tracking-widest mb-1">Coach Feedback</p>
                            <p className="text-xs text-fg leading-relaxed">{prev.coachResponse}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ─────────────────── History item ──────────────────────────── */
function HistoryItem({ c, isCoach, onCoachRespond }: {
    c: CheckIn; isCoach: boolean;
    onCoachRespond?: (id: string, resp: string) => Promise<void>;
}) {
    const [open, setOpen] = useState(false);
    const [response, setResponse] = useState(c.coachResponse ?? "");
    const [saving, setSaving] = useState(false);

    return (
        <div className={cn(
            "rounded-2xl border overflow-hidden",
            c.status === "REVIEWED" ? "border-success/25 bg-success/3" : "border-surface-border bg-surface-card/60"
        )}>
            <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between p-4 text-left gap-3">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 text-center",
                        c.status === "REVIEWED" ? "bg-success/10 text-success" : "bg-brand-500/10 text-brand-400"
                    )}>
                        <span className="text-[8px] font-black uppercase leading-none">Wk</span>
                        <span className="text-base font-black leading-tight">{c.weekNumber}</span>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-fg">
                                {isCoach ? (c.user?.name ?? "Client") : `Week ${c.weekNumber}`}
                            </span>
                            <span className={cn(
                                "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                c.status === "REVIEWED"
                                    ? "text-success bg-success/10 border-success/20"
                                    : "text-brand-400 bg-brand-400/10 border-brand-400/20"
                            )}>{c.status}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-fg-muted font-medium">
                            <span>{formatDate(c.createdAt)}</span>
                            {c.bodyweightKg && <span className="font-black text-fg">{c.bodyweightKg}kg</span>}
                        </div>
                    </div>
                </div>
                <ChevronDown className={cn("w-4 h-4 text-fg-subtle shrink-0 transition-transform", open && "rotate-180")} />
            </button>

            {open && (
                <div className="px-4 pb-5 border-t border-surface-border/40 pt-4 space-y-4 animate-fade-in text-sm">
                    {/* Ratings */}
                    <div className="flex flex-wrap gap-2">
                        {[
                            { l: "Energy", v: c.energyRating },
                            { l: "Sleep", v: c.sleepRating },
                            { l: "Stress", v: c.stressRating },
                            { l: "Training", v: c.intensityRating },
                        ].filter(r => r.v).map(r => (
                            <div key={r.l} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-muted rounded-xl border border-surface-border font-black text-fg">
                                <span className="text-[10px] font-bold text-fg-subtle">{r.l}</span>
                                <span className="text-[10px]">{r.v}/5</span>
                            </div>
                        ))}
                    </div>

                    {/* Notes */}
                    {c.feedback && (
                        <div className="bg-surface-muted/40 p-3 rounded-xl border border-surface-border/30">
                            <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle mb-1">Notes</p>
                            <p className="text-sm text-fg leading-relaxed">{c.feedback}</p>
                        </div>
                    )}

                    {/* Photos */}
                    {(c.frontImageUrl || c.sideImageUrl) && (
                        <div className="flex gap-2">
                            {[c.frontImageUrl, c.sideImageUrl].filter(Boolean).map((url, i) => (
                                <img key={i} src={url!} alt="Progress" className="w-24 h-32 object-cover rounded-xl border border-surface-border" />
                            ))}
                        </div>
                    )}

                    {/* Coach area */}
                    <div className={cn(
                        "rounded-xl p-4 border space-y-3",
                        c.status === "REVIEWED" ? "bg-success/5 border-success/20" : "bg-brand-950/20 border-brand-500/20"
                    )}>
                        <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Coach Feedback</p>
                        {isCoach && c.status === "PENDING" ? (
                            <>
                                <textarea
                                    className="input h-24 resize-none text-sm py-3 leading-relaxed"
                                    placeholder="Write your feedback, adjustments, or guidance…"
                                    value={response}
                                    onChange={e => setResponse(e.target.value)}
                                />
                                <button
                                    onClick={async () => {
                                        setSaving(true);
                                        await onCoachRespond?.(c.id, response);
                                        setSaving(false);
                                    }}
                                    disabled={!response.trim() || saving}
                                    className="btn-primary w-full h-10 text-xs font-black uppercase tracking-widest"
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                                    {saving ? "Sending…" : "Send Feedback"}
                                </button>
                            </>
                        ) : (
                            <p className="text-sm text-fg leading-relaxed">
                                {c.coachResponse ?? (isCoach ? "No response yet." : "⏳ Awaiting coach review…")}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */
export function CheckInsClient({ checkIns: initial, isCoach, userRole, workoutsThisWeek, workoutsTarget }: Props) {
    const isPremium = ["PREMIUM", "COACH", "SUPER_ADMIN"].includes(userRole);
    const [checkIns, setCheckIns] = useState(initial);

    // Form
    const [editMode, setEditMode] = useState(false);
    const [checkInId, setCheckInId] = useState<string | null>(null);
    const [bodyweight, setBodyweight] = useState("");
    const [energy,   setEnergy]   = useState(0);
    const [sleep,    setSleep]    = useState(0);
    const [stress,   setStress]   = useState(0);
    const [training, setTraining] = useState(0);
    const [notes,    setNotes]    = useState("");
    const [frontImg, setFrontImg] = useState("");
    const [sideImg,  setSideImg]  = useState("");
    const [uploadingF, setUploadingF] = useState(false);
    const [uploadingS, setUploadingS] = useState(false);
    const [saving,   setSaving]   = useState(false);
    const [done,     setDone]     = useState(false);

    if (!isPremium && !isCoach) {
        return (
            <div className="p-4 sm:p-10">
                <PremiumLockScreen title="Weekly Check-ins" description="Weekly check-ins require Premium access." />
            </div>
        );
    }

    const currentWeek  = getWeekNumber();
    const existingEntry = checkIns.find(c => c.weekNumber === currentWeek);
    const hasThisWeek  = !!existingEntry && !editMode;
    const prevCheckIn  = checkIns.find(c => c.weekNumber !== currentWeek);
    const prevWeight   = checkIns.find(c => c.weekNumber !== currentWeek && c.bodyweightKg)?.bodyweightKg;
    const currentBw    = bodyweight ? parseFloat(bodyweight) : null;
    const weightDelta  = currentBw && prevWeight ? Math.round((currentBw - prevWeight) * 10) / 10 : null;
    const smartMsg     = getSmartFeedback(energy, sleep, stress, training);
    const consistencyPct = workoutsTarget > 0 ? Math.round((workoutsThisWeek / workoutsTarget) * 100) : 100;

    const startEditing = () => {
        if (!existingEntry) return;
        setCheckInId(existingEntry.id);
        setBodyweight(existingEntry.bodyweightKg?.toString() || "");
        setEnergy(existingEntry.energyRating || 0);
        setSleep(existingEntry.sleepRating || 0);
        setStress(existingEntry.stressRating || 0);
        setTraining(existingEntry.intensityRating || 0);
        setNotes(existingEntry.feedback || "");
        setFrontImg(existingEntry.frontImageUrl || "");
        setSideImg(existingEntry.sideImageUrl || "");
        setEditMode(true);
        setDone(false);
    };

    const uploadPhoto = async (file: File, setUrl: (u: string) => void, setLoading: (v: boolean) => void) => {
        setLoading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/upload", { method: "POST", body: fd });
            if (res.ok) { const d = await res.json(); setUrl(d.url); }
        } finally { setLoading(false); }
    };

    const submit = async () => {
        if (!notes.trim() && !bodyweight) return;
        setSaving(true);
        const method = editMode && checkInId ? "PATCH" : "POST";
        const res = await fetch("/api/checkins", {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: checkInId || undefined,
                bodyweightKg: currentBw ?? undefined,
                feedback: notes || "No additional notes.",
                weekNumber: currentWeek,
                energyRating:    energy   || undefined,
                sleepRating:     sleep    || undefined,
                stressRating:    stress   || undefined,
                intensityRating: training || undefined,
                frontImageUrl:   frontImg || undefined,
                sideImageUrl:    sideImg  || undefined,
            }),
        });
        if (res.ok) {
            const d = await res.json();
            if (editMode) {
                setCheckIns(prev => prev.map(c => c.id === checkInId ? d : c));
            } else {
                setCheckIns(prev => [d, ...prev]);
            }
            setDone(true);
            setEditMode(false);
            setCheckInId(null);
        } else {
            const err = await res.json();
            alert(err.error ?? "Failed to submit check-in");
        }
        setSaving(false);
    };

    const handleCoachRespond = async (id: string, response: string) => {
        const res = await fetch("/api/checkins", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, coachResponse: response, status: "REVIEWED" }),
        });
        if (res.ok) {
            const updated = await res.json();
            setCheckIns(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c));
        }
    };

    /* ── Coach view ── */
    if (isCoach) {
        return (
            <div className="space-y-4 animate-fade-in">
                <div className="mb-4">
                    <h2 className="text-xl font-black text-fg">Client Check-ins</h2>
                    <p className="text-xs text-fg-muted mt-0.5">
                        {checkIns.filter(c => c.status === "PENDING").length} pending · {checkIns.length} total
                    </p>
                </div>
                {checkIns.length === 0 ? (
                    <div className="card p-12 text-center border-dashed">
                        <MessageSquare className="w-8 h-8 text-fg-subtle mx-auto mb-3 opacity-30" />
                        <p className="font-bold text-fg text-sm">No check-ins yet</p>
                    </div>
                ) : checkIns.map(c => (
                    <HistoryItem key={c.id} c={c} isCoach onCoachRespond={handleCoachRespond} />
                ))}
            </div>
        );
    }

    /* ── Post-submit success ── */
    if (done) {
        return (
            <div className="space-y-5 animate-fade-in">
                {/* Success header */}
                <div className="card p-6 border-success/30 bg-success/5 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-success/15 border border-success/30 flex items-center justify-center mx-auto shadow-glow-success">
                        <Check className="w-8 h-8 text-success" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-fg">Check-in {editMode ? 'updated' : 'submitted'}!</h2>
                        <p className="text-sm text-fg-muted mt-1">Week {currentWeek} · Your coach will review soon.</p>
                    </div>

                    {/* Summary stats */}
                    <div className="flex flex-wrap gap-2 justify-center pt-2">
                        {weightDelta !== null && (
                            <div className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm border",
                                weightDelta < 0 ? "bg-success/10 border-success/30 text-success"
                                    : weightDelta > 0 ? "bg-warning/10 border-warning/30 text-warning"
                                    : "bg-surface-muted border-surface-border text-fg-muted"
                            )}>
                                {weightDelta < 0 ? <TrendingDown className="w-4 h-4" /> : weightDelta > 0 ? <TrendingUp className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                                {weightDelta > 0 ? "+" : ""}{weightDelta}kg from last week
                            </div>
                        )}
                        <div className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm border",
                            consistencyPct >= 80 ? "bg-success/10 border-success/30 text-success"
                                : consistencyPct >= 50 ? "bg-warning/10 border-warning/30 text-warning"
                                : "bg-surface-muted border-surface-border text-fg-muted"
                        )}>
                            <Dumbbell className="w-4 h-4" />
                            {workoutsThisWeek}/{workoutsTarget} sessions
                        </div>
                        {smartMsg && (
                            <div className={cn("px-4 py-2 rounded-xl font-medium text-sm border whitespace-nowrap", smartMsg.color)}>
                                {smartMsg.msg}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => setDone(false)}
                        className="btn-secondary h-11 px-6 text-xs font-black uppercase tracking-widest mt-2"
                    >
                        View Dashboard
                    </button>
                </div>

                {/* History summary card */}
                {checkIns.length > 0 && (
                    <div className="space-y-3 pt-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-fg-subtle px-1">Submission History</p>
                        {checkIns.map(c => (
                            <HistoryItem key={c.id} c={c} isCoach={false} />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    /* ── Already submitted this week (View Mode) ── */
    if (hasThisWeek) {
        const thisWeek = existingEntry!;
        return (
            <div className="space-y-5 animate-fade-in pb-10">
                <div className="card p-5 border-success/25 bg-success/5 space-y-4">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-success/15 flex items-center justify-center shrink-0 shadow-glow-success-sm border border-success/20">
                                <Check className="w-6 h-6 text-success" />
                            </div>
                            <div className="flex-1">
                                <p className="font-black text-fg">Week {currentWeek} Complete</p>
                                <p className="text-xs text-fg-muted mt-0.5">
                                    {thisWeek.status === "REVIEWED" ? "✅ Coach has reviewed" : "⏳ Awaiting coach review"}
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={startEditing}
                            className="btn-ghost flex items-center gap-2 text-[10px] font-black uppercase text-brand-400 hover:text-brand-300"
                        >
                            <Edit2 className="w-3.5 h-3.5" />
                            Edit
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="bg-surface- card/40 p-4 rounded-2xl border border-surface-border/50">
                            <p className="text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-1">Bodyweight</p>
                            <p className="text-xl font-black text-fg tracking-tight">{thisWeek.bodyweightKg ?? '--'}<span className="text-xs text-fg-muted ml-1">kg</span></p>
                            {weightDelta !== null && (
                                <p className={cn("text-[10px] font-bold mt-1", weightDelta < 0 ? "text-success" : weightDelta > 0 ? "text-warning" : "text-fg-muted")}>
                                    {weightDelta > 0 ? "+" : ""}{weightDelta}kg since last check-in
                                </p>
                            )}
                        </div>
                        <div className="bg-surface-card/40 p-4 rounded-2xl border border-surface-border/50">
                            <p className="text-[10px] font-black text-fg-subtle uppercase tracking-widest mb-1">Consistency</p>
                            <p className="text-xl font-black text-fg tracking-tight">{workoutsThisWeek}<span className="text-xs text-fg-muted ml-0.5">/{workoutsTarget}</span></p>
                            <p className="text-[10px] font-bold text-fg-muted mt-1 uppercase tracking-tighter">Sessions this week</p>
                        </div>
                    </div>

                    {thisWeek.coachResponse && (
                        <div className="p-4 rounded-2xl bg-success/10 border border-success/20 shadow-glow-success-sm animate-slide-up">
                            <p className="text-[10px] font-black uppercase tracking-widest text-success mb-1.5">Coach Response</p>
                            <p className="text-sm text-fg leading-relaxed font-medium">{thisWeek.coachResponse}</p>
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-fg-subtle px-1">Recent Activity</p>
                    {checkIns.map(c => (
                        <HistoryItem key={c.id} c={c} isCoach={false} />
                    ))}
                </div>
            </div>
        );
    }

    /* ── Form View (New or Edit) ── */
    return (
        <div className="space-y-4 animate-fade-in pb-10">

            <div className="flex items-center justify-between px-1">
                <div>
                    <h2 className="text-xl font-black text-fg tracking-tight">
                        {editMode ? `Edit Week ${currentWeek}` : "Weekly Check-in"}
                    </h2>
                    <p className="text-xs text-fg-muted mt-0.5">
                        {editMode ? "Modify your current submission" : `Week ${currentWeek} · Ready to log`}
                    </p>
                </div>
                <div className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border",
                    consistencyPct >= 80 ? "text-success bg-success/10 border-success/25 shadow-glow-success-sm"
                        : consistencyPct >= 50 ? "text-warning bg-warning/10 border-warning/25"
                        : "text-fg-muted bg-surface-muted border-surface-border"
                )}>
                    <Dumbbell className="w-3 h-3 inline mr-1" />
                    {workoutsThisWeek}/{workoutsTarget} sessions
                </div>
            </div>

            {/* 1. Bodyweight */}
            <div className="card p-5 space-y-4 border-surface-border hover:border-brand-500/20 transition-all group">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Scale className="w-4 h-4 text-brand-400 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-black text-fg uppercase tracking-wide">Status Check</span>
                    </div>
                    {prevWeight && (
                        <span className="text-[10px] text-fg-subtle font-black uppercase tracking-widest">
                            Baseline: {prevWeight}kg
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                        <input
                            type="number" step="0.1"
                            placeholder={prevWeight ? `${prevWeight}` : "00.0"}
                            className="input h-14 text-2xl font-black pr-10 bg-surface-muted/30 border-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                            value={bodyweight}
                            onChange={e => setBodyweight(e.target.value)}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-fg-subtle">kg</span>
                    </div>
                    {weightDelta !== null && (
                        <div className={cn(
                            "flex items-center gap-1.5 px-4 h-14 rounded-2xl font-black text-sm border shrink-0 transition-colors",
                            weightDelta < 0 ? "bg-success/10 border-success/30 text-success"
                                : weightDelta > 0 ? "bg-warning/10 border-warning/30 text-warning"
                                : "bg-surface-muted border-surface-border text-fg-muted"
                        )}>
                            {weightDelta < 0 ? <TrendingDown className="w-4 h-4" /> : weightDelta > 0 ? <TrendingUp className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                            {weightDelta > 0 ? "+" : ""}{weightDelta}
                        </div>
                    )}
                </div>
            </div>

            {/* 2. Ratings */}
            <div className="card p-5 space-y-5">
                <div className="flex items-center gap-2 mb-2">
                    <Flame className="w-4 h-4 text-brand-400" />
                    <span className="text-sm font-black text-fg uppercase tracking-wide">Performance Metrics</span>
                </div>
                <RatingBar icon={Zap}      label="Energy"   sublabels={ENERGY_LABELS} value={energy}   onChange={setEnergy} />
                <RatingBar icon={Moon}     label="Sleep"    sublabels={SLEEP_LABELS}  value={sleep}    onChange={setSleep} />
                <RatingBar icon={Brain}    label="Stress"   sublabels={STRESS_LABELS} value={stress}   onChange={setStress} inverse />
                <RatingBar icon={Activity} label="Training" sublabels={TRAIN_LABELS}  value={training} onChange={setTraining} />

                {smartMsg && (
                    <div className={cn("px-4 py-3 rounded-2xl text-[13px] font-bold border transition-all animate-slide-up", smartMsg.color)}>
                        {smartMsg.msg}
                    </div>
                )}
            </div>

            {/* 3. Notes */}
            <div className="card p-5 space-y-3">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-brand-400" />
                    <span className="text-sm font-black text-fg uppercase tracking-wide">Weekly Recap</span>
                    <span className="text-[10px] text-fg-subtle ml-auto font-black uppercase opacity-60">Required</span>
                </div>
                <textarea
                    className="input resize-none h-28 text-sm py-4 leading-relaxed bg-surface-muted/20 border-surface-border/50 focus:border-brand-500/30"
                    placeholder="Highlight wins, struggles, injuries, or how your energy fluctuated this week…"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                />
            </div>

            {/* 4. Photos */}
            <div className="card p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Camera className="w-4 h-4 text-brand-400" />
                        <span className="text-sm font-black text-fg uppercase tracking-wide">Evidence</span>
                    </div>
                    <span className="text-[10px] text-fg-subtle font-black uppercase opacity-60 tracking-widest">Visual Log</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { label: "Front View", url: frontImg, setUrl: setFrontImg, loading: uploadingF, setLoading: setUploadingF },
                        { label: "Side Profile", url: sideImg, setUrl: setSideImg, loading: uploadingS, setLoading: setUploadingS },
                    ].map(p => (
                        <label key={p.label} className={cn(
                            "relative flex flex-col items-center justify-center gap-2 h-40 rounded-2xl border-2 border-dashed cursor-pointer transition-all overflow-hidden bg-surface-muted/10",
                            p.url ? "border-brand-500/50" : "border-surface-border hover:border-fg-muted/40 hover:bg-surface-muted/20"
                        )}>
                            {p.url ? (
                                <>
                                    <img src={p.url} alt={p.label} className="absolute inset-0 w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/70 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button
                                            type="button"
                                            onClick={e => { e.preventDefault(); p.setUrl(""); }}
                                            className="text-[11px] font-black text-white bg-danger/80 px-4 py-2 rounded-xl active:scale-95 transition-transform"
                                        >Remove</button>
                                    </div>
                                    <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-success flex items-center justify-center shadow-glow-success-sm">
                                        <Check className="w-4 h-4 text-white" />
                                    </div>
                                </>
                            ) : p.loading ? (
                                <div className="w-6 h-6 border-3 border-brand-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <div className="w-10 h-10 rounded-full bg-surface-muted flex items-center justify-center mb-1">
                                        <Camera className="w-5 h-5 text-fg-subtle opacity-50" />
                                    </div>
                                    <span className="text-xs font-black text-fg-muted uppercase tracking-tighter">{p.label}</span>
                                    <span className="text-[9px] font-bold text-brand-400 uppercase tracking-widest">Tap to upload</span>
                                </>
                            )}
                            <input
                                type="file" accept="image/*"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={async e => {
                                    const file = e.target.files?.[0];
                                    if (file) await uploadPhoto(file, p.setUrl, p.setLoading);
                                }}
                            />
                        </label>
                    ))}
                </div>
            </div>

            {/* 5. Previous preview */}
            {prevCheckIn && !editMode && (
                <div className="space-y-2 pt-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-fg-subtle px-1">Retrospective</p>
                    <PrevCheckInCard prev={prevCheckIn} />
                </div>
            )}

            {/* 6. Footer actions */}
            <div className="flex flex-col gap-3 py-4">
                <button
                    onClick={submit}
                    disabled={!notes.trim() || saving}
                    className="btn-primary w-full h-16 text-sm font-black uppercase tracking-[0.2em] shadow-glow-brand disabled:opacity-40 transition-all hover:scale-[1.01] active:scale-[0.98]"
                >
                    {saving ? (
                        <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <div className="flex items-center justify-center gap-3">
                            <Send className="w-4 h-4" />
                            {editMode ? `Update Week ${currentWeek}` : `Finalize Week ${currentWeek}`}
                        </div>
                    )}
                </button>
                
                {editMode && (
                    <button 
                        onClick={() => {
                            setEditMode(false);
                            setCheckInId(null);
                        }}
                        className="btn-secondary h-12 text-xs font-black uppercase tracking-widest"
                    >
                        Cancel Editing
                    </button>
                )}
            </div>

            {!notes.trim() && (
                <div className="flex items-center justify-center gap-2 text-warning animate-pulse">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <p className="text-[10px] font-black uppercase tracking-widest leading-none">Recap notes are required to submit</p>
                </div>
            )}
        </div>
    );
}
