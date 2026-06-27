"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
    Send, Image as ImageIcon, Globe, MessageSquare, Star, X, Pencil, Trash2,
    Check, MoreVertical, Reply, Pin, SmilePlus, CheckCheck, ChevronDown, AtSign, Settings,
    Dumbbell, ClipboardList, Activity
} from "lucide-react";
import Link from "next/link";
import { getInitials, formatRelative, cn, roleLabels, getRoleNameClass } from "@/lib/utils";
import { getPresenceIndicator } from "@/lib/userPresence";
import { sortConversationsByActivity } from "@/lib/chatActivity";
import { resolveUploadUrl } from "@/lib/uploadUrls";
import { uploadMediaFile } from "@/lib/compressImage";
import { MediaLightbox } from "@/components/shared/MediaLightbox";
import { ProfileLink } from "@/components/shared/ProfileLink";
import { CoachChatTools } from "@/components/chat/CoachChatTools";
import type { CoachPlanRecord } from "@/lib/coachPlans";

/* ─── Types ──────────────────────────────────────────── */
interface ReplyPreview {
    id: string;
    content?: string | null;
    type: string;
    sender: { id: string; name?: string | null };
}

interface ReactionData {
    id: string;
    emoji: string;
    userId: string;
    user: { id: string; name?: string | null };
}

interface Message {
    id: string;
    content?: string | null;
    mediaUrl?: string | null;
    receiverId?: string | null;
    type: string;
    isGeneral: boolean;
    isPinned: boolean;
    status: "SENT" | "DELIVERED" | "SEEN";
    mentions: string[];
    actionType?: "PLAN_ASSIGNED" | "CHECKIN_REQUEST" | null;
    actionEntityId?: string | null;
    createdAt: string;
    updatedAt?: string | null;
    replyTo?: ReplyPreview | null;
    reactions: ReactionData[];
    sender: { id: string; name?: string | null; avatarUrl?: string | null; role: string };
}

interface ActiveSession {
    workoutName: string;
    logId: string;
    workoutId: string;
}

interface Conversation {
    userId: string;
    name: string;
    role: string;
    avatarUrl?: string | null;
    isDeleted?: boolean;
    lastMessageAt?: string | null;
    lastActiveAt?: string | null;
}

interface Props {
    currentUserId: string;
    currentUserRole: string;
    conversations: Conversation[];
    canUseDirectChat?: boolean;
    coachPlans?: CoachPlanRecord[];
}

const REACTION_EMOJIS = ["👍", "🔥", "💪", "❤️", "😂", "🎯"];
const CHAT_MEDIA_THUMB =
    "w-[104px] h-[104px] sm:w-[120px] sm:h-[120px] object-cover rounded-xl shrink-0";
const LAST_CHAT_TAB_KEY = "lastChatTab";
const LAST_CHAT_CONVERSATION_KEY = "lastChatConversationId";

function findConversation(conversations: Conversation[], userId: string | null | undefined) {
    if (!userId) return null;
    return conversations.find((c) => c.userId === userId) ?? null;
}

function resolveDirectConversation(
    conversations: Conversation[],
    preferredUserId?: string | null,
    fallback?: Conversation | null,
    activity: Record<string, string> = {}
) {
    const sorted = sortConversationsByActivity(
        conversations.map((conversation) => ({
            ...conversation,
            lastMessageAt: activity[conversation.userId] ?? conversation.lastMessageAt ?? null,
        }))
    );
    return findConversation(sorted, preferredUserId) ?? fallback ?? sorted[0] ?? null;
}

/* ─── Component ──────────────────────────────────────── */
export function ChatClient({
    currentUserId,
    currentUserRole,
    conversations,
    canUseDirectChat = true,
    coachPlans = [],
}: Props) {
    const isCoachUser = currentUserRole === "COACH" || currentUserRole === "SUPER_ADMIN";
    const canViewLastOnline = currentUserRole === "COACH" || currentUserRole === "SUPER_ADMIN";
    const [tab, setTab] = useState<"direct" | "general">("general");
    const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
    const [isHydrated, setIsHydrated] = useState(false);
    const [viewerMedia, setViewerMedia] = useState<{ src: string; type: "IMAGE" | "VIDEO" } | null>(null);

    // Core state
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [stagedMedia, setStagedMedia] = useState<{ url: string; type: "IMAGE" | "VIDEO" } | null>(null);
    const [sending, setSending] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Feature state
    const [replyTo, setReplyTo] = useState<Message | null>(null);
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState("");
    const [editExpired, setEditExpired] = useState<Record<string, boolean>>({});
    const [reactionPickerId, setReactionPickerId] = useState<string | null>(null);
    const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
    const [showMentionDropdown, setShowMentionDropdown] = useState(false);
    const [mentionQuery, setMentionQuery] = useState("");
    const [showPinned, setShowPinned] = useState(false);
    const [mobileShowChat, setMobileShowChat] = useState(true);
    const [conversationActivity, setConversationActivity] = useState<Record<string, string>>({});
    const [conversationPresence, setConversationPresence] = useState<Record<string, string | null>>({});
    const [activeSessions, setActiveSessions] = useState<Record<string, ActiveSession>>({});

    const isFetchingRef = useRef(false);

    const resolveLastActive = useCallback((userId: string) => {
        if (conversationPresence[userId] !== undefined) {
            return conversationPresence[userId];
        }
        return conversations.find((conversation) => conversation.userId === userId)?.lastActiveAt ?? null;
    }, [conversationPresence, conversations]);

    const selectedActiveSession = useMemo(() => {
        if (!selectedConv) return null;
        return activeSessions[selectedConv.userId] ?? null;
    }, [selectedConv, activeSessions]);

    const selectedPresence = useMemo(() => {
        if (!canViewLastOnline || !selectedConv) return null;
        return getPresenceIndicator(resolveLastActive(selectedConv.userId));
    }, [canViewLastOnline, selectedConv, resolveLastActive, conversationPresence]);

    const messagesScrollRef = useRef<HTMLDivElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [peerTyping, setPeerTyping] = useState(false);
    const typingPingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const typingActiveRef = useRef(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isNearBottomRef = useRef(true);
    const shouldForceScrollRef = useRef(false);

    const messageRowRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const scrollMessagesToBottom = useCallback(() => {
        const container = messagesScrollRef.current;
        if (!container) return;
        container.scrollTop = container.scrollHeight;
    }, []);

    const isScrollNearBottom = (container: HTMLDivElement) =>
        container.scrollHeight - container.scrollTop - container.clientHeight < 80;

    const persistChatSelection = useCallback((nextTab: "direct" | "general", conversation?: Conversation | null) => {
        localStorage.setItem(LAST_CHAT_TAB_KEY, nextTab);
        if (nextTab === "direct" && conversation) {
            localStorage.setItem(LAST_CHAT_CONVERSATION_KEY, conversation.userId);
        }
    }, []);

    const selectConversation = useCallback((conversation: Conversation) => {
        setSelectedConv(conversation);
        setTab("direct");
        setMobileShowChat(true);
        setActiveMessageId(null);
        persistChatSelection("direct", conversation);
    }, [persistChatSelection]);

    // Restore last opened chat (global or direct)
    useEffect(() => {
        const initialActivity: Record<string, string> = {};
        const initialPresence: Record<string, string | null> = {};
        conversations.forEach((conversation) => {
            if (conversation.lastMessageAt) {
                initialActivity[conversation.userId] = conversation.lastMessageAt;
            }
            if (conversation.lastActiveAt !== undefined) {
                initialPresence[conversation.userId] = conversation.lastActiveAt ?? null;
            }
        });
        setConversationActivity(initialActivity);
        setConversationPresence(initialPresence);

        const savedTab = localStorage.getItem(LAST_CHAT_TAB_KEY);
        const savedConversationId = localStorage.getItem(LAST_CHAT_CONVERSATION_KEY);
        const requestedConversation = new URLSearchParams(window.location.search).get("with");
        const matchedConversation = findConversation(conversations, requestedConversation);

        if (matchedConversation) {
            setTab("direct");
            setSelectedConv(matchedConversation);
            setMobileShowChat(true);
            persistChatSelection("direct", matchedConversation);
        } else if (savedTab === "direct" && canUseDirectChat) {
            const conversation = resolveDirectConversation(conversations, savedConversationId, null, initialActivity);
            setTab("direct");
            setSelectedConv(conversation);
            setMobileShowChat(Boolean(conversation));
            if (conversation) persistChatSelection("direct", conversation);
        } else if (savedTab === "general" || !savedTab) {
            setTab("general");
            setSelectedConv(null);
            setMobileShowChat(true);
            persistChatSelection("general");
        } else {
            setTab("general");
            setSelectedConv(null);
            setMobileShowChat(true);
            persistChatSelection("general");
        }

        setIsHydrated(true);
    }, [conversations, canUseDirectChat, persistChatSelection]);

    const handleTabChange = (newTab: "direct" | "general") => {
        setTab(newTab);
        setReplyTo(null);
        setShowPinned(false);
        setActiveMessageId(null);
        persistChatSelection(newTab, newTab === "direct" ? selectedConv : null);

        if (newTab === "general") {
            setMobileShowChat(true);
            return;
        }

        if (!canUseDirectChat) {
            setMobileShowChat(true);
            return;
        }

        const savedConversationId = localStorage.getItem(LAST_CHAT_CONVERSATION_KEY);
        const conversation = resolveDirectConversation(conversations, savedConversationId, selectedConv, conversationActivity);
        setSelectedConv(conversation);
        setMobileShowChat(Boolean(conversation));
        if (conversation) persistChatSelection("direct", conversation);
    };

    useEffect(() => {
        if (!isHydrated || !canUseDirectChat) return;

        const fetchActivity = async () => {
            try {
                const res = await fetch("/api/messages?activity=true");
                if (!res.ok) return;
                const data = await res.json();
                if (data.activity) {
                    setConversationActivity((prev) => ({ ...prev, ...data.activity }));
                }
                if (canViewLastOnline && data.presence) {
                    setConversationPresence((prev) => ({ ...prev, ...data.presence }));
                }
                if (isCoachUser && data.activeSessions) {
                    setActiveSessions((prev) => ({ ...prev, ...data.activeSessions }));
                }
            } catch {
                // ignore polling errors
            }
        };

        fetchActivity();
        const interval = setInterval(() => {
            if (document.visibilityState === "visible") fetchActivity();
        }, 3000);

        return () => clearInterval(interval);
    }, [isHydrated, canUseDirectChat, canViewLastOnline, isCoachUser]);

    useEffect(() => {
        if (!activeMessageId && !menuOpenId && !reactionPickerId) return;
        if (window.matchMedia("(min-width: 640px)").matches) return;
        const targetId = menuOpenId ?? reactionPickerId ?? activeMessageId;
        if (!targetId) return;
        const row = messageRowRefs.current[targetId];
        row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, [activeMessageId, menuOpenId, reactionPickerId]);

    /* ─── Fetch Messages ────────────────────────────── */
    const fetchMessages = useCallback(async () => {
        if (!isHydrated || isFetchingRef.current) return;
        isFetchingRef.current = true;
        try {
            let url = "";
            if (tab === "general") url = "/api/messages?general=true";
            else if (tab === "direct" && selectedConv) url = `/api/messages?with=${selectedConv.userId}`;
            else return;

            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setMessages(data);

                if (tab === "direct" && selectedConv && data.length > 0) {
                    const lastMessage = data[data.length - 1] as Message;
                    setConversationActivity((prev) => ({
                        ...prev,
                        [selectedConv.userId]: lastMessage.createdAt,
                    }));
                }
            }
        } finally {
            isFetchingRef.current = false;
        }
    }, [tab, selectedConv, currentUserId, isHydrated]);

    useEffect(() => {
        fetchMessages();
        const startPolling = () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = setInterval(() => {
                if (document.visibilityState === "visible") fetchMessages();
            }, 3000);
        };
        startPolling();
        document.addEventListener("visibilitychange", startPolling);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            document.removeEventListener("visibilitychange", startPolling);
        };
    }, [fetchMessages]);

    const sendTypingSignal = useCallback(async (typing: boolean) => {
        if (tab !== "direct" || !selectedConv || selectedConv.isDeleted) return;
        try {
            await fetch("/api/messages/typing", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ withUserId: selectedConv.userId, typing }),
            });
        } catch {
            // ignore typing errors
        }
    }, [tab, selectedConv]);

    const stopTyping = useCallback(() => {
        if (typingPingRef.current) clearTimeout(typingPingRef.current);
        typingActiveRef.current = false;
        void sendTypingSignal(false);
    }, [sendTypingSignal]);

    const pulseTyping = useCallback(() => {
        if (tab !== "direct" || !selectedConv || selectedConv.isDeleted) return;
        if (!typingActiveRef.current) {
            typingActiveRef.current = true;
            void sendTypingSignal(true);
        }
        if (typingPingRef.current) clearTimeout(typingPingRef.current);
        typingPingRef.current = setTimeout(() => {
            typingActiveRef.current = false;
            void sendTypingSignal(false);
        }, 3500);
    }, [tab, selectedConv, sendTypingSignal]);

    useEffect(() => {
        if (!isHydrated || tab !== "direct" || !selectedConv || selectedConv.isDeleted) {
            setPeerTyping(false);
            return;
        }

        const fetchTyping = async () => {
            try {
                const res = await fetch(`/api/messages/typing?with=${encodeURIComponent(selectedConv.userId)}`);
                if (!res.ok) return;
                const data = await res.json();
                setPeerTyping(Boolean(data.typing));
            } catch {
                // ignore
            }
        };

        fetchTyping();
        const interval = setInterval(() => {
            if (document.visibilityState === "visible") fetchTyping();
        }, 2000);

        return () => {
            clearInterval(interval);
            setPeerTyping(false);
        };
    }, [isHydrated, tab, selectedConv?.userId, selectedConv?.isDeleted]);

    useEffect(() => {
        return () => {
            if (typingPingRef.current) clearTimeout(typingPingRef.current);
            if (typingActiveRef.current) {
                typingActiveRef.current = false;
            }
        };
    }, [selectedConv?.userId, tab]);

    useEffect(() => {
        shouldForceScrollRef.current = true;
        isNearBottomRef.current = true;
    }, [tab, selectedConv?.userId, mobileShowChat]);

    useEffect(() => {
        const container = messagesScrollRef.current;
        if (!container) return;
        const onScroll = () => {
            isNearBottomRef.current = isScrollNearBottom(container);
        };
        container.addEventListener("scroll", onScroll, { passive: true });
        return () => container.removeEventListener("scroll", onScroll);
    }, [tab, selectedConv?.userId, mobileShowChat, isHydrated]);

    useEffect(() => {
        const container = messagesScrollRef.current;
        if (!container) return;
        if (!shouldForceScrollRef.current && !isNearBottomRef.current) return;
        requestAnimationFrame(() => {
            scrollMessagesToBottom();
            shouldForceScrollRef.current = false;
            isNearBottomRef.current = true;
        });
    }, [messages, scrollMessagesToBottom]);

    // Edit window tracker
    useEffect(() => {
        const check = () => {
            const now = Date.now();
            const expired: Record<string, boolean> = {};
            messages.forEach(m => {
                if (m.sender.id === currentUserId && m.type === "TEXT") {
                    expired[m.id] = now - new Date(m.createdAt).getTime() > 2 * 60 * 1000;
                }
            });
            setEditExpired(expired);
        };
        check();
        const t = setInterval(check, 5000);
        return () => clearInterval(t);
    }, [messages, currentUserId]);

    const mentionableUsers = useMemo(() => {
        const allUsers: { id: string; name: string }[] = [];
        conversations.forEach(c => allUsers.push({ id: c.userId, name: c.name }));
        return allUsers;
    }, [conversations]);

    const filteredMentions = useMemo(() => {
        if (!mentionQuery) return mentionableUsers;
        return mentionableUsers.filter(u => u.name.toLowerCase().includes(mentionQuery.toLowerCase()));
    }, [mentionableUsers, mentionQuery]);

    const sortedConversations = useMemo(() => {
        return sortConversationsByActivity(
            conversations.map((conversation) => ({
                ...conversation,
                lastMessageAt: conversationActivity[conversation.userId] ?? conversation.lastMessageAt ?? null,
            }))
        );
    }, [conversations, conversationActivity]);

    const lastOutgoingMessageId = useMemo(() => {
        if (tab !== "direct") return null;
        for (let i = messages.length - 1; i >= 0; i -= 1) {
            const message = messages[i];
            if (message.sender.id === currentUserId && !message.isGeneral) {
                return message.id;
            }
        }
        return null;
    }, [messages, currentUserId, tab]);

    /* ─── Input Handling ────────────────────────────── */
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInput(val);

        if (tab === "direct" && selectedConv && !selectedConv.isDeleted) {
            if (val.trim()) pulseTyping();
            else stopTyping();
        }

        // Check for @ trigger
        const lastAt = val.lastIndexOf("@");
        if (lastAt >= 0 && (lastAt === 0 || val[lastAt - 1] === " ")) {
            const query = val.slice(lastAt + 1);
            if (!query.includes(" ")) {
                setShowMentionDropdown(true);
                setMentionQuery(query);
            } else {
                setShowMentionDropdown(false);
            }
        } else {
            setShowMentionDropdown(false);
        }
    };

    const insertMention = (user: { id: string; name: string }) => {
        const lastAt = input.lastIndexOf("@");
        const before = input.slice(0, lastAt);
        setInput(`${before}@${user.name} `);
        setShowMentionDropdown(false);
        inputRef.current?.focus();
    };

    /* ─── Actions ────────────────────────────────────── */
    const extractMentions = (text: string): string[] => {
        const mentioned: string[] = [];
        mentionableUsers.forEach(u => {
            if (text.includes(`@${u.name}`)) mentioned.push(u.id);
        });
        return mentioned;
    };

    const send = async () => {
        if ((!input.trim() && !stagedMedia) || sending) return;
        stopTyping();
        setSending(true);

        const currentInput = input.trim() || undefined;
        const currentMedia = stagedMedia;
        const currentReply = replyTo;
        const mentions = extractMentions(input);

        // Optimistic UI Update - Instantly show the message on screen without waiting for the server
        const optimisticId = `temp-${Date.now()}`;
        const newMsg: Message = {
            id: optimisticId,
            content: currentInput,
            mediaUrl: currentMedia?.url,
            type: currentMedia ? currentMedia.type : "TEXT",
            isGeneral: tab === "general",
            receiverId: (tab === "direct" && selectedConv) ? selectedConv.userId : undefined,
            isPinned: false,
            status: "SENT",
            mentions,
            createdAt: new Date().toISOString(),
            reactions: [],
            sender: { id: currentUserId, role: currentUserRole },
            replyTo: currentReply ? {
                id: currentReply.id,
                content: currentReply.content,
                type: currentReply.type,
                sender: currentReply.sender
            } : undefined
        };
        
        shouldForceScrollRef.current = true;
        setMessages(prev => [...prev, newMsg]);

        if (tab === "direct" && selectedConv) {
            setConversationActivity((prev) => ({
                ...prev,
                [selectedConv.userId]: newMsg.createdAt,
            }));
        }

        // Instantly clear inputs for zero latency feel
        setInput("");
        setStagedMedia(null);
        setReplyTo(null);

        try {
            await fetch("/api/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: currentInput,
                    isGeneral: tab === "general",
                    receiverId: newMsg.receiverId,
                    type: newMsg.type,
                    mediaUrl: newMsg.mediaUrl,
                    replyToId: currentReply?.id,
                    mentions,
                }),
            });
            fetchMessages(); // Pull the real DB message to replace the temporary optimistic one
        } catch (e) {
            console.error("Failed to send message", e);
            // Optionally remove the optimistic message on fail
            setMessages(prev => prev.filter(m => m.id !== optimisticId));
        } finally {
            setSending(false);
        }
    };

    const saveEdit = async (id: string) => {
        if (!editText.trim()) return;
        const res = await fetch("/api/messages", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, content: editText.trim() }),
        });
        if (res.ok) {
            const updated = await res.json();
            setMessages(prev => prev.map(m => m.id === id ? { ...m, content: updated.content } : m));
        }
        setEditingId(null);
        setEditText("");
    };

    const deleteMessage = async (id: string) => {
        setMenuOpenId(null);
        if (!confirm("Delete this message?")) return;
        const res = await fetch("/api/messages", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
        });
        if (res.ok) {
            setMessages(prev => prev.filter(m => m.id !== id));
        } else {
            const data = await res.json().catch(() => ({}));
            alert(data.error ?? "Could not delete message");
        }
    };

    const toggleReaction = async (messageId: string, emoji: string) => {
        setReactionPickerId(null);
        const res = await fetch("/api/messages", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: messageId, action: "react", emoji }),
        });
        if (res.ok) {
            const { reactions } = await res.json();
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
        }
    };

    const togglePin = async (id: string) => {
        setMenuOpenId(null);
        const res = await fetch("/api/messages", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, action: "togglePin" }),
        });
        if (res.ok) {
            const updated = await res.json();
            setMessages(prev => prev.map(m => m.id === id ? { ...m, isPinned: updated.isPinned } : m));
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || uploading) return;
        setUploading(true);
        try {
            const url = await uploadMediaFile(file);
            const isVideo = file.type.startsWith("video/");
            setStagedMedia({ url, type: isVideo ? "VIDEO" : "IMAGE" });
        } catch (error) {
            alert(error instanceof Error ? error.message : "Upload failed");
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    /* ─── Derived ────────────────────────────────────── */
    const pinnedMessages = messages.filter(m => m.isPinned);
    const canPin = ["COACH", "SUPER_ADMIN"].includes(currentUserRole) || tab === "direct";
    const isAdmin = currentUserRole === "SUPER_ADMIN";

    // Group reactions for display
    const groupReactions = (reactions: ReactionData[]) => {
        const map: Record<string, { emoji: string; count: number; userIds: string[]; names: string[] }> = {};
        reactions.forEach(r => {
            if (!map[r.emoji]) map[r.emoji] = { emoji: r.emoji, count: 0, userIds: [], names: [] };
            map[r.emoji].count++;
            map[r.emoji].userIds.push(r.userId);
            map[r.emoji].names.push(r.user.name || "User");
        });
        return Object.values(map);
    };

    // Render @mentions with highlights
    const renderContent = (text: string) => {
        const parts = text.split(/(@\w[\w\s]*?)(?=\s|$)/g);
        return parts.map((part, i) => {
            const isMention = part.startsWith("@") && mentionableUsers.some(u => part === `@${u.name}`);
            if (isMention) {
                return <span key={i} className="text-brand-400 font-bold">{part}</span>;
            }
            return <span key={i}>{part}</span>;
        });
    };

    const STATUS_LABELS: Record<Message["status"], string> = {
        SENT: "Sent",
        DELIVERED: "Delivered",
        SEEN: "Seen",
    };

    const StatusIcon = ({ status }: { status: Message["status"] }) => {
        const label = STATUS_LABELS[status] ?? "Sent";
        if (status === "SEEN") {
            return (
                <span className="inline-flex items-center" title={label} aria-label={label}>
                    <CheckCheck className="w-3.5 h-3.5 text-brand-400" />
                </span>
            );
        }
        if (status === "DELIVERED") {
            return (
                <span className="inline-flex items-center" title={label} aria-label={label}>
                    <CheckCheck className="w-3.5 h-3.5 text-fg-subtle" />
                </span>
            );
        }
        return (
            <span className="inline-flex items-center" title={label} aria-label={label}>
                <Check className="w-3.5 h-3.5 text-fg-subtle" />
            </span>
        );
    };

    const TypingDots = () => (
        <span className="inline-flex items-center gap-1" aria-label="Typing">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce [animation-delay:120ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce [animation-delay:240ms]" />
        </span>
    );

    const renderActionCard = (msg: Message, isMine: boolean) => {
        if (!msg.actionType) return null;

        if (msg.actionType === "PLAN_ASSIGNED") {
            const href = msg.actionEntityId ? `/plans?highlight=${msg.actionEntityId}` : "/plans";
            return (
                <Link
                    href={href}
                    className={cn(
                        "mt-2 flex items-center gap-3 p-3 rounded-xl border transition-colors",
                        isMine
                            ? "bg-white/10 border-white/20 hover:bg-white/15"
                            : "bg-brand-500/5 border-brand-500/20 hover:bg-brand-500/10"
                    )}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                        isMine ? "bg-white/15" : "bg-brand-500/15"
                    )}>
                        <Dumbbell className={cn("w-4 h-4", isMine ? "text-white" : "text-brand-400")} />
                    </div>
                    <div className="min-w-0">
                        <p className={cn("text-xs font-black", isMine ? "text-white" : "text-fg")}>Workout plan assigned</p>
                        <p className={cn("text-[10px] font-medium", isMine ? "text-white/70" : "text-brand-400")}>View plan →</p>
                    </div>
                </Link>
            );
        }

        if (msg.actionType === "CHECKIN_REQUEST") {
            return (
                <Link
                    href="/checkins"
                    className={cn(
                        "mt-2 flex items-center gap-3 p-3 rounded-xl border transition-colors",
                        isMine
                            ? "bg-white/10 border-white/20 hover:bg-white/15"
                            : "bg-warning/5 border-warning/20 hover:bg-warning/10"
                    )}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                        isMine ? "bg-white/15" : "bg-warning/15"
                    )}>
                        <ClipboardList className={cn("w-4 h-4", isMine ? "text-white" : "text-warning")} />
                    </div>
                    <div className="min-w-0">
                        <p className={cn("text-xs font-black", isMine ? "text-white" : "text-fg")}>Check-in requested</p>
                        <p className={cn("text-[10px] font-medium", isMine ? "text-white/70" : "text-warning")}>Submit check-in →</p>
                    </div>
                </Link>
            );
        }

        return null;
    };

    /* ─── Sidebar Content ────────────────────────────── */
    const renderSidebar = () => (
        <div className="w-full sm:w-72 border-r border-surface-border flex flex-col bg-surface-card h-full min-h-0">
            {/* Tab Switcher */}
            <div className="p-3 border-b border-surface-border flex items-center gap-2">
                <div className="flex gap-1 bg-surface-muted p-1 rounded-xl flex-1">
                    <button
                        onClick={() => handleTabChange("direct")}
                        className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all",
                            tab === "direct" ? "bg-surface-card text-fg shadow-sm" : "text-fg-muted hover:text-fg")}
                    >
                        <MessageSquare className="w-3 h-3" /> Direct
                    </button>
                    <button
                        onClick={() => handleTabChange("general")}
                        className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all",
                            tab === "general" ? "bg-surface-card text-fg shadow-sm" : "text-fg-muted hover:text-fg")}
                    >
                        <Globe className="w-3 h-3" /> Global
                    </button>
                </div>
                <Link href="/settings" className="btn-icon shrink-0 sm:hidden" aria-label="Settings">
                    <Settings className="w-4 h-4" />
                </Link>
            </div>

            {/* Conversation List */}
            {tab === "direct" && (
                <div className="flex-1 overflow-y-auto p-2 space-y-0.5 no-scrollbar">
                    {!canUseDirectChat ? (
                        <div className="p-6 text-center space-y-3">
                            <p className="text-sm font-bold text-fg">Direct coach chat is Premium</p>
                            <p className="text-xs text-fg-muted">Redeem an access code from your coach in Settings to unlock 1-on-1 messaging. Global chat is still available.</p>
                        </div>
                    ) : sortedConversations.length === 0 ? (
                        <p className="text-xs text-fg-muted text-center p-6">No conversations yet</p>
                    ) : (
                        sortedConversations.map((conv) => {
                            const session = activeSessions[conv.userId];
                            const presence = canViewLastOnline && !session
                                ? getPresenceIndicator(resolveLastActive(conv.userId))
                                : null;

                            return (
                            <button
                                key={conv.userId}
                                onClick={() => selectConversation(conv)}
                                className={cn("w-full text-left flex items-center gap-3 p-3 rounded-xl transition-all relative",
                                    selectedConv?.userId === conv.userId
                                        ? "bg-brand-500/10 border border-brand-500/20"
                                        : "hover:bg-surface-muted border border-transparent",
                                    conv.isDeleted && "opacity-50 grayscale bg-surface-muted/5 border-dashed border-surface-border/50"
                                )}
                            >
                                <div className="relative w-10 h-10 shrink-0">
                                    <ProfileLink
                                        userId={conv.userId}
                                        name={conv.name}
                                        avatarUrl={conv.avatarUrl}
                                        role={conv.role}
                                        showAvatar
                                        avatarSize="md"
                                        stopPropagation
                                        disabled={conv.isDeleted}
                                        className="relative w-10 h-10"
                                        nameClassName="sr-only"
                                    />
                                    {canViewLastOnline && presence && (
                                        <span
                                            className={cn(
                                                "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-surface",
                                                presence.dotClassName
                                            )}
                                            title={presence.label}
                                        />
                                    )}
                                    {canViewLastOnline && session && (
                                        <span
                                            className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-surface bg-success animate-pulse"
                                            title={`In workout: ${session.workoutName}`}
                                        />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-1">
                                        <ProfileLink
                                            userId={conv.userId}
                                            name={
                                                <>
                                                    {conv.name}
                                                    {conv.isDeleted && <span className="text-[9px] text-danger/80 ml-1.5 font-bold uppercase tracking-wider">(Deleted)</span>}
                                                </>
                                            }
                                            role={conv.role}
                                            stopPropagation
                                            disabled={conv.isDeleted}
                                            nameClassName="text-sm font-bold truncate"
                                            className="min-w-0"
                                        />
                                        {["COACH", "SUPER_ADMIN"].includes(conv.role) && (
                                            <Star className="w-3 h-3 text-brand-400 fill-brand-400 shrink-0" />
                                        )}
                                    </div>
                                    {canViewLastOnline && session ? (
                                        <p className="text-[10px] text-success font-bold truncate flex items-center gap-1">
                                            <Activity className="w-3 h-3 shrink-0" />
                                            In workout · {session.workoutName}
                                        </p>
                                    ) : canViewLastOnline && presence ? (
                                        <p className="text-[10px] text-fg-subtle truncate">{presence.label}</p>
                                    ) : (
                                        <p className="text-[10px] uppercase font-bold tracking-widest text-fg-subtle">
                                            {conv.isDeleted ? "Inactive" : (roleLabels[conv.role] ?? conv.role)}
                                        </p>
                                    )}
                                </div>
                            </button>
                            );
                        })
                    )}

                    {isCoachUser && tab === "direct" && canUseDirectChat && (
                        <div className="p-3 border-t border-surface-border shrink-0">
                            <CoachChatTools
                                conversations={sortedConversations}
                                coachPlans={coachPlans}
                                onComplete={fetchMessages}
                            />
                        </div>
                    )}
                </div>
            )}

            {tab === "general" && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <div>
                        <Globe className="w-10 h-10 text-brand-400/30 mx-auto mb-3" />
                        <p className="text-sm font-bold text-fg-muted">Community Chat</p>
                        <p className="text-[10px] text-fg-subtle mt-1 mb-6">Open to all members</p>
                    </div>
                </div>
            )}
        </div>
    );

    /* ─── Main Render ────────────────────────────────── */
    if (!isHydrated) return null;

    return (
        <div
            className="flex overflow-hidden bg-surface animate-fade-in fixed inset-x-0 top-0 bottom-20 z-40 w-full max-w-full md:static md:z-auto md:h-[calc(100dvh-4rem)] md:bottom-auto"
            onClick={() => { setMenuOpenId(null); setReactionPickerId(null); setActiveMessageId(null); }}
        >
            
            {viewerMedia && (
                <MediaLightbox 
                    src={viewerMedia.src} 
                    type={viewerMedia.type} 
                    onClose={() => setViewerMedia(null)} 
                />
            )}

            {/* Desktop Sidebar */}
            <div className="hidden sm:flex">
                {renderSidebar()}
            </div>

            {/* Mobile: Show sidebar or chat */}
            {!mobileShowChat && (
                <div className="sm:hidden flex-1 flex flex-col min-w-0 min-h-0">
                    {renderSidebar()}
                </div>
            )}

            {/* Chat Area */}
            <div className={cn("flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden", !mobileShowChat && "hidden sm:flex")}>
                {/* ── Header ── */}
                <div className="h-14 flex items-center justify-between px-5 border-b border-surface-border bg-surface-card/95 backdrop-blur-md shrink-0 z-10">
                    <div className="flex items-center gap-3">
                        <button 
                            className="sm:hidden flex items-center gap-1 text-brand-400 font-bold hover:text-brand-300 transition-colors bg-brand-400/10 hover:bg-brand-400/20 px-2 py-1.5 rounded-lg -ml-2" 
                            onClick={() => setMobileShowChat(false)}
                        >
                            <ChevronDown className="w-5 h-5 rotate-90" />
                        </button>
                        {tab === "general" ? (
                            <>
                                <Globe className="w-5 h-5 text-brand-400" />
                                <div>
                                    <p className="font-bold text-sm">General Chat</p>
                                    <p className="text-[10px] text-fg-muted font-medium">Community</p>
                                </div>
                            </>
                        ) : selectedConv ? (
                            <>
                                <div className="relative w-8 h-8 shrink-0">
                                    <ProfileLink
                                        userId={selectedConv.userId}
                                        name={selectedConv.name}
                                        avatarUrl={selectedConv.avatarUrl}
                                        role={selectedConv.role}
                                        showAvatar
                                        avatarSize="sm"
                                        disabled={selectedConv.isDeleted}
                                        className="w-8 h-8"
                                        nameClassName="sr-only"
                                    />
                                    {selectedPresence && (
                                        <span
                                            className={cn(
                                                "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-surface-card",
                                                selectedPresence.dotClassName
                                            )}
                                            title={selectedPresence.label}
                                        />
                                    )}
                                </div>
                                <div>
                                    <ProfileLink
                                        userId={selectedConv.userId}
                                        name={selectedConv.name}
                                        role={selectedConv.role}
                                        disabled={selectedConv.isDeleted}
                                        nameClassName="font-bold text-sm"
                                    />
                                    {peerTyping ? (
                                        <p className="text-[10px] text-brand-400 font-medium flex items-center gap-1.5">
                                            typing
                                            <TypingDots />
                                        </p>
                                    ) : selectedActiveSession ? (
                                        <p className="text-[10px] text-success font-bold flex items-center gap-1 truncate">
                                            <Activity className="w-3 h-3 shrink-0" />
                                            In workout · {selectedActiveSession.workoutName}
                                        </p>
                                    ) : canViewLastOnline && selectedPresence ? (
                                        <p className="text-[10px] text-fg-subtle font-medium truncate">{selectedPresence.label}</p>
                                    ) : (
                                        <p className="text-[10px] text-fg-muted font-medium">{roleLabels[selectedConv.role] ?? selectedConv.role}</p>
                                    )}
                                </div>
                            </>
                        ) : (
                            <p className="text-fg-muted text-sm">Select a conversation</p>
                        )}
                    </div>

                    <div className="flex items-center gap-1">
                    {pinnedMessages.length > 0 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowPinned(!showPinned); }}
                            className={cn("btn-icon relative", showPinned && "text-brand-400")}
                        >
                            <Pin className="w-4 h-4" />
                            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">
                                {pinnedMessages.length}
                            </span>
                        </button>
                    )}
                    <Link href="/settings" className="btn-icon sm:hidden" aria-label="Settings">
                        <Settings className="w-4 h-4" />
                    </Link>
                    </div>
                </div>

                {/* ── Pinned Messages Banner ── */}
                {showPinned && pinnedMessages.length > 0 && (
                    <div className="border-b border-surface-border bg-brand-500/5 px-5 py-3 space-y-2 animate-slide-up max-h-40 overflow-y-auto no-scrollbar shrink-0">
                        <div className="flex items-center gap-2 mb-1">
                            <Pin className="w-3 h-3 text-brand-400" />
                            <span className="text-[10px] font-black text-brand-400 uppercase tracking-widest">Pinned Messages</span>
                        </div>
                        {pinnedMessages.map(pm => (
                            <div key={pm.id} className="flex items-center gap-2 text-xs text-fg-muted">
                                <ProfileLink
                                    userId={pm.sender.id}
                                    name={`${pm.sender.name}:`}
                                    role={pm.sender.role}
                                    nameClassName="font-bold"
                                    className="inline-flex shrink-0"
                                />
                                <span className="truncate">{pm.content || "[media]"}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Messages ── */}
                {tab === "direct" && peerTyping && selectedConv && (
                    <div className="px-5 py-2 border-b border-surface-border/60 bg-brand-500/5 shrink-0">
                        <p className="text-[11px] text-brand-400 font-medium flex items-center gap-2">
                            <span className="font-bold">{selectedConv.name}</span>
                            is typing
                            <TypingDots />
                        </p>
                    </div>
                )}
                <div
                    ref={messagesScrollRef}
                    className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 space-y-3 no-scrollbar"
                    onClick={(e) => {
                        if ((e.target as HTMLElement).closest("[data-chat-action]")) {
                            e.stopPropagation();
                        }
                    }}
                >
                    {messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <MessageSquare className="w-10 h-10 text-fg-subtle/20 mx-auto mb-3" />
                                <p className="text-fg-muted text-sm font-medium">No messages yet. Say hello! 👋</p>
                            </div>
                        </div>
                    ) : (
                        messages.map((msg, idx) => {
                            const isMine = msg.sender.id === currentUserId;
                            const canEdit = isMine && msg.type === "TEXT" && !editExpired[msg.id];
                            const isEditing = editingId === msg.id;
                            const reactions = groupReactions(msg.reactions || []);

                            // Show date separator
                            const prevMsg = idx > 0 ? messages[idx - 1] : null;
                            const showDate = !prevMsg || new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();

                            const renderMessageActions = () => {
                                if (isEditing) return null;

                                const visible = activeMessageId === msg.id || menuOpenId === msg.id || reactionPickerId === msg.id;
                                const popoverAlign = isMine ? "right-0 left-auto" : "left-0 right-auto";
                                const actionVisibility = visible
                                    ? "opacity-100 pointer-events-auto"
                                    : "opacity-0 pointer-events-none sm:group-hover:opacity-100 sm:group-hover:pointer-events-auto";

                                return (
                                    <div
                                        data-chat-action
                                        aria-hidden={!visible}
                                        className={cn(
                                            "absolute z-20 flex items-center gap-0.5 transition-opacity",
                                            isMine ? "right-0 top-full mt-1 sm:top-1/2 sm:mt-0 sm:-translate-y-1/2 sm:right-full sm:mr-1.5" : "left-0 top-full mt-1 sm:top-1/2 sm:mt-0 sm:-translate-y-1/2 sm:left-full sm:ml-1.5",
                                            actionVisibility
                                        )}
                                    >
                                        {renderActionButtons(popoverAlign)}
                                    </div>
                                );
                            };

                            const renderActionButtons = (popoverAlign: string) => (
                                <>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setReplyTo(msg); inputRef.current?.focus(); }}
                                            className="btn-icon w-7 h-7 rounded-lg"
                                            title="Reply"
                                        >
                                            <Reply className="w-3.5 h-3.5" />
                                        </button>

                                        <div className="relative">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveMessageId(msg.id);
                                                    setReactionPickerId(reactionPickerId === msg.id ? null : msg.id);
                                                    setMenuOpenId(null);
                                                }}
                                                className="btn-icon w-7 h-7 rounded-lg"
                                                title="React"
                                            >
                                                <SmilePlus className="w-3.5 h-3.5" />
                                            </button>
                                            {reactionPickerId === msg.id && (
                                                <div
                                                    className={cn(
                                                        "absolute top-full mt-1 z-50 grid grid-cols-3 gap-1.5 bg-surface-elevated border border-surface-border rounded-2xl p-2 shadow-modal animate-scale-in w-max max-w-[min(100vw-2rem,240px)]",
                                                        popoverAlign
                                                    )}
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    {REACTION_EMOJIS.map(emoji => (
                                                        <button
                                                            key={emoji}
                                                            onClick={() => toggleReaction(msg.id, emoji)}
                                                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-muted transition-colors text-base"
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {(isMine || canPin || isAdmin) && (
                                            <div className="relative">
                                                <button
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        setActiveMessageId(msg.id);
                                                        setMenuOpenId(menuOpenId === msg.id ? null : msg.id);
                                                        setReactionPickerId(null);
                                                    }}
                                                    className="btn-icon w-7 h-7 rounded-lg"
                                                >
                                                    <MoreVertical className="w-3.5 h-3.5" />
                                                </button>
                                                {menuOpenId === msg.id && (
                                                    <div
                                                        className={cn(
                                                            "absolute top-full mt-1 z-50 bg-surface-elevated border border-surface-border rounded-xl shadow-modal overflow-hidden min-w-[140px] w-max",
                                                            popoverAlign
                                                        )}
                                                        onClick={e => e.stopPropagation()}
                                                    >
                                                        {canPin && (
                                                            <button
                                                                onClick={() => togglePin(msg.id)}
                                                                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-fg hover:bg-surface-muted transition-colors"
                                                            >
                                                                <Pin className="w-3.5 h-3.5 text-brand-400" />
                                                                {msg.isPinned ? "Unpin" : "Pin"}
                                                            </button>
                                                        )}
                                                        {isMine && canEdit && (
                                                            <button
                                                                onClick={() => { setEditingId(msg.id); setEditText(msg.content ?? ""); setMenuOpenId(null); }}
                                                                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-fg hover:bg-surface-muted transition-colors"
                                                            >
                                                                <Pencil className="w-3.5 h-3.5 text-brand-400" /> Edit
                                                            </button>
                                                        )}
                                                        {(isMine || isAdmin) && (
                                                            <button
                                                                onClick={() => deleteMessage(msg.id)}
                                                                className={cn(
                                                                    "w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-danger hover:bg-danger/5 transition-colors",
                                                                    (canPin || (isMine && canEdit)) && "border-t border-surface-border"
                                                                )}
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" /> Delete
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                );
                            };

                            return (
                                <div key={msg.id}>
                                    {showDate && (
                                        <div className="flex items-center gap-3 py-3">
                                            <div className="flex-1 h-px bg-surface-border" />
                                            <span className="text-[10px] font-bold text-fg-subtle uppercase tracking-widest">
                                                {new Date(msg.createdAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                            </span>
                                            <div className="flex-1 h-px bg-surface-border" />
                                        </div>
                                    )}

                                    <div
                                        ref={(el) => { messageRowRefs.current[msg.id] = el; }}
                                        className={cn("flex items-end gap-2 group w-full", isMine && "justify-end")}
                                        onClick={(e) => {
                                            if (window.matchMedia("(min-width: 640px)").matches) return;
                                            const target = e.target as HTMLElement;
                                            if (target.closest("[data-chat-action], button, a, input, video, img")) return;
                                            e.stopPropagation();
                                            setActiveMessageId((prev) => (prev === msg.id ? null : msg.id));
                                            setMenuOpenId(null);
                                            setReactionPickerId(null);
                                        }}
                                    >
                                        {/* Avatar */}
                                        {!isMine && (
                                            <ProfileLink
                                                userId={msg.sender.id}
                                                name={msg.sender.name}
                                                avatarUrl={msg.sender.avatarUrl}
                                                role={msg.sender.role}
                                                showAvatar
                                                avatarSize="xs"
                                                stopPropagation
                                                className="mb-5 shrink-0"
                                                nameClassName="sr-only"
                                            />
                                        )}

                                        <div className={cn("relative w-fit max-w-[min(62%,17rem)] min-w-0 overflow-visible", isMine && "items-end flex flex-col")}>
                                            {/* Sender name */}
                                            {!isMine && (
                                                <ProfileLink
                                                    userId={msg.sender.id}
                                                    name={msg.sender.name}
                                                    role={msg.sender.role}
                                                    stopPropagation
                                                    className="mb-1 ml-1"
                                                    nameClassName="text-[10px] font-bold"
                                                />
                                            )}

                                            {/* Reply preview */}
                                            {msg.replyTo && (
                                                <div className={cn(
                                                    "text-[10px] px-3 py-1.5 rounded-lg mb-1 max-w-xs truncate border-l-2",
                                                    isMine
                                                        ? "bg-white/5 border-l-white/20 text-white/60"
                                                        : "bg-surface-elevated border-l-brand-500/40 text-fg-muted"
                                                )}>
                                                    <span className="font-bold">{msg.replyTo.sender.name}</span>: {msg.replyTo.content || "[media]"}
                                                </div>
                                            )}

                                            {/* Message content */}
                                            {isEditing ? (
                                                <div className="flex items-center gap-2 min-w-[200px]">
                                                    <input
                                                        autoFocus
                                                        className="input flex-1 h-9 text-[16px] sm:text-sm py-0 px-3"
                                                        value={editText}
                                                        onChange={e => setEditText(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === "Enter") saveEdit(msg.id);
                                                            if (e.key === "Escape") { setEditingId(null); setEditText(""); }
                                                        }}
                                                    />
                                                    <button onClick={() => saveEdit(msg.id)} className="btn-icon w-8 h-8 bg-success/10 text-success hover:bg-success/20"><Check className="w-4 h-4" /></button>
                                                    <button onClick={() => { setEditingId(null); setEditText(""); }} className="btn-icon w-8 h-8"><X className="w-4 h-4" /></button>
                                                </div>
                                            ) : msg.type === "TEXT" ? (
                                                <div className={cn(
                                                     isMine ? "bubble-sent break-words" : "bubble-received break-words",
                                                     (!isMine && msg.mentions?.includes(currentUserId)) && "border-l-4 border-l-warning bg-warning/5 border-y-warning/20 border-r-warning/20 shadow-[0_0_12px_rgba(245,158,11,0.15)] text-fg",
                                                     msg.isPinned && "ring-1 ring-brand-400/30"
                                                 )}>
                                                    {renderContent(msg.content || "")}
                                                    {msg.updatedAt && (new Date(msg.updatedAt).getTime() - new Date(msg.createdAt).getTime() > 1000) && (
                                                        <span className="text-[9px] opacity-50 ml-2 italic">(edited)</span>
                                                    )}
                                                    {renderActionCard(msg, isMine)}
                                                </div>
                                            ) : msg.type === "VIDEO" || msg.type === "IMAGE" ? (
                                                <div className={cn(
                                                    "flex flex-col gap-1.5",
                                                    isMine ? "items-end" : "items-start"
                                                )}>
                                                    {msg.type === "VIDEO" ? (
                                                        <div
                                                            className={cn(
                                                                "relative cursor-pointer overflow-hidden shadow-sm hover:opacity-95 transition-opacity",
                                                                CHAT_MEDIA_THUMB
                                                            )}
                                                            onClick={() => msg.mediaUrl && setViewerMedia({ src: resolveUploadUrl(msg.mediaUrl), type: "VIDEO" })}
                                                        >
                                                            <video src={resolveUploadUrl(msg.mediaUrl)} className="w-full h-full object-cover pointer-events-none" />
                                                            <div className="absolute inset-0 bg-black/25 flex items-center justify-center transition-colors hover:bg-black/15">
                                                                <div className="w-9 h-9 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center text-white">
                                                                    <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-white border-b-[6px] border-b-transparent ml-0.5" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <img
                                                            src={resolveUploadUrl(msg.mediaUrl)}
                                                            alt="media"
                                                            className={cn(
                                                                CHAT_MEDIA_THUMB,
                                                                "cursor-pointer hover:opacity-90 transition-opacity shadow-sm"
                                                            )}
                                                            onClick={() => msg.mediaUrl && setViewerMedia({ src: resolveUploadUrl(msg.mediaUrl), type: "IMAGE" })}
                                                        />
                                                    )}
                                                    {msg.content?.trim() && (
                                                        <div className={cn(
                                                            isMine ? "bubble-sent break-words" : "bubble-received break-words",
                                                            (!isMine && msg.mentions?.includes(currentUserId)) && "border-l-4 border-l-warning bg-warning/5 border-y-warning/20 border-r-warning/20 shadow-[0_0_12px_rgba(245,158,11,0.15)] text-fg",
                                                            msg.isPinned && "ring-1 ring-brand-400/30"
                                                        )}>
                                                            {renderContent(msg.content)}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : null}

                                            {/* Reactions */}
                                            {reactions.length > 0 && (
                                                <div className={cn("flex flex-wrap gap-1 mt-1", isMine && "justify-end")}>
                                                    {reactions.map(r => (
                                                        <button
                                                            key={r.emoji}
                                                            onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, r.emoji); }}
                                                            className={cn(
                                                                "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all border",
                                                                r.userIds.includes(currentUserId)
                                                                    ? "bg-brand-500/10 border-brand-500/30 text-brand-400"
                                                                    : "bg-surface-muted/50 border-surface-border text-fg-muted hover:bg-surface-muted"
                                                            )}
                                                            title={r.names.join(", ")}
                                                        >
                                                            <span>{r.emoji}</span>
                                                            {r.count > 1 && <span className="text-[10px] font-bold">{r.count}</span>}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Timestamp + Status */}
                                            <div className={cn("flex items-center gap-1.5 mt-1", isMine && "justify-end")}>
                                                <p className="text-[10px] text-fg-subtle">{formatRelative(msg.createdAt)}</p>
                                                {isMine && tab === "direct" && !msg.isGeneral && (
                                                    <>
                                                        <StatusIcon status={msg.status} />
                                                        {msg.id === lastOutgoingMessageId && msg.status === "SEEN" && (
                                                            <span className="text-[9px] font-bold uppercase tracking-wider text-brand-400/80">Seen</span>
                                                        )}
                                                        {msg.id === lastOutgoingMessageId && msg.status === "DELIVERED" && (
                                                            <span className="text-[9px] font-bold uppercase tracking-wider text-fg-subtle">Delivered</span>
                                                        )}
                                                    </>
                                                )}
                                                {msg.isPinned && <Pin className="w-2.5 h-2.5 text-brand-400" />}
                                            </div>

                                            {renderMessageActions()}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* ── Input Area ── */}
                {tab === "direct" && selectedConv?.isDeleted ? (
                    <div className="px-5 py-4 border-t border-surface-border bg-surface-muted/30 shrink-0 text-center flex flex-col items-center justify-center">
                        <p className="text-xs font-black uppercase tracking-widest text-danger/70">Account Deleted</p>
                        <p className="text-[10px] text-fg-subtle mt-0.5">This user&apos;s account has been deleted. You cannot send new messages.</p>
                    </div>
                ) : (
                    <div className="px-4 sm:px-5 py-3 border-t border-surface-border bg-surface-card shrink-0">
                        {isCoachUser && tab === "direct" && selectedConv && !selectedConv.isDeleted && (
                            <div className="mb-2">
                                <CoachChatTools
                                    conversations={sortedConversations}
                                    coachPlans={coachPlans}
                                    selectedClientId={selectedConv.userId}
                                    onComplete={fetchMessages}
                                />
                            </div>
                        )}

                        {/* Reply preview */}
                        {replyTo && (
                            <div className="flex items-center justify-between gap-3 mb-2 px-3 py-2 bg-surface-muted/50 rounded-xl border-l-2 border-l-brand-500 animate-slide-up">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold text-brand-400">Replying to {replyTo.sender.name}</p>
                                    <p className="text-xs text-fg-muted truncate">{replyTo.content || "[media]"}</p>
                                </div>
                                <button onClick={() => setReplyTo(null)} className="btn-icon w-6 h-6 shrink-0">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        )}

                        {/* Staged media */}
                        {stagedMedia && (
                            <div className="mb-3 relative inline-block animate-slide-up">
                                <button
                                    type="button"
                                    className={cn(
                                        "relative overflow-hidden border border-brand-500/30 hover:opacity-95 transition-opacity",
                                        CHAT_MEDIA_THUMB
                                    )}
                                    onClick={() => setViewerMedia({
                                        src: resolveUploadUrl(stagedMedia.url),
                                        type: stagedMedia.type,
                                    })}
                                >
                                    {stagedMedia.type === "IMAGE" ? (
                                        <img src={resolveUploadUrl(stagedMedia.url)} alt="Staged" className="w-full h-full object-cover" />
                                    ) : (
                                        <>
                                            <video src={resolveUploadUrl(stagedMedia.url)} className="w-full h-full object-cover pointer-events-none" muted />
                                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                                <div className="w-8 h-8 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center text-white">
                                                    <div className="w-0 h-0 border-t-[5px] border-t-transparent border-l-[8px] border-l-white border-b-[5px] border-b-transparent ml-0.5" />
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </button>
                                <button onClick={() => setStagedMedia(null)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-danger rounded-full flex items-center justify-center text-white shadow-lg hover:bg-danger-600 transition-colors">
                                    <X className="w-3 h-3" strokeWidth={3} />
                                </button>
                            </div>
                        )}

                        {/* Mention dropdown */}
                        {showMentionDropdown && filteredMentions.length > 0 && (
                            <div className="mb-2 bg-surface-elevated border border-surface-border rounded-xl shadow-2xl max-h-[150px] overflow-y-auto no-scrollbar animate-slide-up">
                                {filteredMentions.map(u => (
                                    <button
                                        key={u.id}
                                        onClick={() => insertMention(u)}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-fg hover:bg-brand-500/10 hover:text-brand-400 transition-colors border-b last:border-0 border-surface-border/50"
                                    >
                                        <AtSign className="w-3 h-3 text-brand-400" />
                                        {u.name}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <input type="file" className="hidden" ref={fileRef} onChange={handleUpload} accept="image/*,video/*" />
                            <button className="btn-icon shrink-0" onClick={() => fileRef.current?.click()} disabled={uploading}>
                                <ImageIcon className={cn("w-4 h-4", stagedMedia ? "text-brand-400" : "text-fg-subtle")} />
                            </button>
                            <input
                                ref={inputRef}
                                type="text"
                                className="input flex-1 h-10 py-0 text-[16px] sm:text-sm"
                                placeholder={replyTo ? "Write a reply..." : stagedMedia ? "Add caption..." : "Message..."}
                                value={input}
                                onChange={handleInputChange}
                                onBlur={stopTyping}
                                onKeyDown={(e) => e.key === "Enter" && send()}
                            />
                            <button
                                onClick={send}
                                disabled={(!input.trim() && !stagedMedia) || sending}
                                className={cn("w-10 h-10 p-0 rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0",
                                    (input.trim() || stagedMedia) ? "btn-primary" : "bg-surface-muted text-fg-subtle")}
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
