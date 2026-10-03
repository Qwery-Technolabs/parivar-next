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
- [x] Ledger colours: contributions blue, expenses orange — amounts everywhere, add / edit buttons, tabs; phones get two "+" buttons (blue contribution, orange expense)
- [x] Fundraise header: "Add to group" — show the fundraise in more groups (groups where you may start a fundraise; hidden when none left)
- [x] Settings → Language: both cards side by side, each a dropdown that saves on change
- [x] Settings: "Sent to everyone" switches moved to Samaj → Alerts (admins); Notifications keeps this device + my kinds
- [x] Anonymous contributions: shown as "Anonymous" / "રામભરોસે" to everyone except fundraise managers (list, by contributor, print)
- [x] Dialogs: Cancel and Save side by side on phones; no field autofocus on open (all FormDialogs, incl. contribution / expense)
- [x] Fundraise header: status as a coloured dot on the picture (green active, grey draft, red closed); status badge removed; role hidden on phones and shown in the About tab Team card
- [x] Group status: active / inactive (read-only discussion) / archived (hidden from members); status dot on group pictures; About → Danger zone with Mark inactive, Archive / Restore, Delete permanently (archived only)
- [x] Fundraise audience: "Who should see this" (only matching members; team, group admins and managers always) + switch "Also show to everyone else, lower in their list"; existing fundraises with an audience keep the old behaviour (switch on)
- [x] Built-in favicon moved to public/ (still the no-logo fallback) so pages link only the Samaj logo icons
- [x] Vercel Hobby: cron daily (0 3 * * *); reminders also checked after signed-in page views (once a minute) on Vercel; README explains an optional external scheduler
- [x] Theme colour back to brand navy (#172f56) — not the logo colour
- [x] Status dot on fundraise list pictures too; all status dots a bit smaller (size-2.5, size-2 on small pictures)
- [x] Vercel functions pinned to bom1 (Mumbai), next to the database — pages were slow from the default US region
- [x] DB connections: pool 2 on Vercel / 3 locally, idle connections kept (host limit 500 new connections/hour per user); README: separate DB user for local dev, Fluid Compute
- [x] All Cancel / Save bars side by side on phones (new / edit fundraise, event forms, member form, picture picker, dialog footer)
- [x] Group danger zone: buttons icon-only on phones, coloured by meaning (pause amber, archive slate, active green, delete red)
- [x] Matrimony (sidebar after Fundraise): opt-in profiles (unmarried, 18+), listed by the person / family / admins; list with filters (bride / groom, age, caste, place); profile with basics, education & work, family, preferences, family contact
- [ ] Matrimony: decide who may browse (now: admins + families with a listed profile) — `canBrowseMatrimony`
- [ ] Matrimony: photos (needs upload storage)
- [x] Family tree: Family page per person (father, mother, wife/husband, brothers, sisters, sons, daughters) with add / remove; relatives can be new people (optional phone → login, birth date, alive / late, marital status, local name auto) or existing members (male line searched by surname); links kept consistent; tree shows siblings; family visible only to people connected in the tree (plus who added them and admins); "Deceased" shown as "Late"
- [x] Member edit / create: marital status field; editing a family relative without a phone no longer demands phone or father's name; whoever added them can save edits
- [x] Family: no separate page — profile Family card lists near relatives, header "Family tree" + "Add" popup (relation first, stays open to add more); tree canvas shows every generation with drag and zoom
- [x] Matrimony: who may list — the person, their father / mother, admins; anyone in the family once the father has passed away
- [x] Member picker (Combobox): the list closes after picking someone and no longer pops back open (focus returning to the input inside a popup)
- [x] Relatives without a phone: adding a number later (member edit) gives them a login (number = first password); profile tells editors when someone cannot sign in yet
- [x] Add relative: only the first name is typed — father's / husband's name and surname filled from the person (with a preview and "change" link)
- [x] Family tree: real tree view from the oldest ancestor to the youngest descendant, with connector lines and couples side by side
- [x] Family tree cards: first name only (no father's name / surname) and age or Late only (no marital status); narrower cards
- [x] Family tree redesign: couples as one joined card (husband left, wife right, heart between), round initial avatars, roomier generations
- [ ] Family tree: real photos on the avatars (needs upload storage)
- [x] Family tree like the reference: boxless round avatars with first name + relation (Father, Kaka …), couples joined by a line, children from its middle, compact
- [x] "How you're related" on profiles: chain from you to the person with each step and the kinship word (Kaka, Foi, Fuva, Mama, Bhabhi, Jamai …)
- [x] Family tree tiles: man / woman avatar figures (same colour), plain canvas, slim 1.5px ring for the tree's person
- [x] Family tree Details: marital status shown only for the last person in a line (no spouse, no children)
- [x] Members list: unregistered people (never signed in) hidden by default; Registration filter shows them
- [x] Family tree: pinch to zoom and drag to pan inside the box (trackpad pinch / Ctrl + scroll on desktop); zoom buttons removed
- [x] "How you're related" moved into the Family card (Family | Relation switch in the header); other generations indented; long chains fold behind "Show N more"
- [x] Phones: no whole-page pinch zoom or sideways drift (touch-action, overscroll, viewport); table swipes stay in the table
- [x] Family tree: smaller avatar tiles; light grey canvas
- [x] Family tree: smaller avatars, longer connecting lines, tidier spacing
- [x] Family tree tiles: figure fills the tile (3px edge), name written inside in white; couple card 3px padding/gap
- [x] Name fields: "(English)" after the English labels (member form, register, add relative)
- [x] Family tree: every generation on the same level across branches (only children keep the spacing; fixed tile height with Details)
- [x] Relation view: generation per person (1st / 2nd generation above / below, same), relation tag per person, cards stepped by generation, curved joints from avatar to avatar; more kinship names (grandfather's brother, father's cousin, second cousins)
- [x] Father's name filled automatically from the linked father (new links + one-time backfill on live); never overwrites a typed one
- [x] Married women: married name (husband's name + in-laws' surname) as the main name, maiden name (father's name + surname) kept beside it; 4 name fields in add / edit for married women; maiden name shown in her father's family; live backfill (+ #45 first-name fix)
- [x] Faster pages with several users: the family connection check reads all links in one query per request
- [x] Caste follows the family: relatives without a caste take it from father → husband → spouse → mother → siblings → children (on every link + live backfill)
- [x] Add relative: a married woman's known name parts are filled and hidden (only unknown ones asked); a woman's child gets the father from her married name when no husband is linked
- [x] Member picker inside a popup: the list opens in the flow so it is never cut off by the popup
- [x] Surnames (Members ⋮): every surname in use, mapped to caste → sub-caste one by one or several at once; members without a caste get it, also on create / invite / register / family link / surname change
- [x] Discussion: "Clear history" for admins (groups + fundraises); admins and sub-admins delete any message (fundraise: also its groups' sub-admins)
- [x] Meetings: "Everyone" includes people who join later (saved audience; new members added before listing and before reminders); edit reopens on the saved choice
- [x] Mandal (savings circle): new fundraise type inside a group; members added by admins / sub-admins / treasurer / collector (pick or invite); fixed amount per meeting (changeable per meeting) with collect yes/no; attendance & money sheet per meeting; pending carried forward; missed meetings + days away; opening balance; expenses via the ledger
- [x] Print pages (/fundraise/[id]/print, /p/[token]/print) scroll again (html/body overflow-x: clip, not hidden); "Include in print" chips — By contributor / Contributions / Expenses via ?show=, default Contributions only
- [x] Mandal: started from the group's "+ New ▾" menu (Fundraise / Mandal); group's own (no group choice, other groups, public link or audience); hidden outside the group and from the Fundraise feed; meetings invite all or chosen Mandal members; payments by Cash / UPI / …; members' dues shown as pending
- [x] Mandal: members on the form like a meeting's attendees (everyone in the group, kept in sync / chosen people); home group shown (that group only); public link allowed. Print: payment modes in their own colours, Not paid amounts + Pending total in red
- [x] Family tree + Family card: children (and siblings) eldest first by birth date, left to right; people without a birth date keep their place
- [x] Mandal: "Who is in this Mandal" in its own right-side card on the form; Mandal tab Schedules card (+ New schedule; date - Mandal, place, amount per person, money kept by; kebab Edit / Archive when money received / Delete when none / Restore); Who has the money + common expenses + balance
- [x] Mandal form: no Target, no Amount per meeting; Place plain text (not a suggestion); Schedules card on the right under Sharing — add / edit / archive / delete, saved with the form
- [x] Mandal: no Place on the form; same tabs as a fundraise with the Mandal part (members, schedules + money sheet, who has the money) in About; payments in history; pinned on top of its group's list while running
- [x] Mandal shown on /fundraise too (with Mandal badge), only to its group's members, its members and team
- [x] Sidebar: My family tree (own tree) before Members
- [x] Family tree: "Married daughters" switch beside Details — off hides married daughters in every chain
- [x] Name fields: Google Input Tools suggestions (numbered list under the local box, ↑/↓, ↻ cycles 1st→2nd→3rd, resets after a manual edit); built-in rules as instant fill + fallback
- [x] Google suggestions everywhere: list also on focus of a saved local name; surname manager rows get an editable local spelling with the list
- [x] Surnames page compact: one line per surname with Edit popup (local spelling with Google list, caste); + Add surname popup
- [x] Surnames page compact: one line per surname, Edit / Add in a small popup (local spelling with Google list, caste)
- [x] Fundraise create/edit Details card grouped (name · target & place · dates · description); member add/edit grouped into parts (Name, About them, Contact & place, Caste, Blood, Work & education, Other contact, About)
- [x] Example placeholders on name/title fields ("e.g. Ramesh" / "ઉદા. રમેશ")
- [x] Blood → Donors: current city (column + filter) instead of native village
- [x] /members/new looks like /members/ID/edit: same tabs, one form, one Save (jumps to the tab with an error)
- [x] Content area background #f5f6fa; grouped field titles (Name, About them, Contact & place …) with an icon
- [x] Fundraise/Mandal form: picture-left (top) / parts-right Details; Target / Opening balance on a separate Finance card
- [x] Settings → General / Fundraise: fields grouped with icons (Samaj, Sign-up, Language & time / Sharing, Expenses)
- [x] Lighter placeholder colour (#b3b8c2) app-wide
- [x] Invite by phone: "Full name in English", note "your name, father's name, surname — separated by spaces", example placeholder
- [x] Fix: new group members were left out of "Everyone" meetings until someone opened the Meetings tab — now invited at once (group add / invite / bulk / team / Mandal); fixed getMeta misuse in Mandal (everyone-sync, archived lock)
- [x] Mandal: "Latest Mandal" strip with Record money for the newest schedule; per-member unpaid schedules (last 3 with dates, +N older) in the sheet and members list
- [x] Samaj name (Settings → General) as the app name everywhere: tab titles, print header, push titles (Parivar only as fallback)
- [x] Any member can view anyone's family tree (no more 404); birth date, phone and marital status only for the family
- [x] Filters: no loose Clear button in toolbars; Clear only in the filter popup
- [x] Clear discussion history moved from the Discussion tab to the About tab's Danger zone (group + fundraise/Mandal), with a sentence and confirmation; Mandal public-link card shown again
- [x] Fundraise / Mandal Danger zone on About (admins): clear discussion, pause ⇄ resume (read-only discussion), archive ⇄ restore
- [x] Clear history: only app super admin / administrator / sub-admin, in the Danger zone (not group / fundraise admins)
- [x] Shared 300 ms debounce hook for search / suggestion fields (list search-as-you-type, member pickers, Gujarati suggestions)
- [x] Surnames page visible to everyone (edit only administrators); "Members" button per surname (disabled when ≤ 1); Members list ?surname= filter
- [x] DB pool 2 → 5 per instance (parallel page queries no longer queue), explicit waitForConnections / queueLimit 0, slow-query log; not 100 (host limits)
- [x] Eye button (show / hide) on every password field — login, register, set password, change password, member password
- [x] Filters button icon-only on phones (all pages)
- [x] Fundraise Danger zone: "Clear edit history" — app super admin / administrator / sub-admin only
- [x] Danger zone cards: solid red header; clear discussion = app admins / sub-admins + the group's / fundraise's admins and sub-admins (sub-admins see only that row); edit history = app admins / sub-admins only
- [x] Top loading line (Samaj logo colour) for every page load / save / action over 150 ms
- [x] Delete member (super admin / administrator only) in the Members row ⋮ and the profile ⋮, with confirmation
- [x] Phone bottom bar: Family tree (own) instead of Blood
- [x] Family tree opens centred on the active person
- [x] Fix: tapping a menu item / button on a page left open across a deploy showed 'Something went wrong' (stale server action) — now reloads once by itself
- [x] Fix: fundraise discussion clear only for app admins / sub-admins and the fundraise's own team admins (not group sub-admins)
- [x] Settings memoised 60 s per instance (cleared on save) — most requests skip the settings query
- [x] Error screen shows the short error and reports it to the server log ([client error]) for diagnosis
- [x] Speed: read-mostly lists cached 60 s per instance (castes, groups, villages, cities, places, audience) with forget() on writes; fundraise / group / member / members pages load their queries in parallel
- [x] Surnames: Members button enabled from 1 member (disabled only at 0)
- [x] Fix: notifications ⋮ crashed (React #306 — server-rendered icon elements, repeated Trash2); page menus take icon names now
- [x] Calendar: Filters button at the right end of the month row on phones
- [x] Relation view: generation indent 26 → 15 px (gentler joint curves)
- [x] Fundraise team: several roles per person (ticks), new Expenser role; treasurer / collector record contributions, expenser records expenses (each change in History)
- [x] Expenses: "Paid by" (default: the recorder, from the team / group) + "Treasurer has paid them back" switch (default off); shown in the list and History
- [x] Expense Paid by: type-to-search
- [x] Expense form: What + Where in one row; Paid by / repaid after Notes
- [x] Contributions: "Hide name publicly" beside the name; two-word name note + check; "Kept by" + "Handed over to the treasurer" (default on for treasurer / admin, off for collector)
- [x] Fix: Kept by / Paid by list spilled over the dialog footer and hid the switch — now opens in the flow; switch top-aligned
- [x] Contribution: Anonymous switch inside the name box
- [x] Combobox list in dialogs scrolls fully into view; dialog footer flush to the bottom; amount fields are number inputs everywhere
- [x] Search lists in pop-ups float on their own layer (fixed, under / above the box), never clipped and never pushing the form
- [x] Money forms in parts (Contributor / Details · Amount · Holding) with placeholders for What, Where, Notes, Reference
- [x] Add family member: title shows whose relative and which ("Add Mother of …")
- [x] Members: Bulk edit (app admins / sub-admins) — status, role, village, city, caste, blood group, donor for all ticked, via add/remove change rows
- [x] Bulk edit rows restyled: headings, plain rows, outlined × and + Add a change
- [x] Optional fields: "(optional)" in the label, no hint line (target, reference, category, bill no.)
- [x] All hints / notes / short descriptions cut to 5-6 words (up to 8-10 where needed) (en + gu); optional end date, relative phone, new-member password say (optional) in the label
- [x] Copy list / Copy all: unpaid contributors marked "(pending)" after the name, plus a Pending total line
- [x] Print / PDF "By contributor": people with ₹0 paid (pending only) left out; Contributions still lists pending entries
- [x] Fundraise About: Holdings card under Team — who holds money not handed over, who is owed for expenses (all viewers)
- [x] Danger zone rows: full explaining sentences (up to ~20 words), en + gu
- [x] Holdings: Income / Expense switch, amount per person, treasurer (else admin / creator) holds handed-over money
- [x] Fundraise History collapsible (closed by default); on phones it sits just before the Danger zone
- [x] Relation chain: distant relatives tagged (Kaka / Dadi / Sister … (distant), gu કુટુંબી); indent 15 → 10px
- [x] Relation: father's wife (no direct mother link) shows as Mother; spouse's child as Son / Daughter
- [x] Members ⋮ menu: separator between Invite by phone and Castes (PageMenu item groups)
