"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
    Timer, Flame, Check, HelpCircle,
    Trash2, Plus, InfoIcon, Award, Play, Zap, X, ChevronLeft, NotebookPen
} from "lucide-react";
import { cn, generateId, formatDate, isSameCalendarDay, parseLogDate, toDateKey, toLoggedAtIso, calculateOneRM } from "@/lib/utils";
import { appendReturnTo, getReturnToFromSearchParams } from "@/lib/navigation";
import { notifyWorkoutStatsChanged } from "@/lib/workoutStatsRefresh";
import { ExerciseAutocomplete } from "@/components/shared/ExerciseAutocomplete";
import { WorkoutFeelingPicker } from "@/components/shared/WorkoutFeelingPicker";
import {
    SetMetricHeaders,
    SetMetricInputs,
    emptySetMetrics,
    type SetMetricStrings,
} from "@/components/workout/SetMetricInputs";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useIsolateScroll } from "@/hooks/useIsolateScroll";
import { useVisualViewport } from "@/hooks/useVisualViewportHeight";
import { exerciseIdentityKey } from "@/lib/exerciseIdentity";
import { parseOptionalNumber } from "@/lib/numericValue";
import {
    EMPTY_EXERCISE_RECORDS,
    evaluateLiveExercisePrs,
    formatAlsoStrengthPrLabels,
    type ExerciseRecords,
    type PreviousSessionPerformance,
    type PreviousSet,
    type SetPrResult,
} from "@/lib/exercisePrs";
import {
    coerceSetMetrics,
    formatSetSummary,
    guessTrackingSchema,
    hasPerformedMetrics,
    usesStrengthOneRm,
    type ExerciseTrackingSchema,
    type TrackingFieldKey,
} from "@/lib/exerciseTracking";
import {
    cloneMetricRecords,
    EMPTY_METRIC_RECORDS,
    evaluateMetricAwarePr,
    applySetToMetricRecords,
    type MetricExerciseRecords,
    type MetricPrResult,
} from "@/lib/exerciseTracking/prs";
import { EXERCISE_NOTE_MAX_LENGTH } from "@/lib/logExerciseNotesShared";
import { buildWorkoutMuscleBreakdown } from "@/lib/exerciseMuscles";
import { MuscleMap, MuscleChips } from "@/components/shared/MuscleMap";
import type { MuscleTargetEntry } from "@/lib/muscleTargetEntries";
import {
    ActiveSessionConflictModal,
    parseActiveSessionConflict,
    type ConflictingActiveSession,
} from "@/components/shared/ActiveSessionConflictModal";
interface Exercise {
    id: string;
    name: string;
    sets: number;
    reps: string;
    weightTargetKg?: number | null;
    targetDurationSec?: number | null;
    targetDistanceMeters?: number | null;
    targetHeightCm?: number | null;
    notes?: string | null;
    order?: number;
    muscleGroup?: string | null;
    setTargets?: Array<{
        setNumber: number;
        weightKg?: number | null;
        reps?: number | null;
        durationSec?: number | null;
        distanceMeters?: number | null;
        heightCm?: number | null;
        rpe?: number | null;
        resistance?: number | null;
        inclinePct?: number | null;
    }>;
}

interface Workout {
    id: string;
    name: string;
    exercises: Exercise[];
}

interface SetLog extends SetMetricStrings {
    setNumber: number;
    isCompleted: boolean;
    isWarmup: boolean;
    videoUrl?: string;
}

interface ActiveLogSet {
    exerciseId: string;
    exercise?: Exercise | null;
    setNumber: number;
    reps?: number | null;
    weightKg?: number | null;
    rpe?: number | null;
    durationSec?: number | null;
    distanceMeters?: number | null;
    heightCm?: number | null;
    resistance?: number | null;
    inclinePct?: number | null;
    calories?: number | null;
    heartRate?: number | null;
    speedKph?: number | null;
    rir?: number | null;
    isCompleted?: boolean | null;
    isWarmup?: boolean | null;
    videoUrl?: string | null;
}

function optionalNumToString(value?: number | null): string {
    return value != null && Number.isFinite(value) ? String(value) : "";
}

function parseOptionalFloat(value: string): number | undefined {
    if (!value.trim()) return undefined;
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : undefined;
}

function setLogToPayloadMetrics(set: SetLog) {
    return {
        reps: set.reps || undefined,
        weightKg: parseOptionalFloat(set.weightKg),
        rpe: set.rpe ? parseInt(set.rpe, 10) || undefined : undefined,
        durationSec: parseOptionalFloat(set.durationSec),
        distanceMeters: parseOptionalFloat(set.distanceMeters),
        heightCm: parseOptionalFloat(set.heightCm),
        resistance: parseOptionalFloat(set.resistance),
        inclinePct: parseOptionalFloat(set.inclinePct),
        calories: parseOptionalFloat(set.calories),
        heartRate: parseOptionalFloat(set.heartRate),
        speedKph: parseOptionalFloat(set.speedKph),
        rir: parseOptionalFloat(set.rir),
    };
}

function activeSetToSetLog(s: ActiveLogSet): SetLog {
    return {
        setNumber: s.setNumber,
        ...emptySetMetrics(),
        reps: s.reps ?? 0,
        weightKg: optionalNumToString(s.weightKg),
        rpe: optionalNumToString(s.rpe),
        durationSec: optionalNumToString(s.durationSec),
        distanceMeters: optionalNumToString(s.distanceMeters),
        heightCm: optionalNumToString(s.heightCm),
        resistance: optionalNumToString(s.resistance),
        inclinePct: optionalNumToString(s.inclinePct),
        calories: optionalNumToString(s.calories),
        heartRate: optionalNumToString(s.heartRate),
        speedKph: optionalNumToString(s.speedKph),
        rir: optionalNumToString(s.rir),
        isCompleted: s.isCompleted ?? true,
        isWarmup: s.isWarmup ?? false,
        videoUrl: s.videoUrl ?? undefined,
    };
}

function blankSetLog(setNumber: number, seed?: Partial<SetMetricStrings>): SetLog {
    return {
        setNumber,
        ...emptySetMetrics(),
        ...seed,
        isCompleted: false,
        isWarmup: false,
    };
}

function getSchemaForExercise(
    ex: Pick<Exercise, "id" | "name" | "muscleGroup">,
    trackingSchemas: Record<string, ExerciseTrackingSchema>
): ExerciseTrackingSchema {
    return (
        trackingSchemas[ex.id] ||
        trackingSchemas[exerciseIdentityKey(ex.name)] ||
        guessTrackingSchema(ex.name, ex.muscleGroup)
    );
}

function sortWorkoutExercises(exercises: Exercise[]): Exercise[] {
    return exercises
        .slice()
        .map((exercise, index) => ({ exercise, index }))
        .sort((a, b) => {
            const orderA = a.exercise.order ?? a.index;
            const orderB = b.exercise.order ?? b.index;
            if (orderA !== orderB) return orderA - orderB;
            return a.index - b.index;
        })
        .map(({ exercise }) => exercise);
}

function resolvePersistedExerciseOrderValue(exercise: Exercise | undefined, listIndex: number): number | undefined {
    if (typeof exercise?.order === "number" && exercise.order >= 0) return exercise.order;
    return listIndex >= 0 ? listIndex : undefined;
}

function buildInitialLogs(exercises: Exercise[]): Record<string, SetLog[]> {
    const initialLogs: Record<string, SetLog[]> = {};
    exercises.forEach((ex) => {
        initialLogs[ex.id] = Array.from({ length: ex.sets }, (_, i) => blankSetLog(i + 1));
    });
    return initialLogs;
}

interface InitialActiveLog {
    id: string;
    loggedAt: string;
    duration?: number | null;
    updatedAt?: string;
    sets: ActiveLogSet[];
}

type PendingProgressSave = {
    logs: Record<string, SetLog[]>;
    exercises?: Exercise[];
    startTimeOverride?: number;
};

const WORKOUT_SET_INPUT_ATTR = "data-workout-set-input";

function isWorkoutSetInputFocused() {
    if (typeof document === "undefined") return false;
    const el = document.activeElement;
    return el instanceof HTMLElement && el.hasAttribute(WORKOUT_SET_INPUT_ATTR);
}

function remoteUpdatedAtMs(value?: string | Date | null): number {
    if (!value) return 0;
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : 0;
}

function readStoredStartTime(localStorageKey: string): number | null {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem(localStorageKey);
    if (!stored) return null;
    const parsed = Number(stored);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
}

function persistStartTime(localStorageKey: string, startTime: number) {
    if (typeof window !== "undefined") {
        localStorage.setItem(localStorageKey, String(startTime));
    }
}

/** loggedAt is the scheduled calendar day (noon), not when the user started — never use it for the timer. */
function resolveWorkoutStartTime(
    localStorageKey: string,
    opts?: { durationMinutes?: number | null }
): number {
    const stored = readStoredStartTime(localStorageKey);
    if (stored) return stored;

    if (opts?.durationMinutes && opts.durationMinutes > 0) {
        const fromDuration = Date.now() - opts.durationMinutes * 60000;
        persistStartTime(localStorageKey, fromDuration);
        return fromDuration;
    }

    const now = Date.now();
    persistStartTime(localStorageKey, now);
    return now;
}

function restoreSessionState(
    active: InitialActiveLog,
    fallbackExercises: Exercise[],
    localStorageKey: string
) {
    const restored: Record<string, SetLog[]> = {};
    const reconstructedExercises: Exercise[] = [];

    active.sets.forEach((s) => {
        const ex = s.exercise;
        if (ex && !reconstructedExercises.some((e) => e.id === ex.id)) {
            reconstructedExercises.push({
                id: ex.id,
                name: ex.name,
                sets: ex.sets || 1,
                reps: ex.reps || "10",
                weightTargetKg: ex.weightTargetKg,
                targetDurationSec: ex.targetDurationSec,
                targetDistanceMeters: ex.targetDistanceMeters,
                targetHeightCm: ex.targetHeightCm,
                notes: ex.notes,
                order: ex.order ?? 0,
                muscleGroup: ex.muscleGroup ?? null,
            });
        }

        if (!restored[s.exerciseId]) restored[s.exerciseId] = [];
        restored[s.exerciseId].push(activeSetToSetLog(s));
    });

    reconstructedExercises.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const restoredById = new Map(reconstructedExercises.map((ex) => [ex.id, ex]));
    const mergedExercises: Exercise[] = [];
    const seenExerciseIds = new Set<string>();

    for (const ex of fallbackExercises) {
        const restored = restoredById.get(ex.id);
        if (restored) {
            mergedExercises.push({ ...ex, ...restored, order: ex.order ?? restored.order });
            seenExerciseIds.add(ex.id);
        }
    }
    for (const ex of reconstructedExercises) {
        if (!seenExerciseIds.has(ex.id)) {
            mergedExercises.push(ex);
        }
    }

    const startTime = resolveWorkoutStartTime(localStorageKey, {
        durationMinutes: active.duration,
    });

    return {
        logs: Object.keys(restored).length > 0 ? restored : buildInitialLogs(fallbackExercises),
        exercises: sortWorkoutExercises(mergedExercises.length > 0 ? mergedExercises : fallbackExercises),
        startTime,
        activeLogId: active.id,
    };
}

interface Props {
    workout: Workout;
    trackingSchemas?: Record<string, ExerciseTrackingSchema>;
    exerciseMedia?: Record<string, ExercisePreviewMedia>;
    logDate?: string;
    clientId?: string;
    clientName?: string;
    /** Most recent session each exercise was actually performed, keyed by exercise identity. */
    previousSessions?: Record<string, PreviousSessionPerformance>;
    /** All-time records per exercise identity, excluding the session being logged. */
    exerciseRecords?: Record<string, ExerciseRecords>;
    /** Dictionary muscle targets keyed by exercise identity. */
    muscleTargetsByKey?: Record<string, MuscleTargetEntry[]>;
    /** Saved per-exercise notes for a resumed session, keyed by exercise id. */
    initialExerciseNotes?: Record<string, string>;
    initialActiveLog?: InitialActiveLog | null;
    showWorkoutInputHint?: boolean;
}

type ExercisePreviewMedia = {
    videoUrl?: string | null;
    instructions?: string | null;
    thumbnailUrl?: string | null;
};

function getYouTubeVideoId(url: string) {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, "").replace(/^m\./, "");

        if (host === "youtube.com" || host === "youtube-nocookie.com") {
            const pathParts = parsed.pathname.split("/").filter(Boolean);
            return parsed.searchParams.get("v")
                || (["embed", "shorts", "live"].includes(pathParts[0]) ? pathParts[1] : null);
        }
        if (host === "youtu.be") {
            return parsed.pathname.split("/").filter(Boolean)[0] || null;
        }
        return null;
    } catch {
        return null;
    }
}

function getEmbedUrl(url: string, autoplay = false) {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, "").replace(/^m\./, "");
        const youtubeId = getYouTubeVideoId(url);

        if (youtubeId) {
            return `https://www.youtube-nocookie.com/embed/${youtubeId}?playsinline=1&rel=0${autoplay ? "&autoplay=1" : ""}`;
        }
        if (host === "vimeo.com" || host === "player.vimeo.com") {
            const pathParts = parsed.pathname.split("/").filter(Boolean);
            const id = host === "player.vimeo.com" && pathParts[0] === "video" ? pathParts[1] : pathParts[0];
            return id ? `https://player.vimeo.com/video/${id}?playsinline=1${autoplay ? "&autoplay=1" : ""}` : url;
        }
        return url;
    } catch {
        return url;
    }
}

function getVideoThumbnailUrl(url: string, thumbnailUrl?: string | null) {
    if (thumbnailUrl) return thumbnailUrl;
    const youtubeId = getYouTubeVideoId(url);
    return youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : null;
}

function isDirectVideo(url: string) {
    try {
        return /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(new URL(url).pathname);
    } catch {
        return /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url);
    }
}

function formatTargetWeight(weight?: number | null) {
    if (weight == null || weight <= 0) return "";
    return Number.isInteger(weight) ? String(weight) : weight.toFixed(1).replace(/\.0$/, "");
}

function hasPerformedSetData(set: SetLog, schema: ExerciseTrackingSchema) {
    return hasPerformedMetrics(
        coerceSetMetrics({
            weightKg: parseOptionalFloat(set.weightKg),
            reps: set.reps,
            rpe: set.rpe ? parseInt(set.rpe, 10) : undefined,
            durationSec: parseOptionalFloat(set.durationSec),
            distanceMeters: parseOptionalFloat(set.distanceMeters),
            heightCm: parseOptionalFloat(set.heightCm),
            resistance: parseOptionalFloat(set.resistance),
            inclinePct: parseOptionalFloat(set.inclinePct),
            calories: parseOptionalFloat(set.calories),
            heartRate: parseOptionalFloat(set.heartRate),
            speedKph: parseOptionalFloat(set.speedKph),
            rir: parseOptionalFloat(set.rir),
        }),
        schema
    );
}

function getExerciseTargetSummary(ex: Exercise, schema: ExerciseTrackingSchema) {
    const parts = [`${ex.sets} sets`];
    if (usesStrengthOneRm(schema) || schema.fields.some((f) => f.key === "reps" && f.enabled)) {
        const reps = ex.reps?.trim();
        if (reps) parts.push(`${reps} reps`);
    }
    const targetWeight = formatTargetWeight(ex.weightTargetKg);
    if (targetWeight && schema.fields.some((f) => f.key === "weight" && f.enabled)) {
        parts.push(`${targetWeight} kg`);
    }
    if (ex.targetDurationSec != null && ex.targetDurationSec > 0) {
        parts.push(`${ex.targetDurationSec}s`);
    }
    if (ex.targetDistanceMeters != null && ex.targetDistanceMeters > 0) {
        parts.push(`${ex.targetDistanceMeters} m`);
    }
    if (ex.targetHeightCm != null && ex.targetHeightCm > 0) {
        parts.push(`${ex.targetHeightCm} cm`);
    }
    return parts.join(" / ");
}

function previousSetSummary(set: PreviousSet, schema: ExerciseTrackingSchema) {
    return formatSetSummary(
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
        },
        schema
    );
}

const METRIC_SAVE_KEYS = [
    "isCompleted",
    "weightKg",
    "reps",
    "rpe",
    "durationSec",
    "distanceMeters",
    "heightCm",
    "resistance",
    "inclinePct",
    "calories",
    "heartRate",
    "speedKph",
    "rir",
    "isWarmup",
] as const;

export function WorkoutLogClient({
    workout,
    trackingSchemas: initialTrackingSchemas = {},
    exerciseMedia: initialExerciseMedia = {},
    logDate,
    clientId,
    clientName,
    previousSessions: initialPreviousSessions = {},
    exerciseRecords: initialExerciseRecords = {},
    muscleTargetsByKey: initialMuscleTargetsByKey = {},
    initialExerciseNotes = {},
    initialActiveLog = null,
    showWorkoutInputHint = false,
}: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const returnTo = getReturnToFromSearchParams(searchParams);
    const targetDateStr = logDate ? toDateKey(parseLogDate(logDate)) : toDateKey(new Date());
    const localStorageKey = `workout_start_time_${workout.id}_${targetDateStr}${clientId ? `_${clientId}` : ""}`;
    const logSubjectFields = clientId ? { clientId } : {};
    const isCoachForClient = Boolean(clientId);
    /** Coaches observing from calendar must not start/finish; Correct Log uses mode=edit. */
    const coachObserver = isCoachForClient && searchParams.get("mode") !== "edit";
    const isPreviewMode = searchParams.get("mode") === "preview";
    const shouldAutostart =
        !coachObserver &&
        (searchParams.get("autostart") === "1" || searchParams.get("mode") === "start");
    const autostartAttemptedRef = useRef(false);
    const [previousSessions, setPreviousSessions] = useState(initialPreviousSessions);
    const [exerciseRecords, setExerciseRecords] = useState(initialExerciseRecords);
    const [mediaByName, setMediaByName] = useState(initialExerciseMedia);
    const [trackingSchemas] = useState(initialTrackingSchemas);
    const [muscleTargetsByKey, setMuscleTargetsByKey] = useState(initialMuscleTargetsByKey);

    const schemaFor = (ex: Pick<Exercise, "id" | "name" | "muscleGroup">) =>
        getSchemaForExercise(ex, trackingSchemas);

    const [initialSession] = useState(() => {
        if (initialActiveLog) {
            return restoreSessionState(initialActiveLog, workout.exercises, localStorageKey);
        }
        return {
            logs: buildInitialLogs(workout.exercises),
            exercises: sortWorkoutExercises(workout.exercises),
            startTime: Date.now(),
            activeLogId: null as string | null,
        };
    });

    const [logs, setLogs] = useState<Record<string, SetLog[]>>(initialSession.logs);
    /** Optional per-exercise notes for this session, keyed by exercise id. */
    const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>(initialExerciseNotes);
    const [openNoteExerciseId, setOpenNoteExerciseId] = useState<string | null>(null);
    const [startTime, setStartTime] = useState(initialSession.startTime);
    const [elapsed, setElapsed] = useState(0);
    const [saving, setSaving] = useState(false);

    const isSameDay = isSameCalendarDay;

    const [showFinishModal, setShowFinishModal] = useState(false);
    const [manualDurationMinutes, setManualDurationMinutes] = useState("");
    const [workoutNotes, setWorkoutNotes] = useState("");
    const [finishFeeling, setFinishFeeling] = useState<number | null>(null);

    // Active exercises state (allows adding/substituting)
    const [activeExercises, setActiveExercises] = useState<Exercise[]>(initialSession.exercises);
    const [isSubstituting, setIsSubstituting] = useState<string | null>(null); // exerciseId
    const [isAddingExercise, setIsAddingExercise] = useState(false);
    const [editStartedAt, setEditStartedAt] = useState<number | null>(null); // Track when editing started
    const [searchQuery, setSearchQuery] = useState("");
    const [activeLogId, setActiveLogId] = useState<string | null>(initialSession.activeLogId);
    const [isDiscarding, setIsDiscarding] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [conflictSession, setConflictSession] = useState<ConflictingActiveSession | null>(null);
    const [isCheckingSession, setIsCheckingSession] = useState(!initialActiveLog);
    const sessionActive = Boolean(activeLogId);
    const [previewExercise, setPreviewExercise] = useState<{ name: string; media: ExercisePreviewMedia } | null>(null);
    const [previewVideoStarted, setPreviewVideoStarted] = useState(false);
    const [modalTouchStart, setModalTouchStart] = useState<number | null>(null);

    const lastRemoteUpdatedAtRef = useRef(
        remoteUpdatedAtMs(initialActiveLog?.updatedAt)
    );
    const exerciseNotesRef = useRef(exerciseNotes);
    exerciseNotesRef.current = exerciseNotes;
    const isSavingRef = useRef(false);
    const progressSaveInFlightRef = useRef(false);
    const pendingProgressSaveRef = useRef<PendingProgressSave | null>(null);
    const isCompletingRef = useRef(false);

    const modalOpen = Boolean(previewExercise) || isSubstituting !== null || isAddingExercise || showFinishModal || Boolean(conflictSession);
    const exercisePickerOpen = isSubstituting !== null || isAddingExercise;
    useScrollLock(modalOpen);
    useIsolateScroll(exercisePickerOpen);

    useEffect(() => {
        setPreviewVideoStarted(false);
    }, [previewExercise?.media.videoUrl]);

    /**
     * Previous performance is looked up by canonical exercise identity, so a renamed or
     * differently-spelled variant still finds its own history.
     */
    const previousSessionFor = (exerciseName: string): PreviousSessionPerformance | null =>
        previousSessions[exerciseIdentityKey(exerciseName)] ?? null;

    const recordsFor = (exerciseName: string): ExerciseRecords =>
        exerciseRecords[exerciseIdentityKey(exerciseName)] ?? EMPTY_EXERCISE_RECORDS;

    /**
     * Load last-session sets + PRs for a swapped/added exercise so placeholders and
     * "Last session" appear immediately without leaving the workout.
     */
    const historyFetchedRef = useRef<Set<string>>(new Set(Object.keys(initialExerciseRecords)));

    const fetchExerciseHistory = async (exerciseName: string) => {
        const key = exerciseIdentityKey(exerciseName);
        if (!key) return null;
        if (historyFetchedRef.current.has(key)) {
            return {
                key,
                name: exerciseName,
                previousSession: previousSessions[key] ?? null,
                records: exerciseRecords[key] ?? null,
                media: mediaByName[exerciseName] ?? null,
                muscleGroup: null as string | null,
                muscleTargets: muscleTargetsByKey[key] ?? null,
                fromCache: true,
            };
        }
        historyFetchedRef.current.add(key);

        try {
            const params = new URLSearchParams({ name: exerciseName });
            if (clientId) params.set("clientId", clientId);
            if (activeLogId) params.set("excludeLogId", activeLogId);
            const res = await fetch(`/api/exercises/history?${params}`);
            if (!res.ok) {
                historyFetchedRef.current.delete(key);
                return null;
            }
            const data = await res.json();
            if (!data?.key) return null;
            return { ...data, fromCache: false };
        } catch (err) {
            historyFetchedRef.current.delete(key);
            console.error("[WorkoutLog] Failed to load swapped exercise history", err);
            return null;
        }
    };

    const applyExerciseHistory = (exerciseName: string, data: {
        key: string;
        name?: string;
        previousSession?: PreviousSessionPerformance | null;
        records?: ExerciseRecords | null;
        media?: ExercisePreviewMedia | null;
        muscleGroup?: string | null;
        muscleTargets?: MuscleTargetEntry[] | null;
        fromCache?: boolean;
    } | null) => {
        if (!data?.key) return;

        if (data.muscleTargets && data.muscleTargets.length > 0) {
            setMuscleTargetsByKey((prev) => ({ ...prev, [data.key]: data.muscleTargets! }));
        }

        if (data.fromCache) return;

        if (data.previousSession) {
            setPreviousSessions((prev) => ({ ...prev, [data.key]: data.previousSession! }));
        }
        if (data.records) {
            setExerciseRecords((prev) => ({ ...prev, [data.key]: data.records! }));
        }
        if (data.media) {
            setMediaByName((prev) => ({
                ...prev,
                [exerciseName]: data.media!,
                ...(data.name && data.name !== exerciseName ? { [data.name]: data.media! } : {}),
            }));
        }
    };

    /**
     * The matching set from the immediately previous session, or undefined.
     *
     * Deliberately does not fall back to older sessions: if only two sets were performed
     * last time, set 3 has no placeholder rather than borrowing a stale number.
     */
    const findLastCompletedSet = (exerciseName: string, setNumber: number) =>
        previousSessionFor(exerciseName)?.sets.find((set) => set.setNumber === setNumber);

    const getWeightPlaceholder = (exerciseName: string, setNumber: number) => {
        const lastSet = findLastCompletedSet(exerciseName, setNumber);
        if (lastSet?.weightKg != null && lastSet.weightKg > 0) {
            return lastSet.weightKg.toString();
        }
        return "";
    };

    const getRepsPlaceholder = (exerciseName: string, setNumber: number) => {
        const lastSet = findLastCompletedSet(exerciseName, setNumber);
        if (lastSet?.reps != null && lastSet.reps > 0) {
            return String(lastSet.reps);
        }
        return "";
    };

    const getRpePlaceholder = (exerciseName: string, setNumber: number) => {
        const lastSet = findLastCompletedSet(exerciseName, setNumber);
        if (lastSet?.rpe != null) return String(lastSet.rpe);
        return "";
    };

    const getMetricPlaceholders = (
        ex: Exercise,
        setNumber: number
    ): Partial<Record<TrackingFieldKey, string>> => {
        const lastSet = findLastCompletedSet(ex.name, setNumber);
        const setTarget = ex.setTargets?.find((t) => t.setNumber === setNumber);
        const ph: Partial<Record<TrackingFieldKey, string>> = {};
        const weight =
            getWeightPlaceholder(ex.name, setNumber)
            || (setTarget?.weightKg != null && setTarget.weightKg > 0
                ? String(setTarget.weightKg)
                : "")
            || formatTargetWeight(ex.weightTargetKg);
        if (weight) ph.weight = weight;
        const reps =
            getRepsPlaceholder(ex.name, setNumber)
            || (setTarget?.reps != null && setTarget.reps > 0 ? String(setTarget.reps) : "")
            || ex.reps?.trim()
            || "";
        if (reps) ph.reps = reps;
        const rpe =
            getRpePlaceholder(ex.name, setNumber)
            || (setTarget?.rpe != null ? String(setTarget.rpe) : "");
        if (rpe) ph.rpe = rpe;
        if (lastSet?.durationSec != null && lastSet.durationSec > 0) {
            ph.duration = String(lastSet.durationSec);
        } else if (setTarget?.durationSec != null && setTarget.durationSec > 0) {
            ph.duration = String(setTarget.durationSec);
        } else if (ex.targetDurationSec != null && ex.targetDurationSec > 0) {
            ph.duration = String(ex.targetDurationSec);
        }
        if (lastSet?.distanceMeters != null && lastSet.distanceMeters > 0) {
            ph.distance = String(lastSet.distanceMeters);
        } else if (setTarget?.distanceMeters != null && setTarget.distanceMeters > 0) {
            ph.distance = String(setTarget.distanceMeters);
        } else if (ex.targetDistanceMeters != null && ex.targetDistanceMeters > 0) {
            ph.distance = String(ex.targetDistanceMeters);
        }
        if (lastSet?.heightCm != null && lastSet.heightCm > 0) {
            ph.height = String(lastSet.heightCm);
        } else if (setTarget?.heightCm != null && setTarget.heightCm > 0) {
            ph.height = String(setTarget.heightCm);
        } else if (ex.targetHeightCm != null && ex.targetHeightCm > 0) {
            ph.height = String(ex.targetHeightCm);
        }
        if (lastSet?.resistance != null) ph.resistance = String(lastSet.resistance);
        else if (setTarget?.resistance != null) ph.resistance = String(setTarget.resistance);
        if (lastSet?.inclinePct != null) ph.incline = String(lastSet.inclinePct);
        else if (setTarget?.inclinePct != null) ph.incline = String(setTarget.inclinePct);
        if (lastSet?.calories != null && lastSet.calories > 0) ph.calories = String(lastSet.calories);
        if (lastSet?.heartRate != null && lastSet.heartRate > 0) ph.heartRate = String(lastSet.heartRate);
        if (lastSet?.speedKph != null && lastSet.speedKph > 0) ph.speed = String(lastSet.speedKph);
        return ph;
    };

    // Restore an in-progress session if one exists — never auto-start a new one.
    useEffect(() => {
        if (initialActiveLog || activeLogId) {
            setIsCheckingSession(false);
            return;
        }

        let cancelled = false;

        const syncSession = async () => {
            setIsCheckingSession(true);
            try {
                const params = new URLSearchParams({ active: "true", workoutId: workout.id, date: targetDateStr });
                if (clientId) params.set("clientId", clientId);
                const res = await fetch(`/api/logs?${params}`);
                const active = await res.json();
                const targetDate = logDate ? parseLogDate(logDate) : new Date();

                if (cancelled) return;

                if (active && active.workoutId === workout.id && isSameDay(active.loggedAt, targetDate)) {
                    const restored = restoreSessionState(active, workout.exercises, localStorageKey);
                    setActiveLogId(restored.activeLogId);
                    setActiveExercises(restored.exercises);
                    setLogs(restored.logs);
                    setStartTime(restored.startTime);
                    if (active.updatedAt) {
                        lastRemoteUpdatedAtRef.current = remoteUpdatedAtMs(active.updatedAt);
                    }
                }
            } catch (e) {
                console.error("Failed to sync workout session:", e);
            } finally {
                if (!cancelled) setIsCheckingSession(false);
            }
        };

        syncSession();
        return () => {
            cancelled = true;
        };
    }, [activeLogId, clientId, initialActiveLog, isSameDay, localStorageKey, logDate, targetDateStr, workout.exercises, workout.id]);

    // Live sync weight/reps/RPE between coach and client on the same in-progress session.
    useEffect(() => {
        if (!activeLogId || !sessionActive || modalOpen) return;

        let cancelled = false;

        const pullRemoteSession = async () => {
            if (cancelled || isSavingRef.current || isWorkoutSetInputFocused()) return;

            try {
                const res = await fetch(`/api/logs/${activeLogId}`, { cache: "no-store" });
                if (!res.ok) {
                    if (res.status === 404) {
                        router.push(returnTo);
                        router.refresh();
                    }
                    return;
                }

                const remote = await res.json();
                if (cancelled || isSavingRef.current || isWorkoutSetInputFocused()) return;

                if (remote.status === "COMPLETED") {
                    router.push(returnTo);
                    router.refresh();
                    return;
                }

                const remoteUpdatedAt = remoteUpdatedAtMs(remote.updatedAt);
                if (remoteUpdatedAt <= lastRemoteUpdatedAtRef.current) return;

                const remotePayload: InitialActiveLog = {
                    id: remote.id,
                    loggedAt: remote.loggedAt,
                    duration: remote.duration,
                    updatedAt: remote.updatedAt,
                    sets: (remote.sets ?? []).map((set: {
                        exerciseId?: string;
                        exercise?: Exercise | null;
                        setNumber: number;
                        reps?: number | null;
                        weightKg?: number | null;
                        rpe?: number | null;
                        durationSec?: number | null;
                        distanceMeters?: number | null;
                        heightCm?: number | null;
                        resistance?: number | null;
                        inclinePct?: number | null;
                        calories?: number | null;
                        heartRate?: number | null;
                        speedKph?: number | null;
                        rir?: number | null;
                        isCompleted?: boolean | null;
                        isWarmup?: boolean | null;
                        videoUrl?: string | null;
                    }) => ({
                        exerciseId: set.exerciseId ?? set.exercise?.id ?? "",
                        setNumber: set.setNumber,
                        reps: set.reps,
                        weightKg: set.weightKg,
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
                        isCompleted: set.isCompleted,
                        isWarmup: set.isWarmup,
                        videoUrl: set.videoUrl,
                        exercise: set.exercise ?? null,
                    })),
                };

                const merged = restoreSessionState(remotePayload, workout.exercises, localStorageKey);
                lastRemoteUpdatedAtRef.current = remoteUpdatedAt;
                setLogs(merged.logs);
                setActiveExercises(merged.exercises);
            } catch {
                // ignore transient poll errors
            }
        };

        pullRemoteSession();
        const interval = setInterval(() => {
            if (document.visibilityState === "visible") {
                void pullRemoteSession();
            }
        }, 1000);

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                void pullRemoteSession();
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            cancelled = true;
            clearInterval(interval);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [
        activeLogId,
        sessionActive,
        modalOpen,
        localStorageKey,
        returnTo,
        router,
        workout.exercises,
    ]);

    // Track when Swap/Add modal is open and adjust startTime when closed to pause timer
    useEffect(() => {
        const isEditing = isSubstituting !== null || isAddingExercise;
        if (isEditing) {
            if (!editStartedAt) {
                setEditStartedAt(Date.now());
            }
        } else {
            if (editStartedAt) {
                const editDuration = Date.now() - editStartedAt;
                setStartTime(prev => {
                    const nextStart = prev + editDuration;
                    persistStartTime(localStorageKey, nextStart);
                    saveProgress(logs, activeExercises, nextStart);
                    return nextStart;
                });
                setEditStartedAt(null);
            }
        }
    }, [isSubstituting, isAddingExercise]);

    // Timer — only runs once a session has been explicitly started
    useEffect(() => {
        if (!sessionActive || editStartedAt !== null) return;

        const updateElapsed = () => {
            setElapsed(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
        };

        updateElapsed();
        const timer = setInterval(updateElapsed, 1000);

        // Instantly catch up when returning to the tab or app
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                updateElapsed();
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            clearInterval(timer);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [startTime, editStartedAt, sessionActive]);

    const startWorkoutSession = async (replaceActiveSession = false) => {
        if (sessionActive || isStarting || isCheckingSession) return false;
        setIsStarting(true);

        try {
            const now = Date.now();
            persistStartTime(localStorageKey, now);
            setStartTime(now);

            const initialLogs = buildInitialLogs(workout.exercises);
            const flattenedSets = Object.entries(initialLogs).flatMap(([exId, sets]) => {
                const exInfo = workout.exercises.find((e) => e.id === exId);
                const exOrder = workout.exercises.findIndex((e) => e.id === exId);
                return sets.map((s) => ({
                    exerciseId: exId,
                    exerciseName: exInfo?.name || "Unknown",
                    exerciseOrder: resolvePersistedExerciseOrderValue(exInfo, exOrder),
                    setNumber: s.setNumber,
                    reps: s.reps,
                    isWarmup: s.isWarmup,
                    isCompleted: s.isCompleted,
                }));
            });

            const createRes = await fetch("/api/logs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workoutId: workout.id,
                    status: "IN_PROGRESS",
                    loggedAt: toLoggedAtIso(logDate ?? new Date(now)),
                    sets: flattenedSets,
                    ...(replaceActiveSession ? { replaceActiveSession: true } : {}),
                    ...logSubjectFields,
                }),
            });

            if (createRes.status === 409) {
                const payload = await createRes.json().catch(() => null);
                const conflict = parseActiveSessionConflict(payload);
                if (conflict) {
                    setConflictSession(conflict);
                    return false;
                }
                alert(payload?.message || "A workout is already in progress.");
                return false;
            }

            if (!createRes.ok) {
                alert("Could not start workout session.");
                return false;
            }

            const saved = await createRes.json();
            if (saved.id) {
                const hasLoggedWork = Array.isArray(saved.sets) && saved.sets.some(
                    (s: { reps?: number | null; weightKg?: number | null; rpe?: number | null; isCompleted?: boolean | null }) =>
                        Boolean(s.isCompleted) ||
                        (typeof s.reps === "number" && s.reps > 0) ||
                        (typeof s.weightKg === "number" && s.weightKg > 0) ||
                        (typeof s.rpe === "number" && s.rpe > 0)
                );
                if (hasLoggedWork) {
                    const restored = restoreSessionState(saved, workout.exercises, localStorageKey);
                    setActiveLogId(restored.activeLogId);
                    setActiveExercises(restored.exercises);
                    setLogs(restored.logs);
                    setStartTime(restored.startTime);
                } else {
                    setActiveLogId(saved.id);
                }
            }
            if (saved.updatedAt) {
                lastRemoteUpdatedAtRef.current = remoteUpdatedAtMs(saved.updatedAt);
            }
            setConflictSession(null);
            notifyWorkoutStatsChanged();
            router.refresh();
            return true;
        } catch (e) {
            console.error("Failed to start workout session:", e);
            alert("Could not start workout session.");
            return false;
        } finally {
            setIsStarting(false);
        }
    };

    const clearAutostartParams = () => {
        const params = new URLSearchParams(searchParams.toString());
        let changed = false;
        if (params.has("autostart")) {
            params.delete("autostart");
            changed = true;
        }
        if (params.get("mode") === "start") {
            params.delete("mode");
            changed = true;
        }
        if (!changed) return;
        const qs = params.toString();
        router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    };

    // Start Workout deep-links: create/resume the session instead of leaving the user on a preview.
    useEffect(() => {
        if (!shouldAutostart) return;
        if (isCheckingSession) return;

        if (activeLogId) {
            clearAutostartParams();
            return;
        }

        if (autostartAttemptedRef.current || isStarting) return;
        autostartAttemptedRef.current = true;

        void (async () => {
            await startWorkoutSession(false);
            clearAutostartParams();
        })();
        // Intentionally omit startWorkoutSession — guarded by autostartAttemptedRef.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shouldAutostart, isCheckingSession, activeLogId, isStarting]);

    const handleStartWorkout = async () => {
        await startWorkoutSession(false);
    };

    const formatTime = (s: number) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    /**
     * Notes ride along with every save so they survive leaving and resuming the workout.
     * Read from a ref because saves are debounced and must send the latest text, not the
     * value captured when the save was queued.
     */
    const buildExerciseNotesPayload = () =>
        activeExercises.map((exercise) => ({
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            text: exerciseNotesRef.current[exercise.id] ?? "",
        }));

    const persistProgressSnapshot = async (snapshot: PendingProgressSave) => {
        if (!activeLogId || isCompletingRef.current) return;

        const exList = snapshot.exercises || activeExercises;
        const flattenedSets = Object.entries(snapshot.logs).flatMap(([exId, sets]) => {
            const exInfo = exList.find(e => e.id === exId);
            const exOrder = exList.findIndex(e => e.id === exId);
            return sets.map(s => ({
                exerciseId: exId,
                exerciseName: exInfo?.name || "Unknown",
                exerciseOrder: resolvePersistedExerciseOrderValue(exInfo, exOrder),
                setNumber: s.setNumber,
                ...setLogToPayloadMetrics(s),
                isWarmup: s.isWarmup,
                isCompleted: s.isCompleted || (exInfo ? hasPerformedSetData(s, schemaFor(exInfo)) : false),
                videoUrl: s.videoUrl || undefined,
            }));
        });

        try {
            const finalStartTime = snapshot.startTimeOverride ?? startTime;
            const elapsedMinutes = Math.max(0, Math.floor((Date.now() - finalStartTime) / 60000));
            isSavingRef.current = true;
            const res = await fetch("/api/logs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workoutId: workout.id,
                    status: "IN_PROGRESS",
                    duration: elapsedMinutes,
                    loggedAt: toLoggedAtIso(logDate ?? new Date(finalStartTime)),
                    sets: flattenedSets,
                    exerciseNotes: buildExerciseNotesPayload(),
                    ...logSubjectFields,
                }),
            });
            if (res.ok) {
                const saved = await res.json();
                if (saved.id) setActiveLogId(saved.id);
                if (saved.updatedAt) {
                    lastRemoteUpdatedAtRef.current = remoteUpdatedAtMs(saved.updatedAt);
                }
            }
        } catch (e) {
            console.error("Auto-save failed:", e);
        } finally {
            isSavingRef.current = false;
        }
    };

    const flushProgressSaves = async () => {
        if (progressSaveInFlightRef.current) return;
        progressSaveInFlightRef.current = true;
        try {
            while (pendingProgressSaveRef.current) {
                const next = pendingProgressSaveRef.current;
                pendingProgressSaveRef.current = null;
                await persistProgressSnapshot(next);
            }
        } finally {
            progressSaveInFlightRef.current = false;
            if (pendingProgressSaveRef.current) {
                void flushProgressSaves();
            }
        }
    };

    const saveProgress = (
        currentLogs: Record<string, SetLog[]>,
        currentExercises?: Exercise[],
        startTimeOverride?: number
    ) => {
        if (!activeLogId || isCompletingRef.current) return;
        pendingProgressSaveRef.current = {
            logs: currentLogs,
            exercises: currentExercises,
            startTimeOverride,
        };
        void flushProgressSaves();
    };

    const muscleBreakdown = useMemo(
        () =>
            buildWorkoutMuscleBreakdown(
                activeExercises.map((ex) => ({
                    name: ex.name,
                    muscleGroup: ex.muscleGroup,
                    sets: Math.max(
                        logs[ex.id]?.filter((s) => !s.isWarmup).length ?? ex.sets ?? 1,
                        1
                    ),
                    muscleTargets: muscleTargetsByKey[exerciseIdentityKey(ex.name)],
                }))
            ),
        [activeExercises, logs, muscleTargetsByKey]
    );

    /**
     * Live PRs: each completed set is judged against history + earlier completed sets
     * in this session. Recomputed on every logs/records change so edits/deletes recalc.
     * Strength uses the canonical engine; other tracking schemas use metric-aware PRs.
     */
    const livePrByExerciseId = useMemo(() => {
        const result: Record<string, Array<SetPrResult | MetricPrResult>> = {};
        if (!sessionActive) return result;

        for (const ex of activeExercises) {
            const schema = schemaFor(ex);
            const sets = logs[ex.id] ?? [];
            if (usesStrengthOneRm(schema)) {
                result[ex.id] = evaluateLiveExercisePrs(
                    sets.map((set) => ({
                        weightKg: parseOptionalNumber(set.weightKg) ?? 0,
                        reps: set.reps,
                        isWarmup: set.isWarmup,
                        isCompleted: set.isCompleted,
                    })),
                    recordsFor(ex.name)
                );
                continue;
            }

            // Non-strength: replay metric board from baseline strength records when present,
            // otherwise empty metric board (history for duration/distance arrives via records
            // only for strength today — duration PRs still work once prior sets exist in-session).
            const board: MetricExerciseRecords = cloneMetricRecords({
                ...EMPTY_METRIC_RECORDS,
                strength: recordsFor(ex.name),
            });
            result[ex.id] = sets.map((set) => {
                const metrics = {
                    weightKg: parseOptionalNumber(set.weightKg),
                    reps: set.reps,
                    durationSec: set.durationSec != null ? parseFloat(String(set.durationSec)) : null,
                    distanceMeters: set.distanceMeters != null ? parseFloat(String(set.distanceMeters)) : null,
                    heightCm: set.heightCm != null ? parseFloat(String(set.heightCm)) : null,
                    isWarmup: set.isWarmup,
                    isCompleted: set.isCompleted === true,
                };
                const pr = evaluateMetricAwarePr(metrics, board, schema);
                if (set.isCompleted === true && !set.isWarmup) {
                    applySetToMetricRecords(board, metrics, schema);
                }
                return pr;
            });
        }
        return result;
    }, [sessionActive, activeExercises, logs, exerciseRecords, trackingSchemas]);

    const sessionPrSummary = useMemo(() => {
        const rows: Array<{ exerciseName: string; label: string; summary: string }> = [];
        for (const ex of activeExercises) {
            const prs = livePrByExerciseId[ex.id] ?? [];
            const sets = logs[ex.id] ?? [];
            prs.forEach((pr, idx) => {
                if (!pr.isPr || !pr.label) return;
                const set = sets[idx];
                if (!set) return;
                const schema = schemaFor(ex);
                rows.push({
                    exerciseName: ex.name,
                    label: pr.label,
                    summary: formatSetSummary(
                        {
                            weightKg: parseOptionalNumber(set.weightKg),
                            reps: set.reps,
                            durationSec: set.durationSec != null ? parseFloat(String(set.durationSec)) : null,
                            distanceMeters: set.distanceMeters != null ? parseFloat(String(set.distanceMeters)) : null,
                            heightCm: set.heightCm != null ? parseFloat(String(set.heightCm)) : null,
                        },
                        schema
                    ),
                });
            });
        }
        return rows;
    }, [activeExercises, livePrByExerciseId, logs, trackingSchemas]);

    const viewport = useVisualViewport();

    const closeExercisePicker = () => {
        setIsSubstituting(null);
        setIsAddingExercise(false);
        setSearchQuery("");
    };

    /** Keep the swap sheet compact (~header + search + 5 results); shrink further if the keyboard is open. */
    const swapSheetMaxHeight = viewport
        ? Math.min(viewport.height - 16, 420)
        : undefined;
    const swapResultsMaxHeight = viewport
        ? Math.min(224, Math.max(140, viewport.height - 200))
        : 224;

    const updateExerciseNote = (exerciseId: string, text: string) => {
        const clipped = text.slice(0, EXERCISE_NOTE_MAX_LENGTH);
        setExerciseNotes((prev) => {
            const next = { ...prev, [exerciseId]: clipped };
            exerciseNotesRef.current = next;
            return next;
        });
        if (activeLogId) {
            // Queue after state settles; notes ride on the next snapshot via ref.
            pendingProgressSaveRef.current = {
                logs,
                exercises: activeExercises,
            };
            void flushProgressSaves();
        }
    };

    const updateSet = (exId: string, setIdx: number, updates: Partial<SetLog>) => {
        setLogs((prev) => {
            const currentSet = prev[exId][setIdx];
            const finalUpdates = { ...updates };
            const exercise = activeExercises.find((ex) => ex.id === exId);
            const nextSet = { ...currentSet, ...finalUpdates };

            if (
                updates.isCompleted === undefined
                && !currentSet.isCompleted
                && hasPerformedSetData(nextSet, exercise ? schemaFor(exercise) : guessTrackingSchema(""))
            ) {
                finalUpdates.isCompleted = true;
            }

            const next = {
                ...prev,
                [exId]: prev[exId].map((set, i) => i === setIdx ? { ...set, ...finalUpdates } : set),
            };
            if (Object.keys(finalUpdates).some((k) => (METRIC_SAVE_KEYS as readonly string[]).includes(k))) {
                saveProgress(next);
            }
            return next;
        });
    };

    const addSet = (exId: string) => {
        setLogs((prev) => {
            const sets = prev[exId] || [];
            const lastSet = sets[sets.length - 1];
            const next = {
                ...prev,
                [exId]: [
                    ...sets,
                    blankSetLog(sets.length + 1, {
                        weightKg: lastSet?.weightKg ?? "",
                        reps: lastSet?.reps ?? 0,
                        rpe: lastSet?.rpe ?? "",
                        durationSec: lastSet?.durationSec ?? "",
                        distanceMeters: lastSet?.distanceMeters ?? "",
                        heightCm: lastSet?.heightCm ?? "",
                        resistance: lastSet?.resistance ?? "",
                        inclinePct: lastSet?.inclinePct ?? "",
                        calories: lastSet?.calories ?? "",
                        heartRate: lastSet?.heartRate ?? "",
                        speedKph: lastSet?.speedKph ?? "",
                        rir: lastSet?.rir ?? "",
                    }),
                ],
            };
            saveProgress(next);
            return next;
        });
    };

    const removeSet = (exId: string, setIdx: number) => {
        setLogs((prev) => {
            const next = {
                ...prev,
                [exId]: prev[exId].filter((_, i) => i !== setIdx).map((s, i) => ({ ...s, setNumber: i + 1 })),
            };
            saveProgress(next);
            return next;
        });
    };

    const handleReplace = async (newName: string) => {
        if (!isSubstituting || !newName) return;

        const substitutingId = isSubstituting;
        const originalEx = activeExercises.find(ex => ex.id === substitutingId);

        // Fetch history first so last-session placeholders paint with the swapped card.
        const history = await fetchExerciseHistory(newName);

        const newExId = `${substitutingId}:sub:${generateId(4)}`;
        const nextExercises = activeExercises.map(ex => 
            ex.id === substitutingId
                ? {
                    ...ex,
                    id: newExId,
                    name: newName,
                    muscleGroup: history?.muscleGroup || ex.muscleGroup,
                }
                : ex
        );

        applyExerciseHistory(newName, history);
        setActiveExercises(nextExercises);
        setLogs(prev => {
            const next = { ...prev };
            const existingSets = prev[substitutingId] || [];
            if (existingSets.length > 0) {
                next[newExId] = existingSets;
            } else {
                const count = originalEx?.sets || 3;
                next[newExId] = Array.from({ length: count }, (_, i) => blankSetLog(i + 1));
            }
            delete next[substitutingId];
            
            saveProgress(next, nextExercises);
            return next;
        });
        
        setIsSubstituting(null);
        setSearchQuery("");
    };

    const handleAddExercise = async (newName: string) => {
        if (!newName) return;

        const history = await fetchExerciseHistory(newName);

        const newEx: Exercise = {
            id: `new-${generateId()}`,
            name: newName,
            sets: 3,
            reps: "10",
            muscleGroup: history?.muscleGroup || undefined,
        };

        const nextExercises = [...activeExercises, newEx];
        applyExerciseHistory(newName, history);
        setActiveExercises(nextExercises);
        setLogs(prev => {
            const next = {
                ...prev,
                [newEx.id]: Array.from({ length: 3 }, (_, i) => blankSetLog(i + 1)),
            };
            saveProgress(next, nextExercises);
            return next;
        });

        setIsAddingExercise(false);
        setSearchQuery("");
    };

    const removeExercise = async (exId: string) => {
        if (!confirm("Are you sure you want to remove this exercise from this session?")) return;
        
        const nextExercises = activeExercises.filter(ex => ex.id !== exId);
        setActiveExercises(nextExercises);
        setLogs(prev => {
            const next = { ...prev };
            delete next[exId];
            saveProgress(next, nextExercises);
            return next;
        });
    };

    const hasCompletedSet = () => {
        const flattenedSets = Object.entries(logs).flatMap(([exId, sets]) =>
            sets.map(s => ({ ...s, exerciseId: exId }))
        );
        return flattenedSets.some((set) => {
            const exercise = activeExercises.find((ex) => ex.id === set.exerciseId);
            return set.isCompleted || (exercise ? hasPerformedSetData(set, schemaFor(exercise)) : false);
        });
    };

    const handleInitiateFinish = () => {
        if (!hasCompletedSet()) {
            alert("Finish at least one set!");
            return;
        }
        setManualDurationMinutes(Math.floor(elapsed / 60).toString());
        setFinishFeeling(null);
        setShowFinishModal(true);
    };

    const handleSubmit = async (override?: { duration?: number; notes?: string; feeling?: number | null }) => {
        setSaving(true);
        isCompletingRef.current = true;
        pendingProgressSaveRef.current = null;
        const flattenedSets = Object.entries(logs).flatMap(([exId, sets]) => {
            const exInfo = activeExercises.find(e => e.id === exId);
            const exOrder = activeExercises.findIndex(e => e.id === exId);
            return sets.map(s => ({
                exerciseId: exId,
                exerciseName: exInfo?.name || "Unknown",
                exerciseOrder: resolvePersistedExerciseOrderValue(exInfo, exOrder),
                setNumber: s.setNumber,
                ...setLogToPayloadMetrics(s),
                isWarmup: s.isWarmup,
                isCompleted: s.isCompleted || (exInfo ? hasPerformedSetData(s, schemaFor(exInfo)) : false),
                videoUrl: s.videoUrl || undefined,
            }));
        });

        try {
            const parsedManualDuration = parseInt(manualDurationMinutes, 10);
            const finalDuration = override?.duration ?? (Number.isFinite(parsedManualDuration) ? parsedManualDuration : Math.floor(elapsed / 60));
            const finalNotes = override ? override.notes : workoutNotes.trim() || undefined;
            const finalFeeling = override ? override.feeling ?? undefined : finishFeeling ?? undefined;
            const res = await fetch("/api/logs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workoutId: workout.id,
                    duration: finalDuration,
                    notes: finalNotes,
                    feeling: finalFeeling,
                    status: "COMPLETED",
                    loggedAt: toLoggedAtIso(logDate),
                    sets: flattenedSets,
                    exerciseNotes: buildExerciseNotesPayload(),
                    ...logSubjectFields,
                }),
            });
            
            if (res.ok) {
                const saved = await res.json();
                localStorage.removeItem(localStorageKey);
                setShowFinishModal(false);
                notifyWorkoutStatsChanged();
                router.push(appendReturnTo(`/plans/log/view/${saved.id}`, returnTo));
                router.refresh();
            } else {
                let errMsg = "Unknown error";
                try {
                    const errData = await res.json();
                    errMsg = errData.error?.message || JSON.stringify(errData.error) || JSON.stringify(errData) || errMsg;
                } catch {
                    try {
                        errMsg = await res.text();
                    } catch {}
                }
                console.error("Save failed:", errMsg);
                alert(`Failed to save: ${errMsg}`);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error("Submit error:", err);
            alert(`Save failed (Connection/JS Error): ${message}`);
        } finally {
            setSaving(false);
            isCompletingRef.current = false;
        }
    };

    const handleExitSession = () => {
        router.push(returnTo);
    };

    const handleDiscard = async () => {
        if (coachObserver && sessionActive) {
            handleExitSession();
            return;
        }

        if (!sessionActive) {
            router.push(returnTo);
            return;
        }

        localStorage.removeItem(localStorageKey);
        if (!activeLogId) {
            router.push(returnTo);
            return;
        }

        if (!confirm("Discard this session? All progress for this specific session will be permanently deleted.")) return;
        
        setIsDiscarding(true);
        try {
            const res = await fetch(`/api/logs/${activeLogId}`, { method: "DELETE" });
            if (res.ok) {
                notifyWorkoutStatsChanged();
                router.push(returnTo);
                router.refresh();
            }
        } catch (e) {
            console.error(e);
            alert("Failed to discard session.");
        } finally {
            setIsDiscarding(false);
        }
    };

    const scheduledDayLabel = logDate && !isSameCalendarDay(logDate, new Date())
        ? formatDate(parseLogDate(logDate), { weekday: "long", day: "numeric", month: "long" })
        : null;
    const previewVideoUrl = previewExercise?.media.videoUrl || null;
    const previewThumbnailUrl = previewVideoUrl
        ? getVideoThumbnailUrl(previewVideoUrl, previewExercise?.media.thumbnailUrl)
        : null;

    return (
        <div className="min-h-screen bg-surface flex flex-col pt-safe-area">
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-16 border-b border-surface-border glass fixed top-[var(--maintenance-banner-height,0px)] left-0 right-0 z-40 md:left-[var(--sidebar-width)]">
                <button 
                    onClick={handleDiscard} 
                    disabled={isDiscarding}
                    className={cn(
                        "btn-icon",
                        sessionActive && !coachObserver
                            ? "text-danger/60 hover:text-danger hover:bg-danger/10"
                            : "text-fg-muted hover:text-fg hover:bg-surface-muted"
                    )}
                    title={
                        sessionActive
                            ? (coachObserver ? "Exit" : "Discard Workout")
                            : "Back"
                    }
                >
                    {sessionActive && !coachObserver ? <Trash2 className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                </button>
                <div className="text-center">
                    <h2 className="text-sm font-bold text-fg truncate max-w-[180px]">{workout.name}</h2>
                    {sessionActive ? (
                        <div className="flex items-center justify-center gap-1 text-[10px] text-brand-400 font-semibold uppercase tracking-widest">
                            <Timer className="w-3 h-3" />
                            {formatTime(elapsed)}
                        </div>
                    ) : (
                        <p className="text-[10px] text-fg-subtle font-semibold uppercase tracking-widest">
                            {isCheckingSession
                                ? "Loading..."
                                : isStarting && shouldAutostart
                                  ? "Starting..."
                                  : coachObserver
                                    ? "Coach review"
                                    : isPreviewMode
                                      ? "Workout preview"
                                      : "Ready to start"}
                        </p>
                    )}
                </div>
                {sessionActive ? (
                    coachObserver ? (
                        <button
                            onClick={handleExitSession}
                            className="btn-secondary btn-sm px-3"
                        >
                            Exit
                        </button>
                    ) : (
                        <button onClick={handleInitiateFinish} disabled={saving} className="btn-primary btn-sm px-4 shadow-glow-brand">
                            Finish
                        </button>
                    )
                ) : coachObserver ? (
                    <span className="text-[10px] font-black uppercase tracking-wider text-brand-400 px-2">
                        Review
                    </span>
                ) : (
                    <button
                        onClick={handleStartWorkout}
                        disabled={isStarting || isCheckingSession}
                        className="btn-primary btn-sm px-3 sm:px-4 shadow-glow-brand shrink-0 text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1.5"
                    >
                        <Flame className="w-3.5 h-3.5" />
                        {isCheckingSession ? "..." : isStarting ? "..." : "Start"}
                    </button>
                )}
            </div>

            <div
                className={cn(
                    "flex-1 p-4 pt-20 pb-20 no-scrollbar md:ml-[var(--sidebar-width)] md:pb-28",
                    exercisePickerOpen || showFinishModal || previewExercise
                        ? "overflow-hidden overscroll-none touch-none"
                        : "overflow-y-auto"
                )}
            >
                <div className="max-w-3xl mx-auto space-y-6">
                    {clientName && (
                        <div className="card p-3 border-brand-500/30 bg-brand-950/20 text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-brand-400">
                                {sessionActive ? "Live client session" : "Reviewing client session"}
                            </p>
                            <p className="text-sm font-bold text-fg">{clientName}</p>
                        </div>
                    )}

                    {scheduledDayLabel && (
                        <div className="card p-3 border-brand-500/30 bg-brand-950/20 text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-brand-400">Logging for this date</p>
                            <p className="text-sm font-bold text-fg mt-0.5">{scheduledDayLabel}</p>
                        </div>
                    )}

                    {!sessionActive && (
                        <div className="card p-4 border-brand-500/20 bg-brand-950/10 space-y-3">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-brand-400">
                                    Workout preview
                                </p>
                                <p className="text-sm text-fg-muted mt-1">
                                    {coachObserver
                                        ? "Planned work for this date. Use Edit Session on the calendar to change programming for this day only."
                                        : isPreviewMode
                                          ? "Preview only — press Start Workout when you are ready to begin logging."
                                          : "Review sets below, then start when you're ready."}
                                </p>
                            </div>
                            <MuscleMap breakdown={muscleBreakdown} />
                        </div>
                    )}

                    {sessionActive && (
                        <div className="space-y-2 px-1">
                            <MuscleMap breakdown={muscleBreakdown} size="sm" showLegend={false} />
                            <MuscleChips breakdown={muscleBreakdown} />
                        </div>
                    )}

                    {showWorkoutInputHint && sessionActive && (
                        <p className="px-1 text-xs font-semibold text-fg-muted">
                            Enter your weight, reps, and RPE as you train.
                        </p>
                    )}

                    {activeExercises.map((ex) => {
                        const media = mediaByName[ex.name];
                        const hasPreview = !!(media?.videoUrl || media?.instructions);
                        const schema = schemaFor(ex);
                        const strengthOneRm = usesStrengthOneRm(schema);
                        const targetSummary = getExerciseTargetSummary(ex, schema);
                        const previous = previousSessionFor(ex.name);
                        const hasNote = Boolean(exerciseNotes[ex.id]?.trim());
                        const noteOpen = openNoteExerciseId === ex.id;
                        const noteText = exerciseNotes[ex.id] ?? "";

                        return (
                        <div key={ex.id} id={`exercise-${ex.id}`} className="card p-4 space-y-4 animate-slide-up">
                            <div className="flex flex-col gap-2 w-full">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="font-bold text-fg text-base leading-tight">{ex.name}</h3>
                                        {media?.videoUrl && (
                                            <button
                                                type="button"
                                                onClick={() => setPreviewExercise({ name: ex.name, media })}
                                                className="relative z-10 w-8 h-8 -my-1 rounded-full bg-brand-500/15 text-brand-300 border border-brand-500/30 flex items-center justify-center hover:bg-brand-500 hover:text-white active:scale-95 transition-all shrink-0"
                                                title="Watch form video"
                                            >
                                                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                            </button>
                                        )}
                                        {!media?.videoUrl && media?.instructions && (
                                            <button
                                                type="button"
                                                onClick={() => setPreviewExercise({ name: ex.name, media })}
                                                className="relative z-10 w-8 h-8 -my-1 rounded-full bg-brand-500/15 text-brand-300 border border-brand-500/30 flex items-center justify-center hover:bg-brand-500 hover:text-white active:scale-95 transition-all shrink-0"
                                                title="Exercise preview"
                                            >
                                                <HelpCircle className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                    {!hasPreview && (
                                        <span className="text-fg-subtle p-1 shrink-0" title="No preview available">
                                            <InfoIcon className="w-4 h-4" />
                                        </span>
                                    )}
                                </div>

                                {ex.notes && <p className="text-xs text-fg-muted -mt-1">{ex.notes}</p>}

                                {targetSummary && (
                                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-fg-muted">
                                        <span className="font-black uppercase tracking-wider text-brand-400/80">Target</span>
                                        <span className="font-semibold text-fg">{targetSummary}</span>
                                    </div>
                                )}

                                {previous && previous.sets.length > 0 && (
                                    <div className="rounded-lg border border-surface-border/60 bg-surface-muted/30 px-2.5 py-2">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-fg-subtle">
                                            Last session
                                            {previous.dateKey ? ` · ${formatDate(previous.dateKey)}` : ""}
                                        </p>
                                        <p className="text-[11px] font-semibold text-fg-muted mt-0.5 leading-relaxed">
                                            {previous.sets.map((set) => previousSetSummary(set, schema)).join("  ·  ")}
                                        </p>
                                    </div>
                                )}

                                {sessionActive && !coachObserver && (
                                    <div className="flex items-center gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setIsSubstituting(ex.id)}
                                            className="text-[10px] font-black uppercase text-brand-400/60 hover:text-brand-400 bg-brand-400/5 hover:bg-brand-400/10 px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5"
                                        >
                                            <Flame className="w-3 h-3" /> Swap
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => removeExercise(ex.id)}
                                            className="text-[10px] font-black uppercase text-danger/40 hover:text-danger bg-danger/5 hover:bg-danger/10 px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5"
                                        >
                                            <Trash2 className="w-3 h-3" /> Delete
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div className={cn(
                                    "grid gap-1.5 md:gap-2 text-[10px] md:text-[11px] font-black text-fg-subtle uppercase px-1 mb-1 tracking-wide md:tracking-wider grid-cols-12"
                                )}>
                                    <div className="col-span-1 text-center">Set</div>
                                    <SetMetricHeaders schema={schema} sessionActive={sessionActive} showEst1Rm={strengthOneRm} />
                                    {sessionActive && (
                                        <div className="text-center hidden md:block md:col-span-2">
                                            Actions
                                        </div>
                                    )}
                                </div>

                                {logs[ex.id]?.map((set, sIdx) => {
                                    const placeholders = getMetricPlaceholders(ex, set.setNumber);
                                    const pr = livePrByExerciseId[ex.id]?.[sIdx] ?? null;
                                    const weightNum = parseFloat(String(set.weightKg)) || 0;
                                    const est1RM =
                                        strengthOneRm && !set.isWarmup && weightNum > 0 && set.reps > 0
                                            ? calculateOneRM(weightNum, set.reps)
                                            : null;
                                    const showMobile1Rm = sessionActive && strengthOneRm;

                                    const setActions = sessionActive && !coachObserver ? (
                                        <div className="flex items-center justify-end gap-1 shrink-0">
                                            <button
                                                onClick={() => updateSet(ex.id, sIdx, { isCompleted: !set.isCompleted })}
                                                className={cn(
                                                    "w-8 h-10 rounded-lg flex items-center justify-center transition-all",
                                                    set.isCompleted
                                                        ? "bg-success text-white shadow-glow-success"
                                                        : "bg-surface-elevated text-fg-muted hover:bg-brand-950/20 hover:text-brand-400"
                                                )}
                                            >
                                                <Check className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => removeSet(ex.id, sIdx)}
                                                className="w-8 h-10 rounded-lg flex items-center justify-center text-danger/40 hover:text-danger hover:bg-danger-950/20 transition-all ml-1"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : null;

                                    return (
                                    <div key={sIdx} className="space-y-0.5">
                                    <div
                                        className={cn(
                                            "p-2 rounded-xl border transition-all duration-200",
                                            sessionActive && "space-y-2 md:space-y-0",
                                            sessionActive && set.isCompleted
                                                ? "bg-success-950/20 border-success-800/40"
                                                : "bg-surface-muted/50 border-surface-border",
                                            sessionActive && !set.isCompleted && "hover:border-brand-700/30"
                                        )}
                                    >
                                        <div className="grid gap-1.5 md:gap-2 grid-cols-12">
                                        <div className="col-span-1 flex items-center justify-center">
                                            {sessionActive ? (
                                                <button
                                                    onClick={() => updateSet(ex.id, sIdx, { isWarmup: !set.isWarmup })}
                                                    className={cn(
                                                        "w-7 h-10 rounded-md text-[10px] font-bold flex items-center justify-center transition-colors shadow-sm",
                                                        set.isWarmup ? "bg-warning-500/20 text-warning-400" : "bg-surface-elevated text-fg-subtle hover:text-fg"
                                                    )}
                                                >
                                                    {set.isWarmup ? "W" : set.setNumber}
                                                </button>
                                            ) : (
                                                <span className="w-7 h-10 rounded-md text-[10px] font-bold flex items-center justify-center bg-surface-elevated text-fg-subtle">
                                                    {set.setNumber}
                                                </span>
                                            )}
                                        </div>

                                        <SetMetricInputs
                                            schema={schema}
                                            set={set}
                                            sessionActive={sessionActive}
                                            disabled={!sessionActive || coachObserver}
                                            inputAttr={WORKOUT_SET_INPUT_ATTR}
                                            placeholders={placeholders}
                                            unitSuffix={{ weight: "kg" }}
                                            onChange={(patch) => updateSet(ex.id, sIdx, patch)}
                                        />

                                        {sessionActive && (
                                        <div className="hidden md:flex items-center justify-end gap-1 md:col-span-2">
                                            {setActions}
                                        </div>
                                        )}
                                        </div>

                                        {sessionActive && (
                                            <div className={cn(
                                                "flex items-center justify-between gap-3 md:hidden",
                                                strengthOneRm && "pt-1.5 border-t border-surface-border/40"
                                            )}>
                                                {showMobile1Rm && (
                                                    <div className="flex items-baseline gap-2 min-w-0">
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-fg-subtle shrink-0">Est 1RM</span>
                                                        <span className={cn(
                                                            "text-sm font-bold tabular-nums whitespace-nowrap",
                                                            est1RM ? "text-warning-400" : "text-fg-subtle"
                                                        )}>
                                                            {est1RM ? `${est1RM}kg` : "—"}
                                                        </span>
                                                    </div>
                                                )}
                                                {setActions}
                                            </div>
                                        )}
                                    </div>
                                    {pr?.isPr && pr.label && (
                                        <div className="px-1 space-y-0.5">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-warning">
                                                {pr.label}
                                            </p>
                                            {"alsoKinds" in pr && pr.alsoKinds && pr.alsoKinds.length > 0 && (() => {
                                                const strengthKinds = pr.alsoKinds.filter(
                                                    (k) => k === "oneRm" || k === "weight" || k === "reps"
                                                ) as Array<"oneRm" | "weight" | "reps">;
                                                const strengthAlso = formatAlsoStrengthPrLabels(
                                                    strengthKinds,
                                                    set.reps
                                                );
                                                const metricAlso = pr.alsoKinds
                                                    .filter((k) => !["oneRm", "weight", "reps"].includes(k))
                                                    .map((k) =>
                                                        k === "duration"
                                                            ? "DURATION PR"
                                                            : k === "distance"
                                                              ? "DISTANCE PR"
                                                              : k === "pace"
                                                                ? "TIME PR"
                                                                : k === "height"
                                                                  ? "HEIGHT PR"
                                                                  : k === "heightReps"
                                                                    ? "REP PR"
                                                                    : String(k).toUpperCase()
                                                    );
                                                const labels = [...strengthAlso, ...metricAlso];
                                                if (labels.length === 0) return null;
                                                return (
                                                    <p className="text-[9px] font-bold uppercase tracking-wide text-fg-subtle">
                                                        Also: {labels.join(" · ")}
                                                    </p>
                                                );
                                            })()}
                                        </div>
                                    )}
                                    </div>
                                )})}
                                        </div>

                                        {sessionActive && !coachObserver && (
                                <button
                                    onClick={() => addSet(ex.id)}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-surface-muted/50 border border-dashed border-surface-border rounded-xl text-xs font-semibold text-fg-muted hover:text-brand-400 hover:border-brand-600 transition-all"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Add Set
                                </button>
                            )}

                            {sessionActive && !coachObserver && (
                                <div className="pt-1 space-y-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setOpenNoteExerciseId((id) => (id === ex.id ? null : ex.id))
                                        }
                                        aria-expanded={noteOpen}
                                        aria-label={hasNote ? "View or edit exercise note" : "Add exercise note"}
                                        className={cn(
                                            "w-full min-h-11 px-3 rounded-xl border text-left transition-all flex items-center gap-2.5 active:scale-[0.99]",
                                            hasNote
                                                ? "border-brand-500/25 bg-brand-500/[0.06] text-brand-300"
                                                : "border-surface-border/70 bg-surface-muted/25 text-fg-muted hover:border-surface-border hover:bg-surface-muted/40 hover:text-fg"
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "relative flex items-center justify-center w-7 h-7 rounded-lg shrink-0",
                                                hasNote ? "bg-brand-500/15 text-brand-400" : "bg-surface-muted/60 text-fg-subtle"
                                            )}
                                        >
                                            <NotebookPen className="w-3.5 h-3.5" />
                                            {hasNote && (
                                                <span
                                                    className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-brand-400"
                                                    aria-hidden
                                                />
                                            )}
                                        </span>
                                        <span className="text-xs font-semibold tracking-tight">
                                            {hasNote ? "View/Edit note" : "Add note"}
                                        </span>
                                        {hasNote && !noteOpen && (
                                            <span className="ml-auto text-[10px] font-medium text-brand-400/70 truncate max-w-[45%]">
                                                {noteText.trim()}
                                            </span>
                                        )}
                                    </button>

                                    {noteOpen && (
                                        <textarea
                                            value={noteText}
                                            onChange={(e) => updateExerciseNote(ex.id, e.target.value)}
                                            rows={2}
                                            maxLength={EXERCISE_NOTE_MAX_LENGTH}
                                            autoFocus
                                            placeholder="Technique, machine setting, pain, cue for next time…"
                                            className="w-full resize-none rounded-xl border border-brand-500/20 bg-surface-elevated/80 px-3 py-2.5 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-1 focus:ring-brand-500"
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    )})}

                    {!sessionActive ? null : coachObserver ? null : (
                    <>
                    <button
                        onClick={() => setIsAddingExercise(true)}
                        className="w-full h-16 rounded-3xl border-2 border-dashed border-surface-border text-fg-subtle hover:text-brand-400 hover:border-brand-500/40 hover:bg-brand-500/5 transition-all flex items-center justify-center gap-3 group"
                    >
                        <div className="w-8 h-8 rounded-xl bg-surface-muted flex items-center justify-center group-hover:bg-brand-500/20 transition-colors">
                            <Plus className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest">Add Exercise</span>
                    </button>
                    
                    {!isCoachForClient && (
                    <div className="hidden md:block mt-16 pb-8 text-center space-y-6 max-w-sm mx-auto animate-fade-in delay-500">
                        <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-brand-500/50 to-transparent mx-auto mb-10" />
                        <div className="space-y-2">
                             <p className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-400 animate-pulse-slow">Mission: Complete</p>
                             <p className="text-[9px] font-bold text-fg-subtle uppercase tracking-widest leading-relaxed">Ensure all sets are checked before final verification</p>
                        </div>
                        <button
                            onClick={handleInitiateFinish}
                            className="btn-primary w-full h-16 text-lg font-black uppercase tracking-widest shadow-glow-brand group relative overflow-hidden flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95"
                        >
                            <Zap className="w-5 h-5 text-brand-300 group-hover:text-white group-hover:animate-bounce" />
                            Finish Workout
                        </button>
                    </div>
                    )}
                    </>
                    )}
                </div>
            </div>

            {previewExercise && (
                <div
                    className="fixed inset-0 z-[70] flex overflow-hidden overscroll-none items-end sm:items-center justify-center bg-black/80 animate-fade-in sm:p-4 backdrop-blur-sm"
                    onClick={() => setPreviewExercise(null)}
                >
                    <div
                        className="bg-surface-card w-full h-[92vh] sm:h-auto sm:max-h-[88vh] sm:max-w-2xl rounded-t-[2rem] sm:rounded-3xl border border-surface-border shadow-glow-brand-lg overflow-hidden animate-slide-up flex flex-col"
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => setModalTouchStart(event.clientY)}
                        onPointerUp={(event) => {
                            if (modalTouchStart !== null && event.clientY - modalTouchStart > 90) {
                                setPreviewExercise(null);
                            }
                            setModalTouchStart(null);
                        }}
                    >
                        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-surface-border">
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-brand-400">Exercise Preview</p>
                                <h3 className="text-lg font-black text-fg truncate">{previewExercise.name}</h3>
                            </div>
                            <button
                                onClick={() => setPreviewExercise(null)}
                                className="btn-icon"
                                title="Close preview"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4">
                            {previewExercise.media.videoUrl && (
                                <>
                                    <div className="w-full overflow-hidden rounded-2xl border border-surface-border bg-black aspect-video">
                                        {isDirectVideo(previewExercise.media.videoUrl) ? (
                                            <video
                                                src={previewExercise.media.videoUrl}
                                                controls
                                                playsInline
                                                preload="metadata"
                                                poster={previewExercise.media.thumbnailUrl || undefined}
                                                className="w-full h-full object-contain"
                                            />
                                        ) : !previewVideoStarted ? (
                                            <button
                                                type="button"
                                                onClick={() => setPreviewVideoStarted(true)}
                                                className="relative w-full h-full overflow-hidden bg-black flex items-center justify-center group"
                                                aria-label={`Play ${previewExercise.name} video`}
                                            >
                                                {previewThumbnailUrl && (
                                                    <span
                                                        className="absolute inset-0 bg-cover bg-center opacity-80 transition-transform group-hover:scale-105"
                                                        style={{ backgroundImage: `url(${previewThumbnailUrl})` }}
                                                    />
                                                )}
                                                <span className="relative z-10 w-16 h-16 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-glow-brand group-active:scale-95 transition-transform">
                                                    <Play className="w-7 h-7 fill-current ml-1" />
                                                </span>
                                            </button>
                                        ) : (
                                            <iframe
                                                src={getEmbedUrl(previewExercise.media.videoUrl, true)}
                                                title={`${previewExercise.name} video preview`}
                                                className="w-full h-full"
                                                loading="eager"
                                                referrerPolicy="strict-origin-when-cross-origin"
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                                                allowFullScreen
                                            />
                                        )}
                                    </div>
                                    <a
                                        href={previewExercise.media.videoUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn-secondary btn-sm w-full"
                                    >
                                        Open video
                                    </a>
                                </>
                            )}

                            {previewExercise.media.instructions && (
                                <div className="rounded-2xl border border-surface-border bg-surface-muted/30 p-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-fg-subtle mb-2">Instructions</p>
                                    <p className="text-sm text-fg-muted leading-relaxed whitespace-pre-wrap">{previewExercise.media.instructions}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Substitution / Add Modal — compact sheet; only the results list scrolls */}
            {(isSubstituting || isAddingExercise) && (
                <div
                    className="fixed inset-x-0 z-[60] flex overflow-hidden overscroll-none items-end sm:items-center justify-center bg-black/70 animate-fade-in sm:px-4 backdrop-blur-sm"
                    style={
                        viewport
                            ? {
                                  top: viewport.offsetTop,
                                  height: viewport.height,
                              }
                            : { top: 0, bottom: 0 }
                    }
                    onClick={closeExercisePicker}
                    onTouchMove={(e) => {
                        // Only the results list (data-allow-scroll) may scroll.
                        if (e.target === e.currentTarget) e.preventDefault();
                    }}
                >
                    <div
                        className="bg-surface-card w-full sm:max-w-sm rounded-t-[1.5rem] sm:rounded-[2rem] p-4 sm:p-5 border border-surface-border shadow-glow-brand-lg flex flex-col overflow-hidden min-h-0 mb-0 sm:mb-auto"
                        style={{
                            maxHeight: swapSheetMaxHeight
                                ? `${swapSheetMaxHeight}px`
                                : "min(420px, 85dvh)",
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onTouchMove={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3 shrink-0 pb-2">
                            <div className="min-w-0 pt-0.5">
                                <h3 className="text-lg sm:text-xl font-black text-fg tracking-tighter uppercase">
                                    {isSubstituting ? "Substitute Exercise" : "Add Exercise"}
                                </h3>
                                <p className="text-[11px] text-fg-subtle font-medium mt-0.5">
                                    {isSubstituting ? "Tap a match to swap instantly." : "Tap a match to add."}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeExercisePicker}
                                className="btn-ghost h-9 px-3 text-xs font-black uppercase tracking-widest text-fg-muted shrink-0"
                                aria-label="Cancel"
                            >
                                Cancel
                            </button>
                        </div>

                        <div className="min-h-0 flex flex-col shrink pb-[max(0.25rem,env(safe-area-inset-bottom))]">
                            <label className="text-[10px] font-black uppercase tracking-widest text-fg-subtle px-1 shrink-0 mb-1.5">Search Exercises</label>
                            <ExerciseAutocomplete
                                value={searchQuery}
                                onChange={setSearchQuery}
                                onSelect={(name) => {
                                    if (isSubstituting) handleReplace(name);
                                    else handleAddExercise(name);
                                }}
                                autoFocus
                                resultsPlacement="inline"
                                resultsMaxHeightPx={swapResultsMaxHeight}
                                className="input h-12 font-bold border-brand-500/20 focus:border-brand-500"
                                placeholder="Search e.g. Bench Press..."
                            />
                        </div>
                    </div>
                </div>
            )}

            {!sessionActive && !coachObserver && (
            <div className="hidden md:block fixed bottom-0 left-0 right-0 z-40 p-4 pt-3 border-t border-surface-border bg-surface glass md:left-[var(--sidebar-width)] pb-[max(1rem,env(safe-area-inset-bottom))]">
                <button
                    onClick={handleStartWorkout}
                    disabled={isStarting || isCheckingSession}
                    className="btn-primary w-full max-w-3xl mx-auto h-14 text-sm font-black uppercase tracking-widest shadow-glow-brand flex items-center justify-center gap-2"
                >
                    <Flame className="w-4.5 h-4.5" />
                    {isCheckingSession ? "Checking..." : isStarting ? "Starting..." : "Start Workout"}
                </button>
            </div>
            )}

            {conflictSession && (
                <ActiveSessionConflictModal
                    session={conflictSession}
                    pendingWorkoutName={workout.name}
                    busy={isStarting}
                    onCancel={() => setConflictSession(null)}
                    onResume={() => {
                        let href = conflictSession.resumeHref;
                        if (clientId) {
                            href += `${href.includes("?") ? "&" : "?"}clientId=${encodeURIComponent(clientId)}`;
                        }
                        setConflictSession(null);
                        router.push(appendReturnTo(href, returnTo));
                    }}
                    onEndAndStart={async () => {
                        await startWorkoutSession(true);
                    }}
                />
            )}

            {showFinishModal && (
                <div className="fixed inset-0 z-[70] flex overflow-hidden overscroll-none items-end sm:items-center justify-center bg-black/80 animate-fade-in sm:p-4">
                    <div
                        className="bg-surface-card w-full sm:max-w-sm max-h-[min(92dvh,100%)] sm:max-h-[90vh] rounded-t-[2rem] sm:rounded-[2rem] border border-surface-border shadow-glow-brand-lg flex flex-col animate-slide-up"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-5">
                            <div className="text-center space-y-2">
                                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-brand-500/10 rounded-full flex items-center justify-center mx-auto shadow-glow-brand-sm">
                                    <Award className="w-7 h-7 sm:w-8 sm:h-8 text-brand-400" />
                                </div>
                                <h3 className="text-xl sm:text-2xl font-black text-fg tracking-tighter uppercase">Workout Complete!</h3>
                                <p className="text-xs text-fg-subtle font-medium">Review your session details below.</p>
                            </div>

                            {sessionPrSummary.length > 0 && (
                                <div className="rounded-2xl border border-warning/25 bg-warning/5 p-3.5 space-y-2.5">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-warning">
                                        {sessionPrSummary.length}{" "}
                                        {sessionPrSummary.length === 1 ? "Record" : "Records"}
                                    </p>
                                    <ul className="space-y-2">
                                        {sessionPrSummary.map((row, i) => (
                                            <li key={`${row.exerciseName}-${i}`} className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-black text-fg truncate">{row.exerciseName}</p>
                                                    <p className="text-[10px] font-semibold text-fg-muted tabular-nums">{row.summary}</p>
                                                </div>
                                                <span className="shrink-0 text-[9px] font-black uppercase tracking-wider text-warning">
                                                    {row.label}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {!isCoachForClient && (
                                <WorkoutFeelingPicker
                                    value={finishFeeling}
                                    onChange={setFinishFeeling}
                                    disabled={saving}
                                />
                            )}

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-fg-subtle px-1">Duration (Minutes)</label>
                                <div className="relative">
                                    <Timer className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-fg-muted" />
                                    <input
                                        type="number"
                                        className="input pl-12 h-12 text-lg font-bold"
                                        value={manualDurationMinutes}
                                        onChange={(e) => setManualDurationMinutes(e.target.value)}
                                        placeholder="e.g. 45"
                                    />
                                    <p className="text-[9px] text-fg-subtle mt-1 px-1">Adjust if you forgot to end the timer</p>
                                </div>
                            </div>

                            {!isCoachForClient && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-fg-subtle px-1">Notes (Optional)</label>
                                    <textarea
                                        className="input h-20 text-sm py-3 resize-none"
                                        placeholder="Felt great, hit a PR on bench..."
                                        value={workoutNotes}
                                        onChange={(e) => setWorkoutNotes(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 p-4 sm:p-6 pt-3 border-t border-surface-border shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6">
                            <button onClick={() => setShowFinishModal(false)} className="btn-secondary h-12 flex-1" disabled={saving}>
                                Back
                            </button>
                            <button onClick={() => handleSubmit()} className="btn-primary h-12 flex-[2] shadow-glow-brand" disabled={saving}>
                                {saving ? "Saving..." : "Save Session"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
