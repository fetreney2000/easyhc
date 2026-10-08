# EasyHC — Sistem Kehadiran Lantai

A PWA for tracking employee and visitor presence on building floors, primarily for emergency headcounts (fire, earthquake, etc.).

## Tech Stack

- **Framework**: Next.js 14+ (App Router), TypeScript
- **UI**: Mantine v7 — mobile-first, installable PWA
- **Database**: MongoDB Atlas M0 (free tier), via Mongoose
- **Auth**: NextAuth v5 (Auth.js) — username + password, JWT sliding-window sessions
- **QR**: `qrcode` (generation), `html5-qrcode` (camera-only scanning)
- **Validation**: Zod
- **Data Fetching**: SWR polling — presence boards every 25s, the evacuation takeover every 30s while idle / 3s during a session (instant revalidation on window focus; hidden tabs never poll)
- **Hosting**: Vercel Hobby tier

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB Atlas M0 cluster (free tier)
- Vercel account (for deployment)

### Environment Variables

Create `.env.local`:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/easyhc?appName=AFMZ
NEXTAUTH_SECRET=<random-32-char-hex-string>
NEXTAUTH_URL=http://localhost:3000
CRON_SECRET=<random-32-char-hex-string>
# optional — days of attendance history kept by the daily cron (default 365)
ATTENDANCE_RETENTION_DAYS=365
```

### Installation

```bash
npm install
npm run dev
```

### Initial Setup (First Superadmin)

After starting the app, create the first superadmin account by calling the setup API:

```bash
curl -X POST http://localhost:3000/api/setup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Super Admin",
    "username": "superadmin",
    "password": "YourSecurePassword123"
  }'
```

This endpoint only works when no users exist in the database.

Then log in at `http://localhost:3000/login`.

## Project Structure

```
app/
  (auth)/login/page.tsx          — Login page
  (app)/                         — Authenticated shell layout
    layout.tsx                   — AppShell wrapper, role-aware nav
    dashboard/page.tsx           — Live presence dashboard
    evacuation/page.tsx          — Evacuation launch pad + after-action reports
    scan/page.tsx                — QR code scanner (camera only)
    reports/page.tsx             — Reports with CSV export & print (both dates required)
    profile/page.tsx             — User profile & password change
    users/page.tsx               — User management (Admin)
    floors/manage/page.tsx       — Floor management (Admin)
  visitor/[floorId]/page.tsx     — Public visitor check-in (+ "Saya Selamat" during an alarm)
  api/
    auth/[...nextauth]/route.ts  — NextAuth API
    evacuation/route.ts          — Session light/roster/history + start/close
    evacuation/confirm/route.ts  — Self + warden confirmations (atomic, scoped)
    evacuation/[id]/route.ts     — After-action report detail (view_report)
    evacuation/status/route.ts   — Public live boolean (force-dynamic)
    evacuation/visitor-confirm/route.ts — Public visitor confirm (token/phone)
    attendance/route.ts          — GET active attendance
    attendance/checkin/route.ts  — POST check-in (QR token)
    attendance/checkout/route.ts — POST checkout (self/force)
    floors/route.ts              — Floor CRUD
    floors/[id]/route.ts         — Floor detail/QR rotation
    users/route.ts               — User CRUD
    users/[id]/route.ts          — User detail
    users/[id]/password/route.ts — Password change
    reports/route.ts             — Report generation
    visitor/checkin/route.ts     — Visitor check-in (public)
    visitor/checkout/route.ts    — Visitor checkout (public)
    qr/[floorId]/route.ts        — QR code image generation
    setup/route.ts               — First-time superadmin setup
    cron/daily-checkout/route.ts — 3 AM auto-checkout cron
    jabatans/route.ts            — Department CRUD
    units/route.ts               — Unit CRUD
  middleware.ts                  — /muster → /evacuation redirect (308)
components/
  providers/                     — Mantine & Session providers
  shell/                         — AppShell layout + EvacuationMode takeover
lib/
  auth/                          — NextAuth config, RBAC helper
  db/                            — Mongoose models & connection
  i18n/                          — Bahasa Melayu strings (all user-facing copy)
  validation/                    — Zod schemas
scripts/                         — Verification suites (see "Verification")
theme/                           — Mantine theme config
```

## Verification

| Command | Needs | Covers |
|---|---|---|
| `npm run check` | DB | permission matrix + fail-closed scopes (`review-check`), partial-unique indexes (`index-check`) |
| `npm run check:api` | `npm run dev` + DB | end-to-end API flow: pagination, privacy, visitor race, the full evacuation lifecycle, report detail/history/400s/404s, audit rows |
| `npm run check:visitor` | `npm run dev` + DB | visitor check-in/out and token rules |
| `npm run check:index` | DB | both partial-unique indexes actually build |

Notes:

- **Write guard**: `check:api`'s visitor-race and evacuation sections write to
  the database. They run only against a local database or with
  `E2E_WRITES=1` set — `.env.local` normally points at the same Atlas cluster
  the deployed app uses, and a test session would flash the real full-screen
  takeover onto every open production screen for ~40 seconds.
- **Never run `npm run build` while `npm run dev` is up**: both own
  `.next/`, and the dev server serves stale chunks (500s) until it recompiles.
- `npm run check` deliberately excludes the two HTTP suites (they need the dev
  server); skips inside a suite are reported as `SKIP`, never as passes.

## Roles & Permissions

| Role | Code | Description |
|---|---|---|
| Superadmin | `superadmin` | Full access, including assigning admin/superadmin accounts. **Hidden control account, not an individual**: it never appears in any staff listing (users, all-staff, my-unit, the manual check-in picker), is off every evacuation roster, and cannot hold a presence record — it can only log in and reach its own profile by id |
| Admin | `admin` | Manage users, floors, manual check-in; everything except managing admin accounts |
| Ketua Jabatan | `dept_head` | Department-wide presence, directory, reports and live locations + department force check-out |
| Ketua Unit | `unit_head` | Unit-wide presence, directory, reports and live locations + unit force check-out |
| Ketua Lantai | `floor_head` | Home-floor presence and reports + home-floor force check-out; starts/ends evacuation mode and confirms (only) their own floor's roster |
| Ketua Keselamatan | `safety_head` | Building-wide presence, directory, reports and live locations + building-wide force check-out (audited); starts/ends evacuation mode and confirms anyone |
| Pengguna Biasa | `user` | Own data and own attendance history, the live floor board, scan QR, "Saya Selamat" self-confirmation during an evacuation |

### How permission is enforced

Two layers, both in `lib/auth/rbac.ts`:

1. `can(role, action)` — gates API routes and UI visibility (nav, buttons, page guards);
2. `getAttendanceScope` / `getReportsScope` / `getUsersScope` / `getCheckoutScope`
   / `getEvacuationScope`
   — decide **which rows** a query may return. These are authoritative: row
   filtering never depends on `can()`, which is why a role can hold several
   scoped permissions without them contradicting each other.

Notes:

- Force check-out is always scoped to the caller's own boundary and is
  written to the audit log with actor + scope; every role above `user` has it.
- Evacuation mode: four roles activate it (superadmin, admin, floor_head,
  safety_head). While a session runs it takes over the ENTIRE app — full
  screen, no header/sidebar/footer, at every route — until someone closes
  it. The roster is snapshotted as **everyone with an open check-in at that
  instant** (staff and visitors alike), so "belum kesan" is always
  expected-minus-confirmed and nobody who was never in the building is
  counted. Three display states follow from that snapshot: no check-in →
  an informational "in progress" page with **no button and no stats**;
  checked in → one giant "Saya Selamat" button; confirmed → building-wide
  stats (missing first), floor locations scoped to the role, and — for
  wardens — the name list. Confirmations are atomic positional updates
  (many taps land within seconds at a muster point); start/close are
  audited, and a partial unique index guarantees at most one active
  session. Visitors confirm from their public check-in page (device
  token or phone, rate-limited) and never see statistics. Closed sessions
  become after-action reports (`evacuation:view_report`, the same four
  roles): history with duration and counts, drill-down into per-floor
  tallies and the full roster, and CSV export for incident documentation.
  Headline counts are building-wide for every viewer; the per-floor tallies
  and the roster are floor-scoped for ketua lantai. The one-line
  last-session summary shown to roles WITHOUT the report table carries
  counts and times only (no names), and the "stats appear after confirming"
  rule is UI ordering, not a security boundary — the API serves aggregates
  to any authenticated caller. The takeover signal polls every 30s while
  idle and 3s during a session (instant on window focus) — sized for Vercel
  Hobby's 1M invocations/month; only visible tabs poll. Employees without a
  unit (or whose unit has no home floor) appear in the headline counts but
  on no floor's tally and no warden's name list — fail-closed by design;
  admins/safety see them and reconcile in person.
- A floor has no static membership, so `floor_head`'s directory scope is
  "own" only — who is standing on their floor comes from the floor board.
- Visitor check-in/out is capability-based (the floor's QR token), not
  role-based: anyone who scans the visitor QR may check a visitor in.

## Deployment to Vercel

1. Push to GitHub
2. Connect repo to Vercel
3. Set environment variables in Vercel dashboard:
   - `MONGODB_URI`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` (your production domain)
   - `CRON_SECRET`
4. Deploy — Vercel will auto-detect Next.js

The `vercel.json` configures the daily 3 AM MYT cron job (19:00 UTC).

## Free Tier Risks & Mitigations

| Risk | Mitigation |
|---|---|
| MongoDB M0 512MB storage | TTL indexes auto-purge AuditLog after 90 days; the daily cron purges Attendance older than `ATTENDANCE_RETENTION_DAYS` (default 365) |
| MongoDB M0 ~500 connections | Mongoose connection cached as global singleton; `maxPoolSize: 10` |
| Vercel Hobby 1 cron/day | Only the 3 AM daily auto-checkout uses cron; no other scheduled jobs |
| No websockets | Dashboard uses SWR polling (25s intervals) |
| Cold starts | Keep API routes lean; heavy dependencies loaded dynamically (e.g., `html5-qrcode`) |

## UI Language

All user-facing text is in Bahasa Melayu Malaysia. The centralized strings file is at `lib/i18n/strings.ts`. Code (variable names, comments, DB fields, API routes) stays in English.