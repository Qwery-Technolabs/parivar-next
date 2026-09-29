# Parivar

A family / samaj management app: member directory (Parivar Jano) with family tree, castes,
roles and groups; blood-donor search; manual fundraise ledgers with teams, meetings,
updates, public links and printable statements; an events calendar; in-app notifications;
and admin settings. Gujarati and English throughout.

Built to `DESIGN.md`: Next.js 16 (App Router, JavaScript), Tailwind v4, shadcn over Base UI,
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

`super_admin` › `administrator` › `sub_admin` › `sarpanch` › `up_sarpanch` › `sabhyo`

All rules live in `src/lib/roles.js` and are re-checked inside every server action;
hiding a button is never the only gate. Nobody can assign a role equal to or above their
own (except super_admin), and nobody changes their own role.

Group admin is separate from app role (`admin_group_members.member_role`): any member can
be made admin of a group from the Parivar Jano list, which lets them manage that group and
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

Migrations: add `public/schema/migrations/{Ymdhis}-{reason}.sql`, run it with
`npm run db:migrate -- <file>` (or `mysql < file`; `DELIMITER` blocks work in both), and keep
the live dump in sync. The existing migrations are safe to re-run.

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
