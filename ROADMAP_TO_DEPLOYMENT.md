# 🚀 Phoenix Fitness App: Roadmap to Full Deployment

This document outlines the remaining engineering and design tasks required to take this platform from a functional MVP to a premium, production-ready product.

---

## 🏗️ Core Infrastructure & Stability
- [ ] **Database Indexing**: Add indexes to `WorkoutLog` (`userId`, `loggedAt`) and `CheckIn` to ensure analytics stay fast as the user base grows.
- [ ] **Error Boundaries**: Implement global React Error Boundaries to catch and gracefully handle UI crashes.
- [ ] **Data Revalidation**: Configure Next.js `revalidatePath` or `revalidateTag` for all dashboard-impacting mutations (e.g., when a workout is logged, the calendar and progress charts must update instantly).
- [ ] **API Protection**: Audit all `/api` routes to ensure proper `auth()` checks from Clerk are enforced (some routes currently rely on `userId` from headers).

---

## 🏋️‍♂️ User Experience (User Side)
- [ ] **Enhanced Workout Logging**:
    - Add "RPE" (Rate of Perceived Exertion) and "Rest Timers" within the active workout screen.
    - Enable "Swap Exercise" functionality for athletes who can't access specific equipment.
- [ ] **Improved Progress Photos**: Add a side-by-side "Transformation" viewer (Front/Side/Back) with date comparisons.
- [ ] **Push Notifications**: Integrate Vercel/Firebase notifications for:
    - Daily workout reminders.
    - New plan assignments from coach.
    - Weekly check-in deadlines.

---

## 👨‍🏫 Coach Experience (Coach Side)
- [ ] **Dynamic Plan Builder**: Finalize "Linearity Mode" for horizontal week-over-week progression editing.
- [ ] **Client Health Dashboard**: Create a "Red Flag" system for coaches to see which athletes have missed more than 2 workouts or whose check-ins show high stress/low sleep.
- [ ] **Centralized Chat**: Solidify the Team/Individual chat with real-time feedback (Ably or Pusher integration for reliability).

---

## 🎨 Visual Polish & Aesthetics
- [ ] **Skeleton Loaders**: Replace current "Loading..." text with animated Skeleton components for a smoother perceived performance.
- [ ] **Transitions**: Implement `framer-motion` for page transitions and modal entries.
- [ ] **Mobile Native Feel**: Add a "Save to Home Screen" (PWA) manifest so users can access the app like a native mobile experience.

---

## 📈 Advanced Analytics
- [ ] **Muscle Group Volume**: Build the "Fanned Wheel" or Radar Chart to show training volume distribution across the week (Chest vs. Quads vs. Back).
- [ ] **Trend Forecasting**: Simple linear regression to predict when a user will hit their target bodyweight based on existing check-in data.

---

## 🚢 Deployment Strategy
- [ ] **Environment Audit**: Ensure all `NEXT_PUBLIC_CLERK_...` and `PRISMA_DATABASE_URL` secrets are mirrored in the Vercel Production environment.
- [ ] **Post-Deployment Hooks**: Set up automated tests (Playwright) to verify the "Start Workout" and "Submit Check-in" flows regularly.
- [ ] **Analytics & Monitoring**: Enable Vercel Speed Insights and Sentry for real-time error tracking.

---

**Last Session Summary**: 
- Rebuilt Check-in UI (Fast, Tap-based 1-5 ratings).
- Rebuilt Calendar (Streak system, Plan reflection, Volume tracking).
- Optimized Progress analytics (Tons -> KG, Multi-timeframe Volume toggles).
