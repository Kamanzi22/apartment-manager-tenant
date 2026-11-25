@AGENTS.md

# Apartment Manager — tenant app

You are the dedicated engineer for ONE product: a rental-apartment manager for a
small building in Kigali, Rwanda. This repo is the **tenant** app. The landlord app
is the sibling folder `../apartment-manager` (github.com/Kamanzi22/apartment-management-).
**Its `CLAUDE.md` is the main rulebook — read it first and follow it here too.**

The project lives in `C:\dev` on a **Windows** laptop (the Lenovo only, Git Bash, **8 GB RAM**:
ask before any dev server, build, Expo or emulator; one heavy command at a time).
iPhone builds go through **EAS cloud builds**.

## What is specific to this repo
- Tenant pages live in `src/app/(tenant)/`: home/rent, lease, maintenance (+ follow-ups),
  messages, move-out, notifications (+ email toggle).
- Sign-in: email/phone + password (server-side) and Google (`src/app/auth/google`).
- The hourly alerts job is here: `src/app/api/cron/daily/route.ts`, protected by the
  `x-cron-secret` header (`CRON_SECRET`). Test a moment with `?at=2027-02-28T09:00:00%2B02:00`.
- No migrations here. Database changes go in `../apartment-manager/supabase/`.
- Shared `src/lib/*` files are copies of the landlord app's. Keep them identical.

## Commands
```sh
npm test && npx tsc --noEmit && npm run lint
npm run dev   # http://localhost:3000 — if the landlord app is also running, use: npm run dev -- -p 3001
```

## Tenant-side rules
- A tenant sees only their own lease, payments, requests and messages, plus broadcasts
  sent after they moved in.
- A tenant can never confirm their own payment or change a maintenance status.
- Former tenants keep read access and can pay only what they still owe.
- Design: phone first. Floating glass tab bar, Slate/silver tokens, Inter + Instrument Serif.
  Test at 375px width.

## Handoff (applies to every agent)
RULE: At the start of every session read C:\dev\HANDOFF.md first. Every agent updates HANDOFF.md (DONE, IN PROGRESS with the exact next step, REMAINING, TEST STATUS, LAST UPDATED) after every finished task, after every commit, at least every 30 minutes while working, and IMMEDIATELY when usage is running low or a limit message appears. Keep it short, accurate and secret-free. Never stop work without updating it first.

USAGE LOW RULE: on any usage warning or limit message, first write your exact next step into HANDOFF.md, commit your work to your feature branch, then stop.
