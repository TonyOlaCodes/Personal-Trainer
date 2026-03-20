"use client";

import { useState, useEffect } from "react";
import { 
    Scale, MessageSquare, Lock, Plus, 
    ChevronDown, ChevronUp, Check, Star, 
    Clock, AlertCircle, Video, Play,
    User, Search, Filter, CheckCircle2,
    Send, Calendar, MoreVertical, ChevronRight
} from "lucide-react";
import { formatDate, getWeekNumber, cn } from "@/lib/utils";
import { PremiumLockScreen } from "@/components/shared/PremiumLockScreen";
import Link from "next/link";

interface CheckIn {
    id: string;
    createdAt: string;
    weekNumber: number;
    bodyweightKg?: number | null;
    feedback: string;
    notes?: string | null;
    videoUrl?: string | null;
    status: "PENDING" | "REVIEWED";
    coachResponse?: string | null;
    respondedAt?: string | null;
    user?: { name: string; email: string; id: string };
    sleepRating?: number | null;
    dietRating?: number | null;
    stressRating?: number | null;
    injuryRating?: number | null;
}

interface Props {
    checkIns: CheckIn[];
    isCoach: boolean;
    userRole: string;
}

export function CheckInsClient({ checkIns: initialCheckIns, isCoach, userRole }: Props) {
    const isPremium = ["PREMIUM", "COACH", "SUPER_ADMIN"].includes(userRole);
    const [checkIns, setCheckIns] = useState<CheckIn[]>(initialCheckIns);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [filter, setFilter] = useState<"ALL" | "PENDING" | "REVIEWED">("ALL");
    const [searchQuery, setSearchQuery] = useState("");

    // Form states
    const [editId, setEditId] = useState<string | null>(null);
    const [bodyweight, setBodyweight] = useState("");
    const [feedback, setFeedback] = useState("");
    const [notes, setNotes] = useState("");
    const [videoUrl, setVideoUrl] = useState("");
    const [sleepRating, setSleepRating] = useState(0);
    const [dietRating, setDietRating] = useState(0);
    const [stressRating, setStressRating] = useState(0);
    const [injuryRating, setInjuryRating] = useState(0);
    
    // Coach response states
    const [coachResponses, setCoachResponses] = useState<Record<string, string>>({});
    const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const handleEdit = (c: CheckIn) => {
        setEditId(c.id);
        setBodyweight(c.bodyweightKg?.toString() || "");
        setFeedback(c.feedback);
        setNotes(c.notes || "");
        setVideoUrl(c.videoUrl || "");
        setSleepRating(c.sleepRating || 0);
        setDietRating(c.dietRating || 0);
        setStressRating(c.stressRating || 0);
        setInjuryRating(c.injuryRating || 0);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const submitCheckIn = async () => {
        setSaving(true);
        const url = "/api/checkins";
        const method = editId ? "PATCH" : "POST";
        
        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: editId || undefined,
                bodyweightKg: bodyweight ? parseFloat(bodyweight) : undefined,
                feedback,
                notes: notes || undefined,
                videoUrl: videoUrl || undefined,
                weekNumber: getWeekNumber(),
                sleepRating: sleepRating || undefined,
                dietRating: dietRating || undefined,
                stressRating: stressRating || undefined,
                injuryRating: injuryRating || undefined,
            }),
        });
        if (res.ok) {
            window.location.reload();
        } else {
            setSaving(false);
            const err = await res.json();
            alert(err.error || "Failed to submit check-in");
        }
    };

    const handleCoachSubmit = async (checkInId: string) => {
        setSaving(true);
        const res = await fetch("/api/checkins", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: checkInId,
                coachResponse: coachResponses[checkInId],
                status: "REVIEWED"
            }),
        });
        if (res.ok) {
            const updated = await res.json();
            setCheckIns(prev => prev.map(c => c.id === checkInId ? { ...c, ...updated } : c));
            setSaving(false);
        }
    };

    if (!isPremium && !isCoach) {
        return (
            <div className="p-4 sm:p-10">
                <PremiumLockScreen 
                    title="Weekly Check-ins" 
                    description="Weekly check-ins are available to Premium members. Upgrade to get personalised feedback from your coach and track your progress."
                />
            </div>
        );
    }

    const filteredCheckIns = checkIns.filter(c => {
        const matchesFilter = filter === "ALL" || c.status === filter;
        const matchesSearch = !searchQuery || 
            (c.user?.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (c.feedback.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesFilter && matchesSearch;
    });

    const pendingCount = checkIns.filter(c => c.status === "PENDING").length;

    return (
        <div className="space-y-6 animate-fade-in p-4 sm:p-6 max-w-6xl mx-auto pb-24 lg:pb-12">
            {/* Header / Dashboard Stat */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h2 className="text-3xl font-black text-fg tracking-tighter">
                        {isCoach ? "Clinical Review" : "Weekly Performance"}
                    </h2>
                    <p className="text-sm text-fg-muted font-medium flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" />
                        Week {getWeekNumber()} · {isCoach ? `${pendingCount} submissions pending` : "Submit your progress"}
                    </p>
                </div>

                {isCoach ? (
                    <div className="flex items-center gap-2 bg-surface-muted/50 p-1 rounded-2xl border border-surface-border">
                        {(["ALL", "PENDING", "REVIEWED"] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                    filter === f ? "bg-brand-500 text-white shadow-glow-brand-sm" : "text-fg-subtle hover:text-fg"
                                )}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                ) : (
                    <button 
                        onClick={() => setShowForm(!showForm)} 
                        className="btn-primary shadow-glow-brand group h-11 px-6 text-sm font-black uppercase tracking-widest"
                    >
                        <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform" />
                        Log Week {getWeekNumber()}
                    </button>
                )}
            </div>

            {isCoach && (
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle group-focus-within:text-brand-400 transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Search clients or feedback content..."
                        className="input pl-11 h-12 bg-surface-card border-surface-border/50 focus:border-brand-500/50 shadow-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            )}

            {/* Submission Form */}
            {showForm && !isCoach && (
                <div className="card p-8 space-y-8 animate-slide-up border-brand-500/20 bg-surface-card shadow-glow-brand-sm">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black text-fg uppercase tracking-tighter">{editId ? "Update Performance Record" : "Log Weekly Progress"}</h3>
                        <div className="badge-brand text-[10px] font-bold">WEEK {getWeekNumber()}</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="label uppercase text-[10px] font-black tracking-widest text-brand-400">Biological Metrics</label>
                                <div className="relative">
                                    <Scale className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
                                    <input 
                                        type="number" 
                                        className="input pl-11 font-bold" 
                                        placeholder="Current Weight (kg)" 
                                        value={bodyweight}
                                        onChange={(e) => setBodyweight(e.target.value)} 
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="label uppercase text-[10px] font-black tracking-widest text-brand-400">Media Support</label>
                                <div className="relative">
                                    <Video className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
                                    <input 
                                        type="text" 
                                        className="input pl-11 text-xs" 
                                        placeholder="Workout Video URL (Google Drive, YouTube, etc.)" 
                                        value={videoUrl}
                                        onChange={(e) => setVideoUrl(e.target.value)} 
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <StarSelector label="Sleep Quality" value={sleepRating} onChange={setSleepRating} />
                            <StarSelector label="Dietary Control" value={dietRating} onChange={setDietRating} />
                            <StarSelector label="Stress Load" value={stressRating} onChange={setStressRating} inverse />
                            <StarSelector label="Pain / Injury" value={injuryRating} onChange={setInjuryRating} inverse />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="label uppercase text-[10px] font-black tracking-widest text-brand-400">Weekly Performance Feedback *</label>
                            <textarea
                                className="input h-32 resize-none py-4 text-sm leading-relaxed"
                                placeholder="Detail your training wins, intensity levels, and any recovery concerns..."
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="label uppercase text-[10px] font-black tracking-widest text-fg-subtle">Private Notes</label>
                            <textarea 
                                className="input h-20 resize-none py-3 text-xs" 
                                placeholder="Any context specifically for your coach..."
                                value={notes} 
                                onChange={(e) => setNotes(e.target.value)} 
                            />
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button onClick={() => { setShowForm(false); setEditId(null); }} className="btn-secondary h-12 flex-1">Discard Changes</button>
                        <button 
                            onClick={submitCheckIn} 
                            disabled={!feedback.trim() || saving} 
                            className="btn-primary h-12 flex-1 shadow-glow-brand"
                        >
                            {saving ? (editId ? "Updating Protocol..." : "Pushing submission...") : (editId ? "Save Corrections" : "Push Submission")}
                        </button>
                    </div>
                </div>
            )}

            {/* List / Cards */}
            <div className="grid grid-cols-1 gap-4">
                {filteredCheckIns.length === 0 ? (
                    <div className="card p-20 text-center space-y-4 border-dashed bg-transparent border-surface-border">
                        <div className="w-16 h-16 bg-surface-muted rounded-full flex items-center justify-center mx-auto mb-4">
                            <Filter className="w-8 h-8 text-fg-subtle/30" />
                        </div>
                        <h3 className="text-lg font-black text-fg uppercase tracking-widest">No Matches Found</h3>
                        <p className="text-sm text-fg-muted max-w-xs mx-auto">Try adjusting your filters or search query to find specific submissions.</p>
                    </div>
                ) : (
                    filteredCheckIns.map((c) => (
                        <div 
                            key={c.id} 
                            className={cn(
                                "card overflow-hidden transition-all duration-300 border",
                                expanded === c.id ? "ring-1 ring-brand-500/30 border-brand-500/20 bg-surface-card" : "bg-surface-card/60 hover:border-surface-border-hover border-surface-border"
                            )}
                        >
                            <button
                                className="w-full flex items-center justify-between p-6 text-left"
                                onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                            >
                                <div className="flex items-center gap-5">
                                    <div className={cn(
                                        "w-14 h-14 rounded-2xl flex flex-col items-center justify-center transition-colors shadow-sm",
                                        c.status === "PENDING" ? "bg-brand-950 text-brand-400" : "bg-success-950/30 text-success"
                                    )}>
                                        <span className="text-[10px] font-black uppercase tracking-tighter opacity-70">Week</span>
                                        <span className="text-xl font-black">{c.weekNumber}</span>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-3">
                                            <p className="font-black text-lg text-fg tracking-tight">{isCoach ? (c.user?.name || "Anonymous") : `Week ${c.weekNumber} Review`}</p>
                                            <div className="flex items-center gap-2">
                                                <div className={cn(
                                                    "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                                                    c.status === "PENDING" ? "bg-brand-400/10 text-brand-400 border border-brand-400/20" : "bg-success-500/10 text-success border border-success-500/20"
                                                )}>
                                                    {c.status}
                                                </div>
                                                {(!isCoach && c.status === "PENDING") && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleEdit(c); }}
                                                        className="text-[8px] font-black uppercase tracking-widest text-brand-400 hover:text-white transition-colors underline underline-offset-2"
                                                    >
                                                        Edit
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] text-fg-muted font-bold uppercase tracking-wide">
                                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(c.createdAt)}</span>
                                            {c.bodyweightKg && <span className="flex items-center gap-1 text-fg"><Scale className="w-3 h-3" /> {c.bodyweightKg}kg</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    {c.videoUrl && <div className="w-8 h-8 rounded-full bg-brand-400/10 flex items-center justify-center text-brand-400"><Video className="w-4 h-4" /></div>}
                                    <div className={cn("p-2 rounded-xl transition-transform", expanded === c.id ? "rotate-180 bg-brand-400/10 text-brand-400" : "text-fg-subtle")}>
                                        <ChevronDown className="w-5 h-5" />
                                    </div>
                                </div>
                            </button>

                            {expanded === c.id && (
                                <div className="px-6 pb-8 space-y-8 animate-slide-up border-t border-surface-border/50 pt-8">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <div className="space-y-3">
                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-400">Weekly Narrative</h4>
                                                <p className="text-sm text-fg-subtle leading-relaxed bg-surface-muted/30 p-4 rounded-2xl border border-surface-border/20">
                                                    {c.feedback}
                                                </p>
                                            </div>
                                            {c.notes && (
                                                <div className="space-y-3">
                                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">Contextual Notes</h4>
                                                    <p className="text-xs text-fg-muted italic border-l-2 border-surface-border pl-4">{c.notes}</p>
                                                </div>
                                            )}
                                            {c.videoUrl && (
                                                <div className="space-y-3">
                                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-brand-400">Workout Analysis</h4>
                                                    <Link 
                                                        href={c.videoUrl} 
                                                        target="_blank"
                                                        className="flex items-center justify-between p-4 bg-gradient-to-r from-brand-950/20 to-transparent border border-brand-500/20 rounded-2xl hover:border-brand-500/40 transition-all group"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-xl bg-brand-400 flex items-center justify-center shadow-glow-brand-sm group-hover:scale-110 transition-transform">
                                                                <Play className="w-4 h-4 text-white fill-current" />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-black text-fg uppercase tracking-wide">Review Training Clips</p>
                                                                <p className="text-[10px] text-fg-muted">External link provided by client</p>
                                                            </div>
                                                        </div>
                                                        <ChevronRight className="w-4 h-4 text-brand-400" />
                                                    </Link>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-8">
                                            <div className="grid grid-cols-2 gap-3">
                                                <RatingDisplay label="Sleep" val={c.sleepRating} />
                                                <RatingDisplay label="Diet" val={c.dietRating} />
                                                <RatingDisplay label="Stress" val={c.stressRating} inverse />
                                                <RatingDisplay label="Injury" val={c.injuryRating} inverse />
                                            </div>

                                            {/* Coach Interaction Area */}
                                            <div className={cn(
                                                "p-6 rounded-3xl space-y-4 border transition-all duration-500",
                                                c.status === "REVIEWED" ? "bg-success-950/10 border-success-500/20" : "bg-brand-950/10 border-brand-500/20 shadow-glow-brand-sm"
                                            )}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className={cn("w-2 h-2 rounded-full", c.status === "REVIEWED" ? "bg-success animate-pulse" : "bg-brand-400 animate-pulse")} />
                                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-fg">Coach Directive</h4>
                                                    </div>
                                                    {c.respondedAt && <p className="text-[8px] font-bold text-fg-subtle uppercase">{formatDate(c.respondedAt)}</p>}
                                                </div>

                                                {(isCoach && (c.status === "PENDING" || editingReviewId === c.id)) ? (
                                                    <>
                                                        <textarea 
                                                            className="input bg-surface-card h-32 text-xs py-3 leading-relaxed border-none focus:ring-1 focus:ring-brand-500/40"
                                                            placeholder="Enter directive, form adjustments, or plan changes here..."
                                                            value={coachResponses[c.id] || ""}
                                                            onChange={(e) => setCoachResponses(prev => ({ ...prev, [c.id]: e.target.value }))}
                                                        />
                                                        <div className="flex gap-2">
                                                            <button 
                                                                onClick={() => handleCoachSubmit(c.id)}
                                                                disabled={!coachResponses[c.id] || saving}
                                                                className="btn-primary flex-1 h-11 text-[10px] font-bold uppercase tracking-widest shadow-glow-brand"
                                                            >
                                                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                                                {c.status === "REVIEWED" ? "Update Review" : "Confirm Review & Sign Off"}
                                                            </button>
                                                            {editingReviewId === c.id && (
                                                                <button 
                                                                    onClick={() => setEditingReviewId(null)}
                                                                    className="btn-secondary h-11 px-4 text-[10px] font-bold uppercase"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            )}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="space-y-4">
                                                        <div className="flex items-start justify-between gap-4">
                                                            <p className="text-sm text-fg leading-relaxed flex-1">
                                                                {c.coachResponse || (isCoach ? "No feedback provided yet." : "Waiting for coach to review...")}
                                                            </p>
                                                            {isCoach && c.status === "REVIEWED" && (
                                                                <button 
                                                                    onClick={() => {
                                                                        setEditingReviewId(c.id);
                                                                        setCoachResponses(prev => ({ ...prev, [c.id]: c.coachResponse || "" }));
                                                                    }}
                                                                    className="btn-ghost btn-sm text-fg-subtle hover:text-brand-400"
                                                                >
                                                                    Edit
                                                                </button>
                                                            )}
                                                        </div>
                                                        {c.status === "REVIEWED" && (
                                                            <div className="flex items-center gap-2 pt-2 border-t border-success-500/10">
                                                                <Check className="w-3 h-3 text-success" />
                                                                <span className="text-[10px] font-black text-success uppercase tracking-wider">Protocol Confirmed</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

function StarSelector({ label, value, onChange, inverse = false }: { label: string, value: number, onChange: (v: number) => void, inverse?: boolean }) {
    const labels = inverse 
        ? ["None", "Minor", "Manageable", "Significant", "Severe"] 
        : ["Poor", "Fair", "Good", "Great", "Elite"];
    
    return (
        <div className="bg-surface-muted/30 p-4 rounded-2xl border border-surface-border/50">
            <div className="flex justify-between items-center mb-3">
                <label className="text-[10px] font-black text-fg-subtle uppercase tracking-widest">{label}</label>
                <span className="text-[9px] font-black text-brand-400 bg-brand-400/10 px-2 py-0.5 rounded-full">{value > 0 ? labels[value - 1] : "--"}</span>
            </div>
            <div className="flex justify-between">
                {[1, 2, 3, 4, 5].map((s) => (
                    <button
                        key={s}
                        type="button"
                        onClick={() => onChange(s)}
                        className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center transition-all border",
                            s <= value ? "bg-brand-500 border-brand-500 text-white shadow-glow-brand-sm" : "bg-surface-card border-surface-border text-fg-subtle hover:border-brand-500/50"
                        )}
                    >
                        <Star className={cn("w-3.5 h-3.5", s <= value && "fill-current")} />
                    </button>
                ))}
            </div>
        </div>
    );
}

function RatingDisplay({ label, val, inverse = false }: { label: string, val?: number | null, inverse?: boolean }) {
    if (!val) return (
         <div className="bg-surface-muted/20 p-3 rounded-2xl border border-surface-border/30 opacity-40">
            <p className="text-[9px] text-fg-subtle uppercase font-black tracking-widest mb-1">{label}</p>
            <p className="text-xs font-bold text-fg-muted">N/A</p>
         </div>
    );
    const colors = inverse 
        ? ["text-success", "text-success/80", "text-warning", "text-danger/80", "text-danger"]
        : ["text-danger", "text-warning", "text-success/80", "text-success", "text-brand-400"];

    return (
        <div className="bg-surface-muted/20 p-3 rounded-2xl border border-surface-border/30">
            <p className="text-[9px] text-fg-subtle uppercase font-black tracking-widest mb-1">{label}</p>
            <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className={cn("w-1 h-1 rounded-full", i <= val ? "bg-brand-400 shadow-glow-brand-xs" : "bg-surface-border")} />
                    ))}
                </div>
                <span className={cn("text-[10px] font-black", colors[val-1])}>{val}/5</span>
            </div>
        </div>
    );
}
