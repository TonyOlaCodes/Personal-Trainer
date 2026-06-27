const CHAT_DRAFTS_KEY = "chatMessageDrafts";

export function getChatDraftKey(tab: "direct" | "general", peerId?: string | null): string | null {
    if (tab === "general") return "general";
    if (tab === "direct" && peerId) return `direct:${peerId}`;
    return null;
}

export function loadChatDraft(key: string | null): string {
    if (!key || typeof window === "undefined") return "";
    try {
        const raw = localStorage.getItem(CHAT_DRAFTS_KEY);
        if (!raw) return "";
        const drafts = JSON.parse(raw) as Record<string, string>;
        return drafts[key] ?? "";
    } catch {
        return "";
    }
}

export function saveChatDraft(key: string | null, text: string) {
    if (!key || typeof window === "undefined") return;
    try {
        const raw = localStorage.getItem(CHAT_DRAFTS_KEY);
        const drafts: Record<string, string> = raw ? JSON.parse(raw) : {};
        const trimmed = text;
        if (!trimmed) {
            delete drafts[key];
        } else {
            drafts[key] = trimmed;
        }
        localStorage.setItem(CHAT_DRAFTS_KEY, JSON.stringify(drafts));
    } catch {
        // ignore storage errors
    }
}

export function clearChatDraft(key: string | null) {
    saveChatDraft(key, "");
}
