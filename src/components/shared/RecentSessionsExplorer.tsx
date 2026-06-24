"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { RecentSessionsListModal, PREVIEW_LIMIT, type RecentSessionItem } from "./RecentSessionsListModal";
import { WorkoutSessionModal } from "./WorkoutSessionModal";

interface Props {
    open: boolean;
    onClose: () => void;
    sessions: RecentSessionItem[];
    title?: string;
    subtitle?: string;
    emptyMessage?: string;
    initialSessionId?: string | null;
    canAddCoachNote?: boolean;
    canDelete?: boolean;
    canEditFeeling?: boolean;
    onDeleted?: () => void;
    /** When true, loads the user's complete workout history when the explorer opens. */
    fetchHistoryOnOpen?: boolean;
    /** Load history for another user (coach viewing a client). */
    historyUserId?: string;
}

function mapHistoryResponse(items: Array<{ id: string; workoutName: string; loggedAt: string; setCount?: number }>): RecentSessionItem[] {
    return items.map((item) => ({
        id: item.id,
        workoutName: item.workoutName,
        date: item.loggedAt,
        setCount: item.setCount,
    }));
}

export function RecentSessionsExplorer({
    open,
    onClose,
    sessions,
    title,
    subtitle,
    emptyMessage,
    initialSessionId = null,
    canAddCoachNote = false,
    canDelete = false,
    canEditFeeling = false,
    onDeleted,
    fetchHistoryOnOpen = false,
    historyUserId,
}: Props) {
    const [view, setView] = useState<"list" | "detail">("list");
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [allSessions, setAllSessions] = useState<RecentSessionItem[]>(sessions);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [historyError, setHistoryError] = useState("");

    useEffect(() => {
        setAllSessions(sessions);
    }, [sessions]);

    useEffect(() => {
        if (!open || !fetchHistoryOnOpen) return;

        let cancelled = false;
        async function loadHistory() {
            setLoadingHistory(true);
            setHistoryError("");
            try {
                const params = new URLSearchParams({ history: "true" });
                if (historyUserId) params.set("userId", historyUserId);
                const res = await fetch(`/api/logs?${params}`);
                const data = await res.json();
                if (cancelled) return;
                if (!res.ok) {
                    setHistoryError(data.error || "Could not load workout history");
                    return;
                }
                if (Array.isArray(data)) {
                    setAllSessions(mapHistoryResponse(data));
                }
            } catch {
                if (!cancelled) setHistoryError("Could not load workout history");
            } finally {
                if (!cancelled) setLoadingHistory(false);
            }
        }

        loadHistory();
        return () => {
            cancelled = true;
        };
    }, [open, fetchHistoryOnOpen, historyUserId]);

    const sessionIds = useMemo(() => allSessions.map((session) => session.id), [allSessions]);

    useEffect(() => {
        if (!open) {
            setView("list");
            setActiveSessionId(null);
            return;
        }

        if (initialSessionId) {
            if (allSessions.some((session) => session.id === initialSessionId)) {
                setActiveSessionId(initialSessionId);
                setView("detail");
            }
            return;
        }

        setView("list");
        setActiveSessionId(null);
    }, [open, initialSessionId, allSessions]);

    const handleClose = () => {
        setView("list");
        setActiveSessionId(null);
        onClose();
    };

    if (!open) return null;

    if (view === "detail" && activeSessionId) {
        return (
            <WorkoutSessionModal
                sessionId={activeSessionId}
                sessionIds={sessionIds}
                onNavigate={setActiveSessionId}
                onBackToList={() => {
                    setView("list");
                    setActiveSessionId(null);
                }}
                onClose={handleClose}
                canAddCoachNote={canAddCoachNote}
                canDelete={canDelete}
                canEditFeeling={canEditFeeling || canDelete}
                onDeleted={onDeleted}
            />
        );
    }

    return (
        <RecentSessionsListModal
            open
            onClose={handleClose}
            title={title}
            subtitle={subtitle ?? (loadingHistory ? "Loading your full workout history..." : undefined)}
            sessions={allSessions}
            emptyMessage={emptyMessage}
            loading={loadingHistory}
            error={historyError}
            onSelect={(sessionId) => {
                setActiveSessionId(sessionId);
                setView("detail");
            }}
        />
    );
}

export type { RecentSessionItem };
export { PREVIEW_LIMIT };
