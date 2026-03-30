import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { formatDate, cn } from "@/lib/utils";
import Link from "next/link";
import { ChevronLeft, Dumbbell, Clock, Zap, Video, FileText, Smile } from "lucide-react";
import { EditSessionButton } from "./EditSessionButton";

export default async function LogViewPage({ params }: { params: { logId: string } }) {
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    const actor = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!actor) redirect("/sign-in");

    const log = await prisma.workoutLog.findUnique({
        where: { id: params.logId },
        include: {
            user: { select: { id: true, coachId: true, name: true } },
            workout: true,
            sets: {
                include: { exercise: true },
                orderBy: [{ exercise: { order: 'asc' } }, { setNumber: 'asc' }],
            }
        }
    });

    if (!log) notFound();

    // Auth check: Owner, Coach of Owner, or Admin
    const isOwner = log.user.id === actor.id;
    const isCoachOfOwner = log.user.coachId === actor.id;
    const isAdmin = ["SUPER_ADMIN"].includes(actor.role);

    if (!isOwner && !isCoachOfOwner && !isAdmin) {
        redirect("/dashboard");
    }

    // Group sets by exercise
    const exercisesMap = new Map();
    log.sets.forEach(set => {
        if (!exercisesMap.has(set.exercise.id)) {
            exercisesMap.set(set.exercise.id, {
                name: set.exercise.name,
                muscleGroup: set.exercise.muscleGroup,
                sets: []
            });
        }
        exercisesMap.get(set.exercise.id).sets.push(set);
    });
    const groupedExercises = Array.from(exercisesMap.values());

    return (
        <div className="bg-surface min-h-screen pb-20">
            <TopBar title="Performance Archive" subtitle={formatDate(log.loggedAt)} />
            <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <button onClick={() => redirect("/dashboard")} className="btn-ghost btn-sm text-fg-subtle flex items-center gap-2">
                        <ChevronLeft className="w-4 h-4" />
                        Return
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">Origin:</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-brand-400 italic">{log.user.name}</span>
                        </div>
                        {isOwner && (
                            <EditSessionButton logId={log.id} workoutId={log.workoutId} />
                        )}
                    </div>
                </div>

                <div className="card p-8 bg-surface-card border-brand-500/20 shadow-glow-brand-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Zap className="w-4 h-4 text-brand-400" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-brand-500 italic">Verified Session</span>
                            </div>
                            <h2 className="text-3xl font-black text-fg tracking-tighter">{log.workout.name}</h2>
                        </div>
                        <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20 text-brand-400 shadow-glow-brand-sm">
                            <Clock className="w-7 h-7" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-surface-border">
                        <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Total Volume</p>
                            <p className="text-xl font-black text-fg italic">{log.sets.filter(s => s.isCompleted).reduce((acc, s) => acc + (s.weightKg || 0) * (s.reps || 0), 0).toLocaleString()} <span className="text-[10px] text-fg-subtle not-italic">KG</span></p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Time Logged</p>
                            <p className="text-xl font-black text-fg italic">{log.duration || "--"} <span className="text-[10px] text-fg-subtle not-italic">MINS</span></p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Sets</p>
                            <p className="text-xl font-black text-fg italic">{log.sets.length}</p>
                        </div>
                        <div className="space-y-1 text-right">
                            <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Feeling</p>
                            <div className="flex justify-end gap-0.5">
                                {[1,2,3,4,5].map(i => (
                                    <Smile key={i} className={cn("w-3.5 h-3.5", i <= (log.feeling || 0) ? "text-success fill-success/20" : "text-fg-subtle/20")} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {log.notes && (
                    <div className="card p-5 bg-surface-muted/30 border-dashed">
                        <div className="flex items-center gap-2 mb-2 text-fg-subtle">
                            <FileText className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Athlete Debrief</span>
                        </div>
                        <p className="text-sm text-fg-muted italic leading-relaxed">"{log.notes}"</p>
                    </div>
                )}

                <div className="space-y-6">
                    {groupedExercises.map((ex, idx) => (
                        <div key={idx} className="card p-6 border-brand-500/10">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-surface-muted border border-surface-border flex items-center justify-center text-brand-400">
                                        <Dumbbell className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-fg text-lg tracking-tight uppercase">{ex.name}</h3>
                                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg bg-surface-muted text-fg-subtle border border-surface-border">{ex.muscleGroup || "Targeted Area"}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-3">
                                <div className="grid grid-cols-5 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-fg-subtle border-b border-surface-border mb-3">
                                    <span className="col-span-1">SET</span>
                                    <span className="col-span-1 text-center">REPS</span>
                                    <span className="col-span-1 text-center">LOAD</span>
                                    <span className="col-span-1 text-center">RPE</span>
                                    <span className="col-span-1 text-right">MEDIA</span>
                                </div>
                                {ex.sets.map((set: any) => (
                                    <div key={set.id} className="space-y-3">
                                        <div className={cn(
                                            "grid grid-cols-5 px-3 py-3 text-sm items-center rounded-2xl group transition-all",
                                            set.isPR ? "bg-brand-500/5 border border-brand-500/20 shadow-glow-brand-sm" : "bg-surface-muted border border-transparent hover:border-surface-border"
                                        )}>
                                            <span className="col-span-1 font-black text-fg-subtle tracking-tighter">#{set.setNumber}</span>
                                            <span className="col-span-1 font-black text-center text-fg">{set.reps || "-"}</span>
                                            <span className="col-span-1 font-black text-center text-brand-400 italic">
                                                {set.weightKg ? `${set.weightKg}` : "-"} <span className="text-[9px] not-italic text-fg-subtle">KG</span>
                                            </span>
                                            <span className="col-span-1 font-black text-center text-warning italic">{set.rpe || "-"}</span>
                                            <div className="col-span-1 flex justify-end">
                                                {set.videoUrl && <Video className={cn("w-4 h-4", set.videoUrl ? "text-success animate-pulse" : "text-fg-subtle/20")} />}
                                            </div>
                                        </div>
                                        
                                        {set.videoUrl && (
                                            <div className="px-1">
                                                <div className="card p-1 bg-surface-muted rounded-3xl overflow-hidden border-2 border-surface-border">
                                                    <video 
                                                        src={set.videoUrl} 
                                                        controls 
                                                        className="w-full aspect-video rounded-2xl bg-black shadow-inner"
                                                        poster="/api/placeholder/400/225"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
