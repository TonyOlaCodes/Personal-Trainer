<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# User Customizations

- Always proceed with executing implementation plans without asking for confirmation.
- After completing code edits, commit and push to `origin/main` (or the current feature branch) without asking first. Use clear commit messages summarizing the why.

# Data safety (production)

User training history must never be wiped by plan edits or careless deletes.

- **Plan PATCH**: Always use `updatePlanPreservingHistory` in `src/lib/planUpdate.ts`. Never `week.deleteMany({ planId })` or recreate the full week/workout tree on save.
- **Plan DELETE**: Block permanent delete when `countWorkoutLogsForPlan` > 0 (409). Users unlink via `userPlan` instead.
- **Exercise DELETE**: If `countLogSetsForExercise` > 0, `softHideExercise` (`isCustom: true`) — never hard-delete exercises referenced by logs.
- **Workout / week removal on plan save**: Only hard-delete when there are zero workout logs for that entity.
- **Log saves**: `workoutLog.deleteMany` is only for same-day `IN_PROGRESS` drafts. Re-saving a completed log replaces `logSet` rows on the same `workoutLog` row — do not delete the log itself.
- **Guards**: Run `npm run audit:safety` before deploy; it is wired into `npm run build`. Use helpers in `src/lib/dataSafety.ts` for counts and soft-hide.

