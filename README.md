# EasyHC — Sistem Kehadiran Lantai

A PWA for tracking employee and visitor presence on building floors, primarily for emergency headcounts (fire, earthquake, etc.).

## Tech Stack

- **Framework**: Next.js 14+ (App Router), TypeScript
- **UI**: Mantine v7 — mobile-first, installable PWA
- **Database**: MongoDB Atlas M0 (free tier), via Mongoose
- **Auth**: NextAuth v5 (Auth.js) — username + password, JWT sliding-window sessions
- **QR**: `qrcode` (generation), `html5-qrcode` (camera-only scanning)
- **Validation**: Zod
- **Data Fetching**: SWR (polling, 25s intervals)
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
    scan/page.tsx                — QR code scanner (camera only)
    reports/page.tsx             — Reports with CSV export & print
    profile/page.tsx             — User profile & password change
    users/page.tsx               — User management (Admin)
    floors/manage/page.tsx       — Floor management (Admin)
  visitor/[floorId]/page.tsx     — Public visitor check-in
  api/
    auth/[...nextauth]/route.ts  — NextAuth API
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
components/
  providers/                     — Mantine & Session providers
  shell/                         — AppShell layout components
lib/
  auth/                          — NextAuth config, RBAC helper
  db/                            — Mongoose models & connection
  i18n/                          — Bahasa Melayu strings
  validation/                    — Zod schemas
theme/                           — Mantine theme config
```

## Roles & Permissions

| Role | Code | Description |
|---|---|---|
| Superadmin | `superadmin` | Full access, including assigning admin/superadmin accounts |
| Admin | `admin` | Manage users, floors, manual check-in; everything except managing admin accounts |
| Ketua Jabatan | `dept_head` | Department-wide presence, directory, reports and live locations + department force check-out |
| Ketua Unit | `unit_head` | Unit-wide presence, directory, reports and live locations + unit force check-out |
| Ketua Lantai | `floor_head` | Home-floor presence and reports + home-floor force check-out; confirms (only) their own floor's roster during an evacuation |
| Ketua Keselamatan | `safety_head` | Building-wide presence, directory, reports and live locations + building-wide force check-out (audited); starts/closes evacuation sessions and confirms anyone |
| Pengguna Biasa | `user` | Own data and own attendance history, the muster board for their own floor, scan QR, "Saya Selamat" self-confirmation during an evacuation |

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
- Evacuation sessions snapshot their roster (active employees + open visitor
  check-ins) when started, so "belum kesan" is always expected-minus-confirmed
  at that instant. Confirmations are atomic positional updates (many taps land
  within seconds at a muster point); start/close are audited, and a partial
  unique index guarantees at most one active session. Name lists are visible
  to `safety_head`/admins (whole building) and `floor_head` (own floor) only —
  everybody else gets counts and their own status.
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