import type { LegalSection } from "./common";
import { LEGAL_CONTACT_EMAIL, LEGAL_PLATFORM_NAME } from "./common";

export const PRIVACY_SECTIONS: LegalSection[] = [
    {
        title: "1. What data is collected",
        paragraphs: [
            `This Privacy Policy explains how ${LEGAL_PLATFORM_NAME} ("we", "us", "our") collects, uses, stores, and shares personal data when you use our fitness tracking and coaching platform.`,
            "We process personal data to provide the Service, support coaching relationships, maintain security, and improve the Platform. We aim to collect only data that is reasonably necessary for those purposes.",
        ],
        bullets: [
            "Account and authentication data",
            "Profile and training preferences",
            "Workout logs and performance metrics",
            "Check-ins, photos, videos, and coach feedback",
            "Chat messages and notifications",
            "Technical and usage information",
        ],
    },
    {
        title: "2. Account and profile information",
        paragraphs: [
            "When you register, we collect information such as your name, email address, role (for example client or coach), avatar, bio, onboarding responses, and account settings.",
            "Authentication is handled through our identity provider. We do not store your account password directly.",
        ],
    },
    {
        title: "3. Workout logs and training data",
        paragraphs: [
            "When you log workouts, we store exercises, sets, reps, weights, durations, notes, personal records, plan assignments, calendar activity, and related training history.",
            "This data powers progress charts, dashboards, coach review tools, and training continuity features.",
        ],
    },
    {
        title: "4. Bodyweight, calories, steps, sleep, and progress metrics",
        paragraphs: [
            "You may enter or track bodyweight, calorie targets, step counts, sleep hours, and other progress metrics depending on your profile and coaching setup.",
            "These metrics may be displayed in your dashboard, included in check-ins, and visible to assigned coaches where relevant to your coaching relationship.",
        ],
    },
    {
        title: "5. Check-ins, photos, videos, and coach feedback",
        paragraphs: [
            "The Platform supports weekly or periodic check-ins that may include bodyweight updates, progress photos, videos, written responses, and coach review notes.",
            "Sensitive fitness data and progress photos should be handled carefully. Only upload content you are comfortable sharing with your assigned coach and, where applicable, platform administrators under the rules below.",
        ],
    },
    {
        title: "6. Chat messages and notifications",
        paragraphs: [
            "We store direct messages between coaches and clients, community or broadcast messages where enabled, and in-app notifications related to workouts, check-ins, plans, and account activity.",
            "Notification preferences can be managed in Settings, although certain service-related notices may still be sent where necessary.",
        ],
    },
    {
        title: "7. How the data is used",
        paragraphs: ["We use personal data to:"],
        bullets: [
            "Provide, maintain, and secure the Platform",
            "Enable workout logging, analytics, and coaching workflows",
            "Facilitate communication between coaches and clients",
            "Send notifications you have requested or that are necessary for the Service",
            "Respond to support requests and enforce our Terms",
            "Improve reliability, performance, and user experience",
            "Comply with legal obligations",
        ],
    },
    {
        title: "8. Who can see the data",
        paragraphs: [
            "Access to your data depends on your role, coaching relationships, privacy settings, and platform permissions.",
            "We do not sell your personal data.",
        ],
    },
    {
        title: "9. Coach and client visibility rules",
        paragraphs: [
            "If you are a client with an assigned coach, that coach can view data reasonably needed to provide coaching services. This typically includes your workouts, check-ins, progress photos, videos, messages, and relevant progress metrics.",
            "Coaches can generally view data for clients currently linked to them through an active coaching relationship or access code arrangement.",
            "If you are a coach, clients can see information you share with them through plans, messages, feedback, and profile details made available on the Platform.",
            "Public profile visibility may be limited by your privacy settings where those features are available.",
        ],
    },
    {
        title: "10. Admin visibility rules",
        paragraphs: [
            "Platform administrators may access user data only when needed for support, safety, moderation, fraud prevention, legal compliance, or platform management.",
            "Administrative access is intended to be limited, logged where practicable, and used only for legitimate operational purposes.",
        ],
    },
    {
        title: "11. File uploads and media storage",
        paragraphs: [
            "Photos, videos, avatars, and other files you upload are stored using secure cloud storage providers. Files are associated with your account and served through the Platform as needed to display them to authorised viewers.",
            "You should not upload unlawful content or material you do not have rights to use. We may remove content that violates our Terms or creates risk for others.",
        ],
    },
    {
        title: "12. Cookies, authentication, and analytics",
        paragraphs: [
            "We use cookies and similar technologies required for authentication, session management, security, and core site functionality.",
            "Clerk provides authentication services and may set cookies or similar identifiers as part of sign-in and account management.",
            "We may use basic analytics or platform monitoring provided by our hosting infrastructure to understand performance, errors, and usage trends. Where non-essential analytics are used, we will aim to provide appropriate notice or consent mechanisms as required by law.",
        ],
    },
    {
        title: "13. Data retention",
        paragraphs: [
            "We retain personal data for as long as your account is active and as needed to provide the Service, resolve disputes, enforce agreements, and meet legal obligations.",
            "Some data may remain in backups for a limited period after deletion. We apply retention practices designed to minimise unnecessary storage of personal data.",
        ],
    },
    {
        title: "14. Account deletion and data removal",
        paragraphs: [
            "You may request account deletion and removal of personal data by contacting us at the email address below.",
            "We will action verified deletion requests within a reasonable timeframe, subject to legal retention requirements and the need to preserve limited records for security, dispute resolution, or compliance.",
            "Deleting your account may remove access to workout history, messages, and uploaded media. Please export anything you wish to keep before requesting deletion where the Platform provides export options.",
        ],
    },
    {
        title: "15. Your rights under GDPR",
        paragraphs: [
            "If you are in Ireland, the United Kingdom, or the European Economic Area, you may have rights under the General Data Protection Regulation (GDPR) and applicable local law, including:",
        ],
        bullets: [
            "The right to access your personal data",
            "The right to rectification of inaccurate data",
            "The right to erasure in certain circumstances",
            "The right to restrict or object to processing in certain circumstances",
            "The right to data portability where applicable",
            "The right to withdraw consent where processing is based on consent",
            "The right to lodge a complaint with your supervisory authority",
        ],
        paragraphsAfter: [
            "To exercise your rights, contact us using the details below. We may need to verify your identity before responding.",
        ],
    },
    {
        title: "16. Security",
        paragraphs: [
            "We use administrative, technical, and organisational measures designed to protect personal data, including access controls, encrypted transport, and secure hosting environments.",
            "No online service can guarantee absolute security. You should use a strong password, protect your devices, and report suspected unauthorised access promptly.",
        ],
    },
    {
        title: "17. Third-party services",
        paragraphs: [
            "We rely on trusted third-party providers to operate the Platform, including:",
            "These providers process data on our behalf under contractual and security arrangements appropriate to their role. Their own privacy terms may also apply to certain processing activities.",
        ],
        bullets: [
            "Clerk — authentication and account management",
            "Vercel — application hosting and infrastructure",
            "Neon — managed PostgreSQL database hosting",
            "Vercel Blob — file and media storage",
        ],
    },
    {
        title: "18. Changes to this Privacy Policy",
        paragraphs: [
            "We may update this Privacy Policy from time to time. When we make material changes, we will post the updated policy on the Platform and revise the 'Last updated' date.",
            "We encourage you to review this page periodically. Continued use of the Platform after changes take effect indicates that you have read the updated policy.",
        ],
    },
    {
        title: "19. Contact information",
        paragraphs: [
            `For privacy questions, data subject requests, or account deletion requests, contact us at ${LEGAL_CONTACT_EMAIL}.`,
            "Please include your account email and the nature of your request so we can assist you promptly.",
        ],
    },
];

export const PRIVACY_INTRO =
    "This Privacy Policy describes how TOLGcoaching handles personal data for users in Ireland, the United Kingdom, and the European Union. It explains what we collect, why we collect it, and how you can exercise your rights.";
