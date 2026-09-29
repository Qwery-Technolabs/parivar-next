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

## Phase 4 — Members (પરિવારજનો)
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
- [x] Plural forms ("1 member" / "3 members"): { one, other } entries picked by count
- [x] First commit + push to `origin`

## Phase 11 — Requests log (Sept 2026)
Everything asked for, so nothing is forgotten. [x] = built, [ ] = pending.

### Groups
- [x] Group picture: icon (≈125 business/community icons), emoji, or ≤2 letters; preset or custom background colour (text colour auto-picked for contrast)
- [x] Picture sits left of the name in the group form; clicking it opens its own picker popup; new groups start on a random icon + colour
- [x] Picture shown in the /groups chat list and the group header
- [x] Group roles: admin, sub-admin, speaker, member — sub-admin adds/removes members & speakers but never touches admins/sub-admins; admins manage everyone
- [x] Discussion setting per group: everyone posts, or only admins / sub-admins / speakers (others read-only)
- [x] Add member by phone number (registered or not); new numbers get an account with the phone number as first password
- [x] "Not joined yet" tag until first sign-in; admins can remove them like anyone
- [x] Discussion history notes: meeting scheduled, member added / removed (centred, WhatsApp-style)
- [x] Removing a never-signed-in invitee: offer to delete the unused account (only if invited, in no other group, no contributions)

### Members
- [x] Bulk select → Add to group / Make group admin (bar above the table)
- [x] Edit member page as iconed tabs, each saved separately (Basic, Community, Details, Role & status, Password)
- [x] Admins & sub-admins reset any member's password (not accounts ranked above them)
- [x] First sign-in on the temporary password → forced Set password → own edit page to fill in details
- [x] Invite by phone on /members for admins — several people at once (rows of phone + name, optional groups to join); default password = phone number

### Tables & filters
- [x] One toolbar everywhere: search + Filters popup on the right (members, blood requests & donors, audit, fundraise)
- [x] /blood: status / blood group / compatible / village moved into the Filters popup; donor search; donors listed without a group chosen

### Auth & settings
- [x] Admin setting: project timezone (default IST) — drives "today", reminders and the DB clock
- [x] Admin settings: allow self-registration (login page link) + require approval (new accounts wait inactive; admins notified)
- [x] Login says "not active yet" for accounts waiting for approval (only once the password is right)

### Fundraise
- [x] A fundraise can belong to one or more groups (home group + "Also show in these groups"; fundraise_groups table)
- [x] /fundraise/new and /edit: Status sits above the card

### Later the same day
- [x] Invite by phone: name optional (phone number stands in until they fill in details), no local-language field
- [x] Group picker in invite / bulk dialogs: shows 5 at a time, searchable past 5 groups
- [x] Every Filters popup is two columns; Members filters grouped (Person, Place, Community, Blood)
- [x] Group visibility: Public (listed for everyone) / Private (only members and app-level managers); tag in list and header
- [x] Sidebar: Home on its own; Members and Groups in the Community section
- [x] Role label "Sabhyo" shown as "Member" (stored value unchanged)
- [x] "Not registered yet" tag for people who never signed in: group Members tab, /members list and profile (admins only)
