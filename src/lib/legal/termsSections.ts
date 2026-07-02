import type { LegalSection } from "./common";
import { LEGAL_CONTACT_EMAIL, LEGAL_PLATFORM_NAME } from "./common";

export const TERMS_SECTIONS: LegalSection[] = [
    {
        title: "1. Acceptance of terms",
        paragraphs: [
            `These Terms of Service ("Terms") govern access to and use of ${LEGAL_PLATFORM_NAME} (the "Platform" or "Service"), operated by ${LEGAL_PLATFORM_NAME}. By creating an account, accessing the Platform, or using any part of the Service, you agree to these Terms.`,
            "If you do not agree, you must not use the Platform. Where you use the Platform on behalf of an organisation, you confirm that you have authority to bind that organisation to these Terms.",
        ],
    },
    {
        title: "2. Eligibility and account responsibility",
        paragraphs: [
            "You must be at least 16 years old to use the Platform, or the minimum age required in your country if higher. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account.",
            "You agree to provide accurate registration information and to keep your profile details up to date. You must notify us promptly if you suspect unauthorised access to your account.",
        ],
        bullets: [
            "You may not share your account with others unless expressly permitted by the Platform.",
            "You are responsible for securing the devices and networks you use to access the Service.",
            "We may suspend or close accounts that appear compromised, fraudulent, or misused.",
        ],
    },
    {
        title: "3. Use of the app",
        paragraphs: [
            `${LEGAL_PLATFORM_NAME} is a fitness tracking and coaching platform. It helps athletes log workouts, track progress, submit check-ins, and communicate with coaches. Coaches may assign plans, review client data, and provide feedback through the Platform.`,
            "We grant you a limited, non-exclusive, revocable licence to use the Platform for lawful personal or coaching-related purposes in accordance with these Terms. You must not attempt to reverse engineer, scrape, overload, or interfere with the Service.",
        ],
    },
    {
        title: "4. Fitness and health disclaimer",
        paragraphs: [
            `${LEGAL_PLATFORM_NAME} does not provide medical advice, diagnosis, or treatment. Content on the Platform — including workout plans, metrics, targets, and general guidance — is for fitness and educational purposes only.`,
            "Physical training carries inherent risk. You should consult a qualified medical professional before starting or changing any exercise programme, especially if you have an injury, illness, pregnancy, or other health condition.",
            "You train at your own risk and are solely responsible for deciding whether any workout, load, volume, or activity is appropriate for you.",
        ],
    },
    {
        title: "5. Coaching disclaimer",
        paragraphs: [
            "Where you receive coaching through the Platform, advice is provided by the coach assigned to you, not by TOLGcoaching as a medical or healthcare provider.",
            "Coaches are responsible for the coaching advice, programming suggestions, and feedback they provide through the Platform. TOLGcoaching does not guarantee results, performance outcomes, or suitability of any coach-provided plan for your individual circumstances.",
            "If you disagree with coaching guidance, stop the activity and seek independent professional advice where appropriate.",
        ],
    },
    {
        title: "6. User-generated content",
        paragraphs: [
            "You may submit content to the Platform, including profile information, workout notes, messages, check-in responses, and uploaded media. You retain ownership of your content, but you grant us a licence to host, store, process, display, and transmit it as needed to operate the Service.",
            "You represent that you have the right to upload any content you submit and that your content does not infringe the rights of others.",
            "You are responsible for the content you upload and the messages you send.",
        ],
    },
    {
        title: "7. Intellectual property",
        paragraphs: [
            `${LEGAL_PLATFORM_NAME}, its branding, logos, design, software, and other Platform content are owned by ${LEGAL_PLATFORM_NAME} or its licensors and are protected by applicable intellectual property laws.`,
            "Except as expressly permitted by these Terms, you may not copy, redistribute, modify, reverse engineer, or commercially exploit any part of the Platform without our prior written permission.",
            "Nothing in these Terms affects your ownership of content you upload, as described in section 6.",
        ],
    },
    {
        title: "8. Progress photos, videos, messages, and check-ins",
        paragraphs: [
            "The Platform may allow you to upload progress photos, training videos, bodyweight entries, and other check-in materials. These may be visible to your assigned coach and, where applicable, platform administrators as described in our Privacy Policy.",
            "Do not upload content that is unlawful, harassing, sexually explicit, violent, or that includes personal data of third parties without their consent.",
            "Sensitive fitness data and progress photos should be shared thoughtfully. You control what you choose to upload, but you acknowledge that assigned coaches need access to relevant client data to provide coaching services.",
        ],
    },
    {
        title: "9. Prohibited uses",
        paragraphs: ["You must not use the Platform to:"],
        bullets: [
            "Break applicable laws or regulations.",
            "Harass, threaten, abuse, or discriminate against others.",
            "Upload malware, spam, or deceptive content.",
            "Impersonate another person or misrepresent your qualifications.",
            "Access data or accounts that are not yours.",
            "Circumvent access controls, premium features, or security measures.",
            "Use the Platform for unauthorised commercial solicitation.",
        ],
    },
    {
        title: "10. Account suspension or removal",
        paragraphs: [
            "We may suspend, restrict, or terminate your account if we reasonably believe you have breached these Terms, misused the Platform, created risk for other users, or where required by law.",
            "This may include repeated abuse, fraudulent activity, attempts to bypass premium access, sharing or misusing access codes, or behaviour that negatively affects other users or the Service.",
            "We may also remove content that violates these Terms or community standards. Where practical, we will provide notice, but we may act immediately where necessary to protect users or the Service.",
            "You may stop using the Platform at any time. Account deletion requests are handled as described in our Privacy Policy.",
        ],
    },
    {
        title: "11. Payments and premium features",
        paragraphs: [
            "Every new account starts on the free plan. Premium access is not purchased directly through the Platform unless we expressly introduce separate billing in the future.",
            "Premium may be unlocked using a coach-provided access code or other arrangement described within the Platform. Access codes are intended for authorised use only and may be linked to a specific coach, role, or entitlement.",
            "Access codes may expire, be revoked, or become invalid if coaching ends, the code is misused, shared without authorisation, or the associated entitlement is withdrawn.",
            "Premium features, availability, and access arrangements may change over time as the Platform develops. Unless expressly stated otherwise on the Platform, billing, refunds, and premium entitlements arranged with a coach remain between you and that coach or the applicable payment provider.",
            "If paid subscriptions or direct billing are introduced, additional payment terms will be presented before you are charged.",
        ],
    },
    {
        title: "12. Data accuracy and app availability",
        paragraphs: [
            "Workout logs, charts, estimates, personal records, and other analytics are provided for informational and training purposes only. They may contain errors, omissions, or delays and should not be relied upon as medical advice or as the sole record for medical or legal purposes.",
            "We aim to keep the Service available, but we do not guarantee uninterrupted access. Maintenance, updates, outages, or third-party failures may affect availability.",
        ],
    },
    {
        title: "13. Changes to the Platform",
        paragraphs: [
            "We may modify, discontinue, or replace features of the Platform at any time to improve, maintain, secure, or develop the Service.",
            "Where practical, we will provide reasonable notice of material changes that significantly affect how you use the Platform, but we may make urgent changes where needed for security, legal, or operational reasons.",
        ],
    },
    {
        title: "14. Limitation of liability",
        paragraphs: [
            `To the fullest extent permitted by applicable law, ${LEGAL_PLATFORM_NAME} and its operators will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for loss of profits, data, goodwill, or training opportunities arising from your use of the Platform.`,
            "Nothing in these Terms excludes or limits liability that cannot be excluded or limited under applicable law, including liability for death or personal injury caused by negligence where such limitation is not permitted.",
            "Without limiting sections 4 and 5, you use the Platform, its data outputs, and any coaching interactions at your own risk.",
        ],
    },
    {
        title: "15. Force majeure",
        paragraphs: [
            `${LEGAL_PLATFORM_NAME} is not responsible for any delay, failure, or interruption in the Service caused by events outside our reasonable control.`,
            "These may include internet or telecommunications outages, cloud provider failures, hosting disruptions, natural disasters, labour disputes, or actions taken by government authorities.",
        ],
    },
    {
        title: "16. Severability",
        paragraphs: [
            "If any provision of these Terms is held to be invalid, illegal, or unenforceable, that provision will be enforced to the maximum extent permitted and the remaining provisions will continue in full force and effect.",
        ],
    },
    {
        title: "17. Changes to the terms",
        paragraphs: [
            "We may update these Terms from time to time. When we make material changes, we will post the updated Terms on the Platform and update the 'Last updated' date.",
            "Continued use of the Platform after changes take effect constitutes acceptance of the revised Terms. If you do not agree to the updated Terms, you should stop using the Service.",
        ],
    },
    {
        title: "18. Governing law",
        paragraphs: [
            "These Terms are governed by the laws of Ireland, without regard to conflict-of-law principles.",
            "If you are a consumer in the United Kingdom or European Union, you may also benefit from mandatory protections under the laws of your country of residence. Nothing in these Terms affects those non-waivable rights.",
            "Disputes should first be raised with us directly. Courts in Ireland shall have jurisdiction where permitted by law.",
        ],
    },
    {
        title: "19. Contact information",
        paragraphs: [
            `If you have questions about these Terms, contact us at ${LEGAL_CONTACT_EMAIL}.`,
            "Please include your account email and a clear description of your request so we can respond efficiently.",
        ],
    },
];

export const TERMS_INTRO =
    "These Terms explain how you may use TOLGcoaching, a fitness tracking and coaching platform. Please read them carefully before using the Service.";
