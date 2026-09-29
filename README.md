# Parivar

A family / samaj management app: member directory (Members / પરિવારજનો) with family tree, castes,
roles and groups; blood-donor search; manual fundraise ledgers with teams, meetings,
updates, public links and printable statements; an events calendar; in-app notifications;
and admin settings. Gujarati and English throughout.

Built to `.claude/skills/parivar-design/references/design-system.md`: Next.js 16 (App Router, JavaScript), Tailwind v4, shadcn over Base UI,
lucide, sonner, MySQL 8 via `mysql2/promise`. Roadmap and status: `TODO.md`.

## Setup

```bash
npm install
cp .env.example .env.local      # fill in DB_* and SEED_ADMIN_* (.env is read too; .env.local wins)
npm run db:schema               # creates the database and all tables (safe to re-run)
npm run db:seed                 # creates the first super_admin
npm run db:seed -- --demo       # optional: sample family, castes, group, fundraise, event
npm run dev                     # http://localhost:3000
```

No MySQL locally? `npm run db:dev` starts a throwaway MySQL 8.4 on port 3307
(downloaded on first run, data lost on exit). Point `.env.local` at `DB_PORT=3307`.

Production: `npm run build && npm start`.

## Roles

`super_admin` › `administrator` › `sub_admin` › `sabhyo` (shown as Member)

All rules live in `src/lib/roles.js` and are re-checked inside every server action;
hiding a button is never the only gate. Nobody can assign a role equal to or above their
own (except super_admin), and nobody changes their own role.

Group admin is separate from app role (`admin_group_members.member_role`): any member can
be made admin of a group from the Members list, which lets them manage that group and
its fundraises without any app-wide power.

Fundraise team roles (`fundraise_members`): organizer (manages the fundraise), treasurer
(contributions + expenses), collector (contributions), volunteer (updates only). One person
can hold roles on many fundraises. Every check goes through `fundraisePermissions` in
`src/lib/access.js`.

## Database

Schema: `public/schema/live/parivar.sql` (26 tables). Tables are prefixed by module:

| Prefix | Tables |
| --- | --- |
| `users_` | `users_list`, `users_listmeta`, `users_relations`, `users_sessions`, `users_notifications` |
| `admin_` | `admin_groups`, `admin_groupsmeta`, `admin_group_members`, `admin_castes`, `admin_settings`, `admin_audit_log` |
| `blood_` | `blood_requests`, `blood_requestsmeta`, `blood_settings` |
| `fundraise_` | `fundraise_campaigns`, `fundraise_campaignsmeta`, `fundraise_contributions`, `fundraise_expenses`, `fundraise_expensesmeta`, `fundraise_members`, `fundraise_updates`, `fundraise_updatesmeta`, `fundraise_settings` |
| `events_` | `events_list`, `events_listmeta`, `events_settings` |

Three storage shapes, used deliberately:

- **Main table**: columns you filter, sort or join on (`users_list.caste_id`, `fundraise_campaigns.location`).
- **`<table>meta`**: per-row long or never-filtered content (`meta_key`, `meta_value`), via `getMeta` / `setMeta` in `src/lib/db.js`.
- **`<module>_settings`**: module-wide switches and lists, one key/value row per setting
  (`admin_settings` for app-wide). Every setting is declared once in `src/lib/settings.js`
  (type + default), and the `/settings` page is generated from that registry.

`parivar.sql` is the complete current schema; every migration so far has been applied to the
live database and folded into it, so the migration files were removed. For the next change, add
`public/schema/migrations/{Ymdhis}-{reason}.sql`, run it with `npm run db:migrate -- <file>`
(or `mysql < file`; `DELIMITER` blocks work in both), and update `parivar.sql` to match.

The live database is MariaDB 11.8; the schema and app also run on MySQL 8. MariaDB returns
`JSON` columns as strings, so code reading `data` / `detail` accepts a string or an object.

## Castes

`admin_castes` holds castes and one level of sub-castes, managed by administrators at
`/settings/castes`. A caste already on member records can be hidden but not deleted. Members
carry `caste_id` + `subcaste_id`; filtering by a caste includes all of its sub-castes.

## Notifications

`users_notifications` stores a `type` and `data`, not text. It is rendered through the
reader's dictionary, so each person reads it in their own language. Sent for blood
requirements (compatible donors only), group admin/member, fundraise team role, meetings,
updates and new events. Donor and event notifications can be switched off in settings.

## Auth

Phone number + password (bcrypt). Sessions are server-side rows in `users_sessions`
(only a SHA-256 of the cookie token is stored), so logout, password reset, deactivation
and role changes take effect immediately. `src/proxy.js` only does optimistic cookie
checks; the real check is `requireUser()` in the `(app)` layout and every action.

## Language

First visit asks for ગુજરાતી or English (`/language`); the choice is a cookie and, once
signed in, `users_list.language`. Dictionaries: `src/lib/i18n/dictionaries/{en,gu}.js`.
Names and titles have optional `_gu` columns shown when the UI is Gujarati.

## PDF

Fundraise statements are print-optimised pages; "Print / PDF" uses the browser's Save as
PDF. That is deliberate: browsers shape Gujarati conjuncts correctly, server-side PDF
libraries mostly do not.

## Deploy on Vercel

1. Import the repo in Vercel (framework: Next.js; build command `npm run build`).
2. Environment variables (Project → Settings → Environment Variables): `DB_HOST`, `DB_PORT`, `DB_USER`,
   `DB_PASSWORD`, `DB_NAME`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`.
   `DB_POOL_SIZE` is optional (defaults to 2 on Vercel, 3 elsewhere).
3. The MariaDB server must accept connections from outside (Vercel has no fixed IPs on normal plans):
   allow remote access for the DB user, and use a strong password.
4. Meeting reminders: `vercel.json` runs `/api/cron/reminders` once a day (03:00 UTC — the Hobby plan's limit;
   Vercel sends `Authorization: Bearer $CRON_SECRET`). On top of that, every signed-in page view checks for due
   reminders in the background (at most once a minute), so they go out while people use the app. For exact
   timing on quiet days, point a free external scheduler (e.g. cron-job.org, every 5 minutes) at
   `https://<site>/api/cron/reminders?key=<CRON_SECRET>`. On the Pro plan you can set the cron to `*/5 * * * *`.
5. Connections: Hostinger shared hosting allows **500 new DB connections per hour per database user**
   (`max_connections_per_hour`, cannot be raised on shared plans). The app keeps a tiny pool (2 per Vercel
   instance) and keeps connections open. Use a **separate database user for local development** and scripts,
   so testing never eats production's budget (Hostinger → Databases → add a user to the same database).
   Turn on Fluid Compute in Vercel (Settings → Functions) so fewer instances start.
6. Region: `vercel.json` pins the functions to `bom1` (Mumbai), next to the database. Vercel's default is
   Washington (iad1) — ~200 ms per query to Mumbai, several seconds per page. If the database moves, move this too.
7. Nothing is written to disk at runtime: the Samaj favicon / app icons live in `admin_settings`
   (`app_icon_512/192/32`), so they survive deploys.

Elsewhere (a normal Node server, `npm run build && npm start`) the reminder loop runs inside the process;
the cron URL is only a backup.
