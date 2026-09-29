# Parivar App — TODO

Stack (from `design-system.md` §0): Next.js 16 App Router · JavaScript (no TS) · Tailwind v4 ·
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
- [x] Roles sarpanch / up-sarpanch removed (their rights now start at sub-admin); live enum updated
- [x] Group edit: Visibility and "Who can send messages" on one row; posting chosen per role (admin always ticked); old two-choice setting still read
- [x] "Who can send messages" is a multi-select tag selector (Admin always kept)
- [x] Group member row menu: "Change role ›" submenu (current role ticked, ‹ Back), then Remove from group
- [x] Add relation (સંબંધ ઉમેરો): existing member or by phone number (invited; sub-admin+ or your own family)
- [x] Group edit popup: Visibility 25% / Who can send messages 75%; new groups default to Admin + Sub-admin posting
- [x] /fundraise/new & edit: compact two-column layout (Details | Groups, Sharing, Who sees it first), tinted card headers, pinned Save bar; single description (no local copy)
- [x] No <datalist> anywhere: village, city, place and audience values use a single-value pick-or-type dropdown (type to filter, click to fill; new values allowed)
- [x] Page title actions in a kebab at the right of the title row (Members: Add, Invite, Castes; profile: Edit, Family tree; Mark all read). Single "create" actions (New event, New group, Post request) stay buttons
- [x] Kebab (⋮) everywhere: white background, slightly dark border, same grey icon
- [x] Fix: picking a village / city suggestion inside a form label was undone by the label re-clicking the new chip's ×
- [x] Group sub-admins can edit group details (name, picture, visibility, who can post); still cannot act on admins
- [x] Standalone fundraise (no group): "New fundraise" button on /fundraise for fundraise managers; group_id nullable on live
- [x] Group sub-admins can start fundraises in their groups (and see its drafts)
- [x] Meeting row: Edit and Cancel side by side, Cancel in red
- [x] Back link moved into the top header (right of the collapse arrow); always goes to the parent page (not back through tabs)
- [x] Notifications: delete one (trash per row), delete read, delete all (with confirm)
- [x] Fundraise page sits inside the content gutters like the group page (rounded header card); its Edit button matches the group Edit
- [x] "Post an update" moved into the discussion: bell toggle before Send alerts everyone (default normal message); earlier updates stay read-only in About
- [x] Fundraise has its own Meetings tab (Discussion · Income/Expense · Meetings · About)
- [x] Fundraise picture picker like groups (icon / emoji / 2 letters on a colour); shown in header, /fundraise list and group Fundraise tab
- [x] Public fundraise page: PDF download is an icon-only button
- [x] Public fundraise page shows the fundraise picture beside its title
- [x] /fundraise list: row kebab for project admins (Open, Edit, Income/Expense, Meetings, Public page, Delete)
- [x] Login: "Remember me" (1-year cookie; off = until the browser closes)
- [x] /members bulk: "Reset password to phone" (password = own phone, must change at next login, signed out; sub-admin+, not higher ranks)
- [x] Logo on orange background (sidebar and sign-in)
- [x] Sidebar: Fundraise is its own item (no longer indented under Groups)
- [x] Fundraise: Archive instead of delete; archived → Restore or Delete (delete refused unless archived); Archived view for project admins; archived hidden from lists, group tabs, public link
- [x] Sidebar: Overview (Home) · Community (Groups) · Services (Blood, Fundraise) · Miscellaneous (Members, Activity log)
- [x] Print/PDF: fundraise picture in the header; prints with background graphics by default
- [x] Member name in parts: first name, father's name, surname (Gujarati: તમારું નામ / તમારા પિતાનું નામ / અટક), all required; full_name = their join; old records split (2 words → first + surname); surname matching uses the column
- [x] /calendar shows members' birthdays (cake, "turns N", links to the profile)
- [x] Calendar entries have an icon per kind (cake, fundraise, event, meeting, festival)
- [x] /calendar filters: show birthdays / meetings / fundraises / events / festivals only; birthdays of one member role
- [x] Group & fundraise meeting calendars: members' birthdays + All / Meetings / Birthdays filter and a role filter
- [x] Public page header: navy, orange logo, Samaj name from settings (Gujarati spelling on Gujarati pages)
- [x] Samaj logo: picked in Settings → General (left of the Samaj name, same picker as groups); shown in sidebar, sign-in and public pages; default orange people icon
- [x] Filter popups everywhere: tinted header (Filters + close) and tinted footer (Clear / Apply)
- [x] /calendar: Filters button on the month row (right side)
- [x] Activity log moved into Settings (admin group, sub-admin+); removed from the sidebar
- [x] Local-language name in parts too (first / father's / surname, each auto-filled from its English twin); full_name_local = their join; old records split
- [x] Sidebar: "Home" renamed "Dashboard"
- [x] Fundraise form Details card: picture alone in the left column, all other fields in the right column
- [x] Fundraise edit page: Archive / Restore / Delete moved into the kebab at the right of the title row
- [x] Fundraise new/edit: Status picker in the title row, left of the kebab (still saves with the form)
- [x] "Restore" renamed "Unarchive"; archived fundraise page shows a notice with an Unarchive button (project admins)
- [x] Filter popups: only the middle scrolls (header / footer fixed); no white strips above the header or below the footer
- [x] Invite by phone: paste a list (one per line, +91 or not, optional name) and each number gets its own row; duplicates skipped
- [x] Header: light divider between the calendar button and the profile button
- [x] Fixed: all member pages 404 after the build (dev server started on build output) — cleared .next, restarted
- [x] Activity log is a Settings section (?section=audit); /audit redirects there with its filters
- [x] Activity log: "Clear these N entries" deletes what the current filter shows (administrators, confirmed, and logged)
- [x] Activity log: filter by member (who did it); Clear respects it
- [x] Settings → General card: logo alone in the left column, all fields on the right
- [x] Settings → Profile: edit your own details in place (?section=profile&action=edit), tabs saved separately; Done returns to the profile
- [x] Sidebar Services: Fundraise first, then Blood
- [x] Contributions: "Not paid (pending)" mode — listed with a Pending badge, left out of collected / donation totals; summary shows the pending amount
- [x] Contribution "Member" field: type a phone number that is not a member → "Invite <number>"; saves as an invited member (name from the form), gift linked, notified
- [x] Fundraise: Print / PDF button in the header (removed from the About tab bottom)
- [x] Fundraise About tab: wider side column on desktop
- [x] Public link card: the public switch sits in the card header
- [x] Pending (not paid) contributions: "Mark as paid" in the row kebab (mode + date, default today; logged in history)
- [x] Samaj logo → favicon & app icon: drawn on a canvas on save (512/192/32 PNG), stored in the DB (admin_settings app_icon_*), served via /api/app-icon; web manifest with the Samaj name
- [x] Activity log: "Clear these entries" moved below the table (out of the filter row)
- [x] Project skills in .claude/skills: parivar-design (+ references/design-system.md, moved from DESIGN.md), parivar-dev, parivar-db, parivar-i18n; CLAUDE.md points to them
- [x] Marathi removed everywhere (local-language options, dictionaries, settings, skill)
- [x] Sidebar logo row: same faint bottom line as the header (desktop + phone drawer)
- [x] Sidebar section titles: 5px top spacing
- [x] No first-visit language redirect: default UI language = Settings → General "Default language for new members" (else Gujarati); /language only for switching
- [x] Settings → Notifications: one place for this device's push, "what to notify me about" per kind (blood, calendar, meetings, fundraise, groups, discussion, member sign-ups) and the admin-wide switches (blood donors, new events)
- [x] Push notifications: Samaj logo as icon/badge; title names where it came from (fundraise / group / meeting, reader's language)
- [x] Sidebar: active item's icon in orange
- [x] Fundraise About tab: "Add to team" in the Team card header
- [x] Phone drawer slides in/out; long Samaj name truncates instead of running under the close button; opens before the JS loads (CSS checkbox)
- [x] Dev on a real phone: allowedDevOrigins for LAN addresses (menus/popups were dead because dev JS was blocked)
- [x] Phone bottom bar (Home · Groups · Fundraise · Blood · Members) on those section pages only; hidden inside a group / fundraise / chat
- [x] Group / fundraise pages on phones: back button instead of the hamburger; Edit is icon-only; smaller tab labels
- [x] Vercel-ready: icons in the DB, Vercel Cron → /api/cron/reminders (Bearer CRON_SECRET), no in-process loop on Vercel, smaller DB pool; README section
- [x] "Alert everyone" bell only for admins / sub-admins (fundraise: no longer for organizer / treasurer / collector / volunteer; group sub-admins of its groups now included)
- [x] Header back on group / fundraise pages leaves the page directly; tab switches replace history instead of stacking
- [x] Meetings tab on phones: Schedule / Edit / Cancel buttons icon-only
- [x] Fundraise header: PDF + Edit top-right of the card; status left and my role right on the next row (phones: role value only)
- [x] Browser theme colour follows the Samaj logo's background colour (viewport + web manifest)
- [x] Income / Expense tab on phones: summary boxes gone (header shows totals + target % to 2 decimals); one row = view switch, Share menu, single contextual "+"
- [x] Member detail page on phones: label and value side by side (divided rows)
- [x] Members list on phones: occupation hidden under the name; wider name column so full names show
