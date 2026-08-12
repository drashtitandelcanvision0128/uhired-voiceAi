# Updates

## 2026-07-13

Interview flow and access security fixes:

- AI now gives a self-intro and collects the candidate's intro before questions begin.
- On silence, the question is repeated instead of being skipped.
- Only predefined questions are asked (no extra questions).
- Interview pauses when the camera is covered or obscured.
- Invite codes are now single-use and expire after use.

Files changed:
- `src/app/api/candidate/verify/route.ts`
- `src/components/company-interview-room.tsx`
- `src/lib/interview-prompt.ts`
