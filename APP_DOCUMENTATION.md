# FitCoach Pro — Complete Application Documentation

This document describes **everything** the application does today: every screen, feature, role, permission, and data type. It reflects the codebase as built so far.

---

## Table of Contents

1. [What Is FitCoach Pro?](#1-what-is-fitcoach-pro)
2. [User Roles](#2-user-roles)
3. [Authentication & Account Lifecycle](#3-authentication--account-lifecycle)
4. [Navigation by Role](#4-navigation-by-role)
5. [Every Screen & Route](#5-every-screen--route)
6. [Feature Deep Dives](#6-feature-deep-dives)
7. [What Each Role Can Log & Record](#7-what-each-role-can-log--record)
8. [API & Backend (Summary)](#8-api--backend-summary)
9. [Notifications & Scheduled Alerts](#9-notifications--scheduled-alerts)
10. [Data Model Overview](#10-data-model-overview)
11. [Data Safety Rules (Production)](#11-data-safety-rules-production)
12. [Themes & UI Preferences](#12-themes--ui-preferences)
13. [Mobile vs Desktop Differences](#13-mobile-vs-desktop-differences)
14. [Access Codes & Upgrades](#14-access-codes--upgrades)
15. [Known Role / UX Quirks](#15-known-role--ux-quirks)

---

## 1. What Is FitCoach Pro?

**FitCoach Pro** is a fitness coaching and training web app. It connects:

- **Athletes/clients** (Free or Premium) who follow plans, log workouts, track progress, and communicate with coaches.
- **Coaches** who manage clients, assign plans, review check-ins, leave workout feedback, and generate invite codes.
- **Super Admins** who run the platform: users, roles, global exercises, and all coach capabilities.

### Core capabilities

| Area | What it does |
|------|----------------|
| **Plans** | Multi-week programmes with days, workouts, and exercises. Prebuilt templates or custom builds. Share via 8-character codes. |
| **Workout logging** | Live session UI: sets, reps, weight, RPE, warmups, PR detection, exercise preview media, substitute/add exercises, session feeling rating. |
| **Calendar** | Month view of planned vs completed vs missed vs in-progress workouts (client calendar; coach sees client calendars). |
| **Progress** | Charts for bodyweight, daily habits, exercise strength, training volume, PRs (Premium). |
| **Check-ins** | Weekly client submissions with photos, video, ratings, bodyweight; coach review and video response (Premium clients). |
| **Chat** | Direct coach↔client messaging (Premium) plus Global/Community chat (all roles). |
| **Coach panel** | Client roster, onboarding wizard, plan assignment, goals, check-in schedules, workout history, exercise progression. |
| **Admin** | User role management, account deactivate/delete, global exercise dictionary, platform-wide codes and plans. |

### Tech (high level)

- **Frontend:** Next.js App Router, React, Tailwind CSS
- **Auth:** Clerk (sign-in, sign-up, user sync webhook)
- **Database:** PostgreSQL via Prisma
- **Deployment:** Vercel (cron every 15 minutes for coach missed alerts)
- **File uploads:** Client-side compression + server storage for images/videos

---

## 2. User Roles

There are **four roles**, stored on the `User` model:

| Role | UI label | Type | Default home |
|------|----------|------|--------------|
| `FREE` | Free | Client | `/dashboard` |
| `PREMIUM` | Premium | Client | `/dashboard` |
| `COACH` | Coach | Coach | `/coach` |
| `SUPER_ADMIN` | Admin | Coach + platform admin | `/coach` |

**Client roles:** `FREE`, `PREMIUM` — can train and log workouts (with tier differences below).

**Coach roles:** `COACH`, `SUPER_ADMIN` — manage athletes; **cannot** train on themselves in the app (no workout logging, no active self-plan).

---

### 2.1 FREE (default after onboarding)

**Gets:**
- Dashboard (training hub)
- Plans: create, import, activate/deactivate, edit, delete (if no history), share codes on owned plans
- Workout logging (full logger)
- Client calendar
- Global/community chat
- Settings (profile, appearance, notifications; **My Goals** tab)
- Redeem access codes (upgrade to Premium + coach link + optional plan)
- Bodyweight and daily metrics logging
- Plans page: active session **Resume** banner if workout in progress
- First-run dashboard walkthrough
- Landing page marketing site

**Does NOT get (locked or blocked):**
- **Progress analytics** — page loads but shows Premium lock screen
- **Weekly check-ins** — page loads but shows Premium lock screen; API returns 403 on submit
- **Direct coach chat** — Global chat works; 1:1 coach DMs blocked (upgrade prompt in chat UI)
- Dashboard check-in widget (hidden entirely for FREE)

---

### 2.2 PREMIUM (via coach access code or admin promotion)

**Everything FREE has, plus:**
- Full **Progress** page: bodyweight charts, volume, exercise history, PRs, habit targets, consistency
- **Weekly check-ins**: submit and edit; photos, video, ratings, notes; coach responses
- Dashboard **check-in widget** (due/overdue/submitted states; opens full-screen check-in overlay)
- **Direct coach chat** (when `coachId` is set from code redemption)
- Coach notifications when client completes workouts, submits check-ins, logs bodyweight, etc.

**Still cannot:**
- Access coach panel, generate codes, manage other users
- Anything coach-only or admin-only

---

### 2.3 COACH

**Gets:**
- **Coach Panel** (`/coach`): client roster, stats, recent activity, onboarding wizard for new athletes
- **Coach Calendar** (`/coach/calendar`): pick a client, view their training calendar (completed/missed/upcoming)
- **Client detail** (`/coach/client/[id]`): full client management (not in sidebar; linked from roster)
- **Invites** (`/coach/invites`): generate Premium access codes tied to plans
- **Plans**: create/edit templates (plans they **created**); no Activate button; no active plan on self
- **Check-ins** (`/checkins`): review all assigned clients’ submissions; respond with text + video
- **Chat**: direct messages with clients; team chat; pin messages; delete team messages
- **Notifications**: in-app bell + configurable scheduled delivery times; quick-reply to missed workout/check-in alerts
- Settings: coach-specific notification toggles and timezone (no **My Goals** tab)
- Bodyweight and daily metrics (for own account, if they log them)

**Cannot (enforced in API + UI):**
- Log workouts (`403` — coaches cannot log workouts)
- Activate a training plan on themselves (UI hidden; API blocked; layout deactivates any active plan on load)
- Redeem client access codes
- Auto-assign imported/created plans to self
- Use client home: `/dashboard`, `/progress`, `/calendar` redirect to coach equivalents
- See Resume Workout banner on Plans page
- Generate **COACH** upgrade codes (admin only)

---

### 2.4 SUPER_ADMIN

**Everything COACH has, plus:**
- **Admin panel** (`/admin`): users, coaches, plans, codes; promote/demote roles; deactivate/reactivate/delete accounts
- **Exercise dictionary** (`/admin/exercises`): global exercise media (video, thumbnail, instructions, muscle group)
- View **all** access codes; generate **COACH** role codes
- Chat with **any** user; broader message delete permissions
- View any client’s check-ins / summaries via `clientId` params
- `canAccessClient` always true
- Admin plan delete can dedupe duplicate plans by name

**Same athlete restrictions as COACH:**
- Cannot log workouts, activate self-plans, or redeem codes as a client would

**Edge case:** Check-in POST explicitly blocks `COACH` but not `SUPER_ADMIN` in one code path — admins could theoretically submit check-ins if they used that API directly.

---

## 3. Authentication & Account Lifecycle

### Sign up / sign in
- **Clerk** handles authentication (`/sign-in`, `/sign-up`)
- After auth → **`/onboarding`** (middleware redirects signed-in users away from landing/auth to onboarding)

### Onboarding (3 steps)
Required and optional profile data collected before app access:

**Step 1 — Training profile**
- Primary goal: Build Muscle, Lose Weight, Recomposition, Strength
- Training days per week: 2–6
- Experience: Beginner / Intermediate / Advanced
- Location: Gym / Home
- Injuries: yes/no + details

**Step 2 — Body & targets (optional)**
- Age, height, weight (metric or imperial)
- Target weight
- Cardio preference, diet awareness
- Daily targets: calories, steps, sleep hours
- Optional **access code** (can upgrade to Premium during onboarding)

**Step 3 — Confirm & submit**
- POST `/api/user/onboarding` → user gets role `FREE` (or Premium if code redeemed)

### Account states
| State | Behavior |
|-------|----------|
| Not signed in | Public landing, sign-in/up only |
| Signed in, onboarding incomplete | Forced to `/onboarding` |
| Active | Full app per role |
| **Deactivated** | Redirect to `/deactivated`; sign-out only; API 403 |

### Role changes & side effects
- **Admin → COACH / SUPER_ADMIN:** clears `coachId`, goal fields; deactivates all user’s plans
- **Coach removes client:** client → `FREE`, `coachId` null; access codes invalidated; plans deactivated
- **Every app load for coaches:** `deactivateCoachActivePlans` runs (coaches never keep an active athlete plan)

---

## 4. Navigation by Role

### Desktop sidebar

| Item | FREE | PREMIUM | COACH | SUPER_ADMIN |
|------|:----:|:-------:|:-----:|:-----------:|
| Admin | — | — | — | ✓ |
| Exercises (admin) | — | — | — | ✓ |
| Coach Panel | — | — | ✓ | ✓ |
| Invites | — | — | ✓ | ✓ |
| Calendar (coach) | — | — | ✓ | ✓ |
| Dashboard | ✓ | ✓ | — | — |
| Plans | ✓ | ✓ | ✓ | ✓ |
| Calendar (client) | ✓ | ✓ | — | — |
| Progress | ✓* | ✓ | — | — |
| Check-ins | ✓** | ✓** | ✓ | ✓ |
| Chat | ✓ | ✓ | ✓ | ✓ |
| Settings | ✓ | ✓ | ✓ | ✓ |

\* Progress visible in nav but FREE sees lock screen inside.  
\*\* Check-ins in sidebar for all; FREE/PREMIUM see lock inside unless Premium.

Logo link: coaches → `/coach`; clients → `/dashboard`.

### Mobile bottom tab bar

| Tab | FREE | PREMIUM | COACH | SUPER_ADMIN |
|-----|:----:|:-------:|:-----:|:-----------:|
| Dashboard | ✓ | ✓ | — | — |
| Coach | — | — | ✓ | ✓ |
| Coach Calendar | — | — | ✓ | ✓ |
| Plans | ✓ | ✓ | ✓ | ✓ |
| Calendar (client) | ✓ | ✓ | — | — |
| Check-ins | — | — | ✓ | ✓ |
| Progress | ✓* | ✓ | — | — |
| Chat | ✓ | ✓ | ✓ | ✓ |

**Note:** Check-ins tab is **hidden on mobile for FREE/PREMIUM** (dashboard widget + overlay used instead for Premium). Coaches/admins get Check-ins in mobile nav.

### Screens not in main nav (deep links)
- `/onboarding`, `/deactivated`
- `/plans/create`, `/plans/log/[workoutId]`, `/plans/log/view/[logId]`
- `/coach/client/[id]`
- `/donate` (from Settings)
- `/admin/exercises`

---

## 5. Every Screen & Route

### Public

| Route | Name | Purpose |
|-------|------|---------|
| `/` | Landing | Marketing: features, pricing (Free vs Premium), sign-in/up, hero |
| `/sign-in` | Sign in | Clerk modal/page |
| `/sign-up` | Sign up | Clerk registration |

### Pre-app (auth required, no sidebar)

| Route | Name | Purpose |
|-------|------|---------|
| `/onboarding` | Onboarding | 3-step profile + optional code |
| `/deactivated` | Deactivated | Blocked account message + sign out |

### Client (FREE / PREMIUM)

| Route | Name | What you see and do |
|-------|------|---------------------|
| `/dashboard` | Dashboard | Greeting, streak, avg duration; daily metrics (weight, calories, steps, sleep); today’s workout + start/resume; next training day; recent workouts + “View All” history explorer; in-progress session banner; check-in widget (Premium); code redemption (FREE); walkthrough on first visit |
| `/plans` | Plans | My Plans / Templates / Use Code tabs; activate/deactivate; edit/delete; share code copy; **Resume Workout** banner; active plan highlight |
| `/plans/create` | Plan designer | Build/edit multi-week plan; templates; view-only mode; coach assign-to-client mode |
| `/plans/log/[workoutId]` | Workout logger | Live session: sets/reps/weight/RPE, warmups, timer, exercise preview, substitute/add exercises, finish modal with feeling rating, notes, duration |
| `/plans/log/view/[logId]` | Session archive | Completed session: volume, 1RM estimates, PRs, set videos, feeling, notes, delete/uncomplete |
| `/calendar` | Calendar | Monthly grid: planned/completed/missed/in-progress; day panel with exercises; start/resume/view workout |
| `/progress` | Progress | Premium analytics or lock screen for FREE |
| `/checkins` | Check-ins | Premium submit/review UI or lock; coaches see client list |
| `/chat` | Chat | Direct + Global tabs; media, reactions, replies, pins |
| `/settings` | Settings | Profile, goals (clients), theme, notifications |
| `/donate` | Support | Optional bank transfer details to support the project |

### Coach (COACH / SUPER_ADMIN)

| Route | Name | What you see and do |
|-------|------|---------------------|
| `/coach` | Coach Panel | Client roster, onboarding wizard, recent check-ins, client stats |
| `/coach/calendar` | Coach Calendar | Client picker + calendar for selected athlete |
| `/coach/client/[id]` | Client detail | Weight/volume charts, goals, plan assign, logs, check-ins, exercise history, quick chat drawer, workout notes, remove client |
| `/coach/invites` | Invites | Generate/list/revoke Premium codes |

### Admin (SUPER_ADMIN only)

| Route | Name | What you see and do |
|-------|------|---------------------|
| `/admin` | Admin panel | Users, coaches, plans, codes; role changes; account actions |
| `/admin/exercises` | Exercise dictionary | Global exercise list; add/edit/delete media and instructions |

---

## 6. Feature Deep Dives

### 6.1 Dashboard (clients)

- **Daily metrics card:** log/edit bodyweight, calories, steps, sleep for chosen date; shows vs targets and short insights
- **Today’s workout:** exercises from active plan rotation; Start or Resume; shows if already completed today
- **Next training day:** preview link
- **Recent workouts:** last N sessions; tap opens **Recent Sessions Explorer** (full history modal + session detail modal)
- **Active session banner:** Resume / Discard in-progress workout (last 24h)
- **Check-in widget (Premium):** opens full-screen check-in overlay (not separate nav on mobile for clients)
- **Access code card (FREE):** redeem Premium
- **Walkthrough:** first-time tour highlighting dashboard areas

### 6.2 Plans

**My Plans tab**
- List all assigned/created plans
- **Activate** one plan at a time (clients only)
- **Deactivate** active plan
- **Edit** → plan designer
- **Delete** owned plan (blocked if workout history exists — 409)
- **Remove** imported plan from library (unlink)
- **Share code** display + copy on plans that have codes

**Templates tab**
Prebuilt programmes:
- Bro Split (5-day)
- Arnold Split (6-day)
- Push Pull Legs (6-day)
- Upper Lower (4-day)
- Full Body
- Hybrid

**Use Code tab**
- Import clone of someone else’s plan by 8-character share code

**Coach view:** sees plans they **created** (not client-style activation); manages templates for assignment to clients.

### 6.3 Plan designer (`/plans/create`)

- Multi-week structure: weeks → workout days → exercises
- Exercise fields: name, sets, reps, target weight, rest, notes, order, muscle group
- Drag reorder exercises
- Linear progression tools
- Create from template or scratch
- Edit existing (`?id=`)
- View-only (`?view=true`)
- Coach assign flow (`?clientId=`)
- Saves via POST/PATCH `/api/plans` with **history-preserving** updates (never wipes logs)

### 6.4 Workout logger

**During session:**
- Per-exercise set rows: reps, weight (kg), RPE (1–10), warmup toggle, complete toggle
- Placeholders from last session or plan targets
- Session timer + elapsed time
- **Exercise preview modal:** video/thumbnail/instructions from global dictionary
- **Substitute exercise** or **add exercise** mid-session (autocomplete search)
- **Remove exercise** from session
- Auto-save progress to server (`IN_PROGRESS`) and localStorage fallback
- Resume same-day in-progress log (`?date=` support)
- Cardio exercises handled differently in UI (ExerciseAutocomplete)

**Finish workout modal:**
- **Feeling rating (1–5):** 😵 Awful, 😓 Bad, 😐 Okay, 💪 Good, 🔥 Great (optional)
- Duration (minutes), editable
- Session notes (optional)
- Save → `COMPLETED` log; PR detection; coach notification; redirect to session archive

**Discard session:** delete in-progress log and clear local draft

### 6.5 Session archive (`/plans/log/view/[logId]`)

- Workout name, date, duration, volume, feeling
- Per-exercise sets with weight/reps/RPE; estimated 1RM; PR badges
- Set video playback
- Athlete debrief notes
- **WorkoutFeelingEditor:** change rating later
- **SessionActions:** delete log or mark incomplete (owner)
- Visible to: owner, their coach, super admin

### 6.6 Calendar

**Client calendar**
- Month navigation
- Each day: planned workout from active plan rotation (based on plan start date + week cycling)
- Status indicators: completed, in-progress, missed, upcoming
- Day detail: exercise list, Start / Resume Session / View Workout, link to edit plan

**Coach calendar**
- Dropdown to select client
- Same calendar UI with coach actions: View Client, Edit Plan links
- Week stats summary

### 6.7 Progress (Premium)

Requires completed workout history for meaningful data. Includes:

- **Consistency** vs weekly training target
- **Last workout** summary with feeling emoji
- **Bodyweight** area chart + goal line (7/30/365 day ranges)
- **Habit targets:** calories, steps, sleep vs goals
- **Exercise strength:** search/pin exercises; line charts of best set weight / estimated 1RM over time; session history modal
- **Training volume:** bar charts (daily/weekly/monthly/yearly); week comparison
- **PR tracking**

FREE users: full page replaced with **PremiumLockScreen**.

### 6.8 Check-ins (Premium clients; coach review)

**Client submission (Premium):**
- Week number (ISO-style scheduling vs coach-configured day)
- Bodyweight
- Ratings 1–5: sleep, diet, stress, injury, energy, intensity
- Front/side photos, video
- Written feedback and notes
- Status: PENDING → until coach reviews
- Edit resets to PENDING
- Period summary with auto performance feedback

**Coach review:**
- List all client check-ins; filter/sort
- Respond with text + optional coach video
- Mark REVIEWED; client notified

**Schedule (set by coach):**
- Check-in day (Sun–Sat)
- Frequency: weekly, every 2 weeks, etc.

FREE: lock screen. COACH: cannot submit; reviews clients only.

### 6.9 Chat

**Tabs:**
1. **Direct** — 1:1 thread with assigned coach (Premium client) or each client (coach) or anyone (admin)
2. **Global / Community** — open to all authenticated users

**Features:**
- Text, images, videos
- Reply threading, edit (2-minute window), delete
- Emoji reactions
- @mentions in team/global contexts
- Pinned messages (coach/admin or direct participants)
- Read receipts (SENT / DELIVERED / SEEN)
- Media lightbox viewer
- Mobile: sidebar list vs chat view toggle

**FREE:** direct tab shows upgrade lock; global still works.

### 6.10 Settings

**Profile**
- Name, avatar upload
- Email display (Clerk)
- Redeem access code (FREE upgrade path)

**My Goals (clients only)**
- Goal, training days, experience, location
- Target weight, hidden goals (hide metrics on progress)
- Daily metric targets: calories, steps, sleep

**Appearance**
- Theme presets (see [Themes](#12-themes--ui-preferences))

**Notifications**

*Clients:*
- Coach message, plan update, check-in reviewed, workout feedback
- Missed check-in / missed workout reminders

*Coaches:*
- Client workout, check-in, bodyweight, metric update
- Missed check-in / missed workout (with **scheduled local delivery times**)
- Timezone for notification scheduling

**Footer:** link to `/donate`, support email

### 6.11 Coach Panel

- **New athlete wizard** when clients lack check-in schedule: set check-in day/frequency, metric targets, assign plan
- **Client cards:** adherence, last active, sparkline, quick links
- **Recent check-ins** feed
- Handles deleted/inactive clients in roster display

### 6.12 Client detail (coach)

- Profile, adherence %, assigned coach (admin)
- Bodyweight and training volume charts
- Edit check-in schedule, goals, hidden goals, metric targets
- Assign/activate plan from coach’s library
- Recent sessions explorer (full history + detail modals)
- Check-in history
- Workout notes / feedback on sessions
- Exercise progression search + history tooltips
- **Quick chat** slide-over drawer
- Remove client (demote to FREE, unlink coach)

### 6.13 Invites (coach)

- Generate Premium codes linked to optional plan/template
- Expiry date optional
- Copy codes; see redemption status (who used, when)
- Delete/revoke unused codes

### 6.14 Admin panel

**Users tab:** list, search, change role (FREE/PREMIUM/COACH/SUPER_ADMIN), assign coach, deactivate/reactivate/delete

**Coaches tab:** roster with client counts

**Plans tab:** all coach-created plans + who has them active

**Codes tab:** platform-wide recent codes

Generate codes including COACH upgrades (admin-only)

### 6.15 Admin exercises

- Global **exercise dictionary** (~400 exercises after plural deduplication)
- Each entry: name, muscle group, video URL, thumbnail, instructions
- Suggested exercises from workout data not yet in dictionary
- Used for autocomplete and workout logger exercise preview

### 6.16 Donate

- Why support copy
- Bank transfer details (IBAN) with copy buttons
- Not in main navigation

### 6.17 UI components (cross-cutting)

- **TopBar:** page title, streak, today header, notifications bell (with quick-reply for coaches on missed alerts), settings link, Clerk user button
- **Walkthrough:** spotlight tour on dashboard
- **MediaLightbox:** fullscreen image/video
- **Modal overlays:** scroll-locked popups app-wide
- **PremiumLockScreen:** upgrade prompt for gated features
- **RecentSessionsExplorer / WorkoutSessionModal:** paginated history + session detail with coach notes, feeling, navigation between sessions
- **ReturnLink:** preserves back navigation via `returnTo` query param

---

## 7. What Each Role Can Log & Record

### Workout sessions (clients only: FREE & PREMIUM)

| Data | Details |
|------|---------|
| Status | `IN_PROGRESS` or `COMPLETED` |
| Per set | reps, weight (kg), RPE, warmup flag, completed flag, optional set video |
| Session | duration (min), notes, feeling (1–5 emoji scale) |
| Date | Can log for a specific calendar day (`loggedAt`) |
| PRs | Auto-detected on completion (max weight per exercise, non-warmup) |
| Ad-hoc exercises | Added mid-session become custom exercises on the workout |

### Bodyweight (all roles)

- One entry per calendar day (`weightKg`)
- Stored in `bodyweight_logs`
- Also on check-ins as `bodyweightKg`
- Coach notified when **clients** log (not necessarily when coach logs own weight)

### Daily metrics (all roles)

Per day, any subset:
- Calories (integer)
- Steps (integer)
- Sleep hours (float)

Targets set via onboarding, settings, or coach goals API.

### Check-ins (PREMIUM clients only)

Weekly bundle:
- Bodyweight, text feedback, notes
- Photos (front, side), video
- Six ratings 1–5: sleep, diet, stress, injury, energy, intensity

### What coaches “create” (not athlete logging)

- Workout **feedback notes** on client sessions
- Check-in **reviews** (text + video response)
- **Messages** (text/image/video)
- **Plans** (templates for clients)
- **Access codes**

---

## 8. API & Backend (Summary)

All routes under `/api/` unless noted. Default: Clerk auth required.

| Area | Routes | Notes |
|------|--------|-------|
| Logs | `GET/POST /api/logs`, `GET/PATCH/DELETE /api/logs/[id]` | Workout logging; history for coach+admin |
| Stats | `GET /api/stats` | Progress dashboard aggregation |
| Bodyweight | `GET/POST /api/bodyweight` | Daily weight |
| Daily metrics | `GET/POST /api/daily-metrics` | Calories/steps/sleep |
| Check-ins | `GET/POST/PATCH /api/checkins`, `DELETE .../[id]`, period-summary | Premium submit; coach review |
| Plans | `GET/POST /api/plans`, `GET/PATCH/DELETE .../[planId]`, activate, import | History-safe PATCH |
| Exercises | `GET /api/exercises`, `DELETE .../[id]` | Dictionary search; soft-hide if logged |
| Messages | `GET/POST/PATCH/DELETE /api/messages` | Chat |
| Notifications | `GET/PATCH /api/notifications`, quick-reply | In-app + coach templates |
| Profile | `PATCH /api/user/profile` | Settings save |
| Onboarding | `POST /api/user/onboarding` | First-time setup |
| Coach clients | goals, plan, checkin-schedule, remove | Client management |
| Codes | `GET/POST/DELETE /api/codes`, redeem, validate | Invites |
| Admin | users/role, users/account, exercises | SUPER_ADMIN only |
| Upload | `POST /api/upload` | Media |
| Webhook | `POST /api/webhooks/clerk` | User sync |
| Cron | `GET/POST /api/cron/coach-missed-alerts` | Bearer `CRON_SECRET`; every 15 min |

---

## 9. Notifications & Scheduled Alerts

### In-app notification types

| Type | Who receives | When |
|------|--------------|------|
| `CLIENT_WORKOUT` | Coach | Client completes workout |
| `CLIENT_CHECKIN` | Coach | Client submits check-in |
| `CLIENT_BODYWEIGHT` | Coach | Client logs bodyweight |
| `CLIENT_MISSED_WORKOUT` | Coach | Cron: planned workout not done |
| `CLIENT_MISSED_CHECKIN` | Coach | Cron: check-in overdue |
| `CHECKIN_REVIEWED` | Client | Coach reviews check-in |
| `NEW_CHAT_MESSAGE` | Client | Coach sends DM |
| `WORKOUT_FEEDBACK_ADDED` | Client | Coach adds session note |
| `PLAN_UPDATED` | Client | Plan changed or newly assigned |

### Coach delivery model

- Immediate or **queued** to preferred local time per notification category
- Missed workout/check-in alerts default ~18:00 local (configurable per coach in Settings)
- **Quick reply** from notification panel: templated DM for missed workout/check-in (coaches only)
- Cron runs **every 15 minutes** (`vercel.json`) to flush queue and scan missed items

### Client notification prefs

Toggle coach message, plan update, check-in review, workout feedback, missed reminders.

---

## 10. Data Model Overview

### Prisma models (main)

`User`, `Plan`, `UserPlan`, `Week`, `Workout`, `Exercise`, `WorkoutLog`, `LogSet`, `WorkoutNote`, `CheckIn`, `GlobalExercise`, `Message`, `Reaction`, `Notification`, `AccessCode`, `ClientGoals`

### Key enums

`Role`, `Goal`, `ExperienceLevel`, `TrainingLocation`, `PlanType`, `LogStatus`, `CheckInStatus`, `MessageType`, `MessageStatus`, `UnitSystem`

### Raw SQL tables (not in Prisma schema)

| Table | Purpose |
|-------|---------|
| `bodyweight_logs` | Daily weight per user |
| `daily_metric_logs` | Daily calories/steps/sleep |
| `pending_coach_notifications` | Scheduled coach alert queue |

### Plan types

- `USER_CREATED` — athlete or coach built
- `PREBUILT` — from template
- `COACH_ASSIGNED` — assigned by coach/code

### Workout log lifecycle

1. Start session → `IN_PROGRESS` log for that workout + day
2. Auto-save sets while logging
3. Complete → `COMPLETED`, feeling, duration, notes; sets replaced atomically
4. Re-save same day completed → updates same log row (does not delete log)
5. Stale in-progress drafts cleaned after 24h
6. Same-day `IN_PROGRESS` drafts may be deleted when starting fresh (safety rules)

---

## 11. Data Safety Rules (Production)

Enforced in code + `npm run audit:safety` (runs on build):

| Rule | Behavior |
|------|----------|
| Plan PATCH | Always `updatePlanPreservingHistory` — never wipe weeks/workouts if logs exist |
| Plan DELETE | **409** if any workout logs exist; unlink via `UserPlan` instead |
| Exercise DELETE | Soft-hide (`isCustom: true`) if any log sets reference it |
| Workout/week removal on save | Hard-delete only when zero logs; else archive workout |
| Log saves | Never delete completed logs on re-save; only replace `logSet` rows |
| Draft logs | `deleteMany` only for same-day `IN_PROGRESS` drafts in controlled paths |

**User training history must never be wiped by plan edits or careless deletes.**

---

## 12. Themes & UI Preferences

Five color themes (Settings → Appearance):

| Theme | Character |
|-------|-----------|
| **Midnight** | Default indigo brand |
| **Emerald** | Green accent |
| **Solar** | Amber accent |
| **Ocean** | Cyan accent |
| **Rose** | Rose accent |

Stored client-side / profile as `data-theme` on document root.

---

## 13. Mobile vs Desktop Differences

| Feature | Mobile | Desktop |
|---------|--------|---------|
| Navigation | Bottom tab bar | Collapsible sidebar |
| Check-ins (clients) | Dashboard widget → overlay | Same + sidebar link |
| Check-ins tab | Hidden for FREE/PREMIUM | Visible in sidebar |
| Chat | List OR conversation full screen | Sidebar + conversation split |
| Notifications panel | Centered fixed popup | Dropdown anchored to bell |
| Workout logger finish | Bottom sheet style modals | Centered modals |
| Coach quick chat | Full-height drawer | Slide-over panel |

---

## 14. Access Codes & Upgrades

### Types
- **PREMIUM codes** — coach-generated; links athlete to coach + optional plan; sets role PREMIUM
- **COACH codes** — admin-generated only; upgrades to COACH role
- **Plan share codes** — 8-char codes on plans to clone/import programme (not role upgrade)

### Redemption effects (Premium client code)
- Role → `PREMIUM`
- `coachId` set to generating coach
- Plan cloned/assigned if code tied to plan
- Coach cannot redeem codes

### Plan share codes
- Import duplicate plan into your library via Plans → Use Code
- Does not change role by itself

---

## 15. Known Role / UX Quirks

1. **Check-ins nav inconsistency:** Sidebar shows Check-ins for FREE/PREMIUM; mobile tab bar hides it for clients (Premium uses dashboard widget).
2. **Coach vs client accounts:** Mutually exclusive modes — coaches cannot have active training plans or log workouts.
3. **Progress nav for FREE:** Link visible but content locked.
4. **Global chat:** Available to FREE users even when direct coach chat is locked.
5. **Session archive access:** Coach can view client logs; client can view own; admin can view all.
6. **Feeling scale:** 1=Awful 😵, 2=Bad 😓, 3=Okay 😐, 4=Good 💪, 5=Great 🔥 — optional at finish, editable later on session page.
7. **Exercise dictionary:** Singular names only; plural duplicates merged in DB maintenance scripts.

---

## Quick Reference: Who Can Do What

| Action | FREE | PREMIUM | COACH | SUPER_ADMIN |
|--------|:----:|:-------:|:-----:|:-----------:|
| Log workouts | ✓ | ✓ | ✗ | ✗ |
| Activate plan on self | ✓ | ✓ | ✗ | ✗ |
| Create/edit plans | ✓ | ✓ | ✓ (templates) | ✓ |
| Import plan by share code | ✓ | ✓ | ✗ | ✓ |
| Redeem Premium/coach code | ✓ | ✓ | ✗ | ✓ |
| Progress analytics | Lock | ✓ | ✗ (redirect) | ✗ (redirect) |
| Submit check-ins | ✗ | ✓ | ✗ | Edge* |
| Review check-ins | ✗ | Own only | ✓ clients | ✓ all |
| Direct coach chat | ✗ | ✓ | ✓ | ✓ |
| Global chat | ✓ | ✓ | ✓ | ✓ |
| Log bodyweight/metrics | ✓ | ✓ | ✓ | ✓ |
| Coach panel | ✗ | ✗ | ✓ | ✓ |
| Generate Premium codes | ✗ | ✗ | ✓ | ✓ |
| Generate Coach codes | ✗ | ✗ | ✗ | ✓ |
| Admin panel | ✗ | ✗ | ✗ | ✓ |
| Manage global exercises | ✗ | ✗ | ✗ | ✓ |
| Manage all users | ✗ | ✗ | ✗ | ✓ |
| View client logs | ✗ | Own | Own clients | All |
| Add workout feedback | ✗ | ✗ | ✓ | ✓ |
| Resume in-progress workout | ✓ | ✓ | ✗ | ✗ |

---

*This document is generated from the current application codebase. Update it when major features or role rules change.*
