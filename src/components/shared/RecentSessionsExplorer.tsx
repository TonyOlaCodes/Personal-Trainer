"use client";

import { useEffect, useMemo, useState } from "react";
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
    onDeleted?: () => void;
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
    onDeleted,
}: Props) {
    const [view, setView] = useState<"list" | "detail">("list");
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

    const sessionIds = useMemo(() => sessions.map((session) => session.id), [sessions]);

    useEffect(() => {
        if (!open) {
            setView("list");
            setActiveSessionId(null);
            return;
        }

        if (initialSessionId && sessions.some((session) => session.id === initialSessionId)) {
            setActiveSessionId(initialSessionId);
            setView("detail");
            return;
        }

        setView("list");
        setActiveSessionId(null);
    }, [open, initialSessionId, sessions]);

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
                onDeleted={onDeleted}
            />
        );
    }

    return (
        <RecentSessionsListModal
            open
            onClose={handleClose}
            title={title}
            subtitle={subtitle}
            sessions={sessions}
            emptyMessage={emptyMessage}
            onSelect={(sessionId) => {
                setActiveSessionId(sessionId);
                setView("detail");
            }}
        />
    );
}

export type { RecentSessionItem };
export { PREVIEW_LIMIT };
