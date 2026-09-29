# Parivar App — TODO

Stack (from `DESIGN.md` §0): Next.js 16 App Router · JavaScript (no TS) · Tailwind v4 ·
shadcn (`tsx:false`, `cssVariables:true`) · lucide-react · sonner · MySQL 8 + `mysql2/promise`.

Legend: `[x]` done · `[~]` in progress · `[ ]` pending

---

## Phase 0 — Foundation
- [x] Scaffold Next 16.3 (JS, App Router, `src/`, `@/*`), `"type": "module"`, jsconfig only
- [x] Tailwind v4 tokens: 3-layer `@theme inline` / `:root` / `.theme-*` (+ `.theme-fundraise`, `.theme-blood`, contrast measured)
- [x] Fonts: Geist + Noto Sans Gujarati
- [x] Overflow backstop, shell `h-dvh overflow-hidden`, `min-w-0` chain
- [x] UI kit: Field/textInput, Switch, Badge, Table, Pagination (+per-page cookie), Popover/Kebab, Combobox, MemberPicker, FormDialog, SubmitButton
- [x] `lib/db.js` — cached pool, named placeholders, prepared-stmt budget, read-only retry, `withTransaction`, `inList`, meta helpers

## Phase 1 — Database (`public/schema/`)
- [x] Module prefixes: `users_`, `admin_`, `blood_`, `fundraise_`, `events_`; long/non-filterable data in `<table>meta`
- [x] Live dump `public/schema/live/parivar.sql` (26 tables) — executed on MySQL 8.4, fresh install == migrated DB
- [x] Live DB (MariaDB 11.8): full schema + all migrations applied, structure verified identical to local, super_admin seeded; migration files removed
- [x] `npm run db:schema | db:migrate | db:seed [--demo] | db:dev`
- [x] Module settings (key/value rows): `admin_settings`, `fundraise_settings`, `blood_settings`, `events_settings` via `lib/settings.js` registry

## Phase 2 — Auth & roles
- [x] Phone + password login (bcrypt, timing-safe), DB sessions, `proxy.js`, login throttle
- [x] Roles super_admin › administrator › sub_admin › sarpanch › up_sarpanch › sabhyo — `lib/roles.js`, enforced in actions
- [x] Change phone / password (profile), admin password reset → sessions revoked

## Phase 3 — i18n
- [x] First-visit language chooser, cookie + `users_list.language`, header toggle
- [x] `en` / `gu` dictionaries (key parity checked), `_gu` name/title columns

## Phase 4 — Parivar Jano
- [x] Directory with URL filters (search, role, blood group + compatible donors, donor, village, gender, status), pagination
- [x] Profile page, add/edit member, role assignment bounded by own role
- [x] Make group admin / add to group from the list
- [x] Family tree (lazy-loaded), relations with cycle protection
- [x] Castes + sub-castes (`admin_castes`), admin-managed at `/settings/castes`; on member form, list column and filter

## Phase 5 — Groups
- [x] Create/edit groups, add/remove members, promote/demote group admins

## Phase 6 — Blood
- [x] Requirements (post, fulfil, cancel, reopen), donor finder with compatibility

## Phase 7 — Fundraise
- [x] Campaigns under groups, manual contributions & expenses, totals, by-contributor
- [x] Public link (toggle/regenerate), public page, print → PDF (Gujarati-safe)
- [x] Team roles per fundraise (organizer / treasurer / collector / volunteer); one person on many fundraises
- [x] Meetings on a fundraise (shown on calendar) + minutes and updates timeline
- [x] "My donations" and "My fundraises" views
- [x] Location on fundraises; feed shows fundraises in my village first; location filter
- [x] Use `fundraise_settings` (default public, allow anonymous, expense categories)

## Phase 8 — Calendar
- [x] Month grid + agenda, events + fundraise windows, create/edit/delete

## Phase 9 — Notifications & settings
- [x] `users_notifications`, bell with unread count, `/notifications`, open → mark read
- [x] Triggers: blood requirement → compatible donors; group admin/member; new event
- [x] Triggers: fundraise role, meeting, update
- [x] Settings page (administrator+) for all module settings

## Phase 10 — Polish
- [x] Audit log page
- [x] Production build passes + prod smoke test (all routes × 2 roles × 2 languages, 0 errors)
- [ ] Mobile pass at 360px
- [ ] Browser click-through of dialogs (skipped on request; actions tested over HTTP)
- [ ] Plural forms ("1 members")
- [ ] First commit + push to `origin` (on request)
