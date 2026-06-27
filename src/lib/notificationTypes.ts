export const NOTIFICATION_TYPES = {
    CLIENT_WORKOUT: "CLIENT_WORKOUT",
    CLIENT_CHECKIN: "CLIENT_CHECKIN",
    CLIENT_BODYWEIGHT: "CLIENT_BODYWEIGHT",
    CLIENT_MISSED_WORKOUT: "CLIENT_MISSED_WORKOUT",
    CLIENT_MISSED_CHECKIN: "CLIENT_MISSED_CHECKIN",
    MISSED_CHECKIN: "MISSED_CHECKIN",
    CHECKIN_REVIEWED: "CHECKIN_REVIEWED",
    NEW_CHAT_MESSAGE: "NEW_CHAT_MESSAGE",
    COACH_BROADCAST: "COACH_BROADCAST",
    WORKOUT_FEEDBACK_ADDED: "WORKOUT_FEEDBACK_ADDED",
    PLAN_UPDATED: "PLAN_UPDATED",
    GLOBAL_ANNOUNCEMENT: "GLOBAL_ANNOUNCEMENT",
} as const;

export const QUICK_REPLY_TEMPLATES: Record<string, string> = {
    [NOTIFICATION_TYPES.CLIENT_MISSED_WORKOUT]:
        "Hey, I noticed you missed today's workout. Everything okay?",
    [NOTIFICATION_TYPES.CLIENT_MISSED_CHECKIN]:
        "Hey, I noticed you haven't completed your check-in yet. Everything okay?",
};

export function supportsQuickReply(type: string) {
    return type in QUICK_REPLY_TEMPLATES;
}

export function getQuickReplyTemplate(type: string) {
    return QUICK_REPLY_TEMPLATES[type] ?? "";
}
