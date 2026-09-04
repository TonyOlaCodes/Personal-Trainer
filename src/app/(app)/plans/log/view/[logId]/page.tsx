import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/layout/TopBar";
import { formatDate, cn, calculateOneRM } from "@/lib/utils";
import { resolveUploadUrl } from "@/lib/uploadUrls";
import { Suspense } from "react";
import { Dumbbell, Clock, Zap, Video, FileText } from "lucide-react";
import { SessionActions } from "./SessionActions";
import { WorkoutFeelingEditor } from "@/components/shared/WorkoutFeelingEditor";
import { BackButton } from "@/components/shared/BackButton";
import { defaultHomeForRole } from "@/lib/roles";
import { canEditWorkoutLog, canViewWorkoutLog } from "@/lib/userProfile";
import { getNickname, pickDisplayName } from "@/lib/userNicknames";
import { groupLogSetsByExercise, logSetDisplayOrderBy } from "@/lib/logSetGrouping";
import { resolveLogSetExerciseName } from "@/lib/logSetExerciseName";
import { getLogExerciseNotes } from "@/lib/logExerciseNotes";
import { canonicalExerciseName } from "@/lib/exerciseCanonical";
import {
    ensureExerciseTrackingSchema,
    formatSetSummary,
    resolveTrackingSchema,
    usesStrengthOneRm,
    type ExerciseTrackingSchema,
} from "@/lib/exerciseTracking";
import { loadAllTimeMetricRecordBoards } from "@/lib/exerciseRecordHistory";
import { annotateMetricSessionPrsFromBoards } from "@/lib/annotateSessionPrs";
import { formatAlsoStrengthPrLabels, type PrKind } from "@/lib/exercisePrs";

export default async function LogViewPage({ params }: { params: Promise<{ logId: string }> }) {
    const { logId } = await params;
    const { userId } = await auth();
    if (!userId) redirect("/sign-in");

    await ensureExerciseTrackingSchema();

    const actor = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!actor) redirect("/sign-in");

    const log = await prisma.workoutLog.findUnique({
        where: { id: logId },
        include: {
            user: { select: { id: true, coachId: true, name: true, email: true, isDeleted: true, isDeactivated: true } },
            workout: true,
            sets: {
                include: { exercise: true },
                orderBy: logSetDisplayOrderBy,
            }
        }
    });

    if (!log) notFound();

    const canView = await canViewWorkoutLog(actor, log);
    if (!canView) {
        redirect(defaultHomeForRole(actor.role));
    }

    const isOwner = log.user.id === actor.id;
    const canEdit = await canEditWorkoutLog(actor, log);
    const athleteNickname = isOwner ? null : await getNickname(actor.id, log.user.id);
    const athleteDisplayName = pickDisplayName(
        log.user.name,
        log.user.email,
        athleteNickname,
        log.user.name || "Athlete"
    );

    const groupedExercises = groupLogSetsByExercise(log.sets, (set) =>
        canonicalExerciseName(resolveLogSetExerciseName(set)) || resolveLogSetExerciseName(set)
    );

    const schemaByExerciseId: Record<string, ExerciseTrackingSchema> = {};
    for (const ex of groupedExercises) {
        const muscleGroup = ex.muscleGroup ?? ex.sets[0]?.exercise?.muscleGroup ?? null;
        schemaByExerciseId[ex.exerciseId] = await resolveTrackingSchema(ex.name, muscleGroup);
    }

    const exerciseNotes = await getLogExerciseNotes(log.id);

    const recordBoards = await loadAllTimeMetricRecordBoards(log.userId, { excludeLogId: log.id });
    const flatSets = log.sets.map((set) => ({
        id: set.id,
        exerciseName: canonicalExerciseName(resolveLogSetExerciseName(set)) || resolveLogSetExerciseName(set),
        weightKg: set.weightKg,
        reps: set.reps,
        durationSec: set.durationSec,
        distanceMeters: set.distanceMeters,
        heightCm: set.heightCm,
        resistance: set.resistance,
        inclinePct: set.inclinePct,
        calories: set.calories,
        heartRate: set.heartRate,
        speedKph: set.speedKph,
        rpe: set.rpe,
        rir: set.rir,
        isWarmup: set.isWarmup,
        isCompleted: set.isCompleted,
    }));
    const prBySetId = annotateMetricSessionPrsFromBoards(
        flatSets,
        recordBoards,
        (name) => {
            const match = groupedExercises.find(
                (g) => g.name.toLowerCase() === name.toLowerCase()
            );
            if (match) return schemaByExerciseId[match.exerciseId];
            // Fallback: first schema (should rarely happen)
            return Object.values(schemaByExerciseId)[0];
        }
    );

    return (
        <div className="bg-surface min-h-screen pb-20">
            <TopBar title="Performance Archive" subtitle={formatDate(log.loggedAt)} />
            <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <Suspense fallback={<div className="btn-ghost btn-sm text-fg-subtle">Back</div>}>
                        <BackButton label="Back" />
                    </Suspense>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-fg-subtle">Origin:</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-brand-400 italic">{athleteDisplayName}</span>
                        </div>
                        {canEdit && (
                            <Suspense fallback={null}>
                                <SessionActions
                                    logId={log.id}
                                    workoutId={log.workoutId}
                                    loggedAt={log.loggedAt.toISOString()}
                                    clientId={isOwner ? undefined : log.user.id}
                                />
                            </Suspense>
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
                            <p className="text-xl font-black text-fg italic">{log.duration != null ? log.duration : "--"} <span className="text-[10px] text-fg-subtle not-italic">MINS</span></p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">Sets</p>
                            <p className="text-xl font-black text-fg italic">{log.sets.length}</p>
                        </div>
                        <div className="space-y-1">
                            <WorkoutFeelingEditor
                                logId={log.id}
                                initialFeeling={log.feeling}
                                canEdit={canEdit && log.status === "COMPLETED"}
                                align="right"
                            />
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
                    {groupedExercises.map((ex) => {
                        const schema = schemaByExerciseId[ex.exerciseId];
                        const show1rm = usesStrengthOneRm(schema);
                        return (
                        <div key={ex.exerciseId} className="card p-6 border-brand-500/10">
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

                            {exerciseNotes[ex.exerciseId] && (
                                <div className="mb-4 rounded-xl border border-surface-border/60 bg-surface-muted/30 px-3 py-2">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle mb-1">Exercise note</p>
                                    <p className="text-sm text-fg-muted leading-relaxed whitespace-pre-wrap">{exerciseNotes[ex.exerciseId]}</p>
                                </div>
                            )}
                            
                            <div className="space-y-3">
                                <div className="grid grid-cols-12 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-fg-subtle border-b border-surface-border mb-3">
                                    <span className="col-span-2">SET</span>
                                    <span className="col-span-6">PERFORMANCE</span>
                                    {show1rm && <span className="col-span-2 text-center">Est 1RM</span>}
                                    <span className={cn("text-right", show1rm ? "col-span-2" : "col-span-4")}>MEDIA</span>
                                </div>
                                {ex.sets.map((set) => {
                                    const summary = formatSetSummary(
                                        {
                                            weightKg: set.weightKg,
                                            reps: set.reps,
                                            rpe: set.rpe,
                                            durationSec: set.durationSec,
                                            distanceMeters: set.distanceMeters,
                                            heightCm: set.heightCm,
                                            resistance: set.resistance,
                                            inclinePct: set.inclinePct,
                                            calories: set.calories,
                                            heartRate: set.heartRate,
                                            speedKph: set.speedKph,
                                            rir: set.rir,
                                        },
                                        schema
                                    );
                                    const est1RM = show1rm && !set.isWarmup && set.weightKg && set.reps
                                        ? calculateOneRM(set.weightKg, set.reps)
                                        : null;
                                    const pr = prBySetId.get(set.id);
                                    const isPr = pr?.isPr ?? set.isPR;
                                    const alsoLabels = formatAlsoStrengthPrLabels(
                                        (pr?.alsoKinds ?? []).filter((k): k is PrKind =>
                                            k === "oneRm" || k === "weight" || k === "reps"
                                        ),
                                        set.reps
                                    );
                                    return (
                                    <div key={set.id} className="space-y-3">
                                        <div className={cn(
                                            "grid grid-cols-12 px-3 py-3 text-sm items-center rounded-2xl group transition-all",
                                            isPr ? "bg-brand-500/5 border border-brand-500/20 shadow-glow-brand-sm" : "bg-surface-muted border border-transparent hover:border-surface-border"
                                        )}>
                                            <span className="col-span-2 font-black text-fg-subtle tracking-tighter">#{set.setNumber}{set.isWarmup ? " W" : ""}</span>
                                            <span className="col-span-6 font-semibold text-fg leading-snug">
                                                {summary}
                                                {pr?.isPr && pr.label && (
                                                    <span className="ml-2 text-[10px] font-black uppercase tracking-wider text-warning whitespace-nowrap">
                                                        {pr.label}
                                                    </span>
                                                )}
                                                {alsoLabels.length > 0 && (
                                                    <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wide text-fg-subtle">
                                                        + {alsoLabels.join(" · ")}
                                                    </span>
                                                )}
                                            </span>
                                            {show1rm && (
                                                <span className={cn("col-span-2 font-black text-center", est1RM ? "text-warning-400" : "text-fg-subtle")}>
                                                    {est1RM ? `${est1RM}kg` : "—"}
                                                </span>
                                            )}
                                            <div className={cn("flex justify-end", show1rm ? "col-span-2" : "col-span-4")}>
                                                {set.videoUrl && <Video className={cn("w-4 h-4", set.videoUrl ? "text-success animate-pulse" : "text-fg-subtle/20")} />}
                                            </div>
                                        </div>
                                        
                                        {set.videoUrl && (
                                            <div className="px-1">
                                                <div className="card p-1 bg-surface-muted rounded-3xl overflow-hidden border-2 border-surface-border">
                                                    <video 
                                                        src={resolveUploadUrl(set.videoUrl)} 
                                                        controls 
                                                        className="w-full aspect-video rounded-2xl bg-black shadow-inner"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )})}
                            </div>
                        </div>
                    )})}
                </div>
            </div>
        </div>
    );
}
