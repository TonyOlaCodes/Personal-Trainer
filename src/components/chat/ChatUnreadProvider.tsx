"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";
import { useRole } from "@/lib/RoleContext";

interface ChatUnreadContextValue {
    totalUnread: number;
    peerUnread: Record<string, number>;
    refresh: () => Promise<void>;
}

const ChatUnreadContext = createContext<ChatUnreadContextValue>({
    totalUnread: 0,
    peerUnread: {},
    refresh: async () => {},
});

export function ChatUnreadProvider({ children }: { children: ReactNode }) {
    const role = useRole();
    const enabled = role !== "FREE";
    const [totalUnread, setTotalUnread] = useState(0);
    const [peerUnread, setPeerUnread] = useState<Record<string, number>>({});

    const refresh = useCallback(async () => {
        if (!enabled) {
            setTotalUnread(0);
            setPeerUnread({});
            return;
        }
        try {
            const res = await fetch("/api/messages?activity=true");
            if (!res.ok) return;
            const data = await res.json();
            if (data.unread) setPeerUnread(data.unread);
            if (typeof data.totalUnread === "number") setTotalUnread(data.totalUnread);
        } catch {
            // ignore polling errors
        }
    }, [enabled]);

    useEffect(() => {
        if (!enabled) return;
        void refresh();
        const interval = setInterval(() => {
            if (document.visibilityState === "visible") void refresh();
        }, 3000);
        return () => clearInterval(interval);
    }, [enabled, refresh]);

    return (
        <ChatUnreadContext.Provider value={{ totalUnread, peerUnread, refresh }}>
            {children}
        </ChatUnreadContext.Provider>
    );
}

export function useChatUnread() {
    return useContext(ChatUnreadContext);
}

export function formatUnreadBadge(count: number): string | undefined {
    if (count <= 0) return undefined;
    return count > 99 ? "99+" : String(count);
}
