---
name: parivar-dev
description: Development conventions for the Parivar app — Next.js 16 App Router (JavaScript), server actions, roles and access helpers, i18n (en/gu), invites, notifications, verification and git/deploy routine. Use before writing or changing any code in this repo, when adding a feature to members/groups/fundraise/blood/calendar/settings, and when the user says to apply some logic "in multiple places" (then update this skill too).
---

# Parivar — development conventions

**Keep this file current.** When the user asks for a behaviour to be applied across several places,
implement it and record the rule here (or in parivar-design / parivar-db).

## Stack facts that bite

- Next 16: `params`, `searchParams`, `cookies()` are async. `proxy.js` (not middleware). Read
  `node_modules/next/dist/docs/` before unfamiliar APIs (AGENTS.md).
- JavaScript only, Tailwind v4 (`bg-linear-to-b`, `size-*`, `!` suffix for important).
- Lint: `npx eslint src --quiet` must be clean (react-hooks rules: no setState in effects, no mutating
  context values, no Math.random in render — use lazy `useState`).
- **Never run `next build` while the dev server runs**, and after a build **delete `.next` before
  restarting dev** — otherwise dev serves 404s for every uncached route or Turbopack panics.
- Windows + Git Bash: shell quoting breaks on `'`, `$`, backticks in heredocs/`node -e`. Write edit
  scripts with the Write tool into the scratchpad (`rep(file, old, new)` that **throws when the anchor is
  missing**) and run them with node. Never let an insert fall back to index −1.
- The repo has **no Prettier config**; if you run Prettier use
  `--single-quote --tab-width 4 --print-width 160` on the touched file only, or it rewrites the whole file.
- **Testing on a real phone** (dev at `http://192.168.x.x:3000`): Next 16 blocks dev JS for hosts other than
  localhost unless listed in `allowedDevOrigins` (next.config.mjs has the private LAN ranges). Symptom:
  the page renders but no menu, popup or drawer opens. Keep that list when touching the config.
- **Vercel region = `bom1` (Mumbai)** in vercel.json — the live DB is Hostinger Mumbai; the default iad1 made
  every query ~200 ms (pages 2–5 s). Keep functions next to the DB.
- **Vercel / serverless**: no runtime writes to disk (store generated files in the DB — see app icons);
  no long-lived timers (instrumentation skips the reminder loop when `VERCEL` is set). **Hobby plan = daily
  crons only** (`vercel.json`: `0 3 * * *`; a more frequent schedule fails the deploy). Reminders also run via
  `kickReminders()` in the (app) layout — `after()` a signed-in page, once a minute per instance; an external
  scheduler may hit `/api/cron/reminders?key=…`. DB pool 3 on Vercel.
- **No page zoom / drift on phones**: html/body have `touch-action: pan-x pan-y` + `overscroll-behavior: none`, the viewport
  sets maximumScale 1 / userScalable false. Anything wide must scroll in its own box (TableShell: overflow-x-auto +
  overscroll-x-contain). A widget needing pinch (family tree) sets `touch-none` and handles gestures itself.
- **Before-JS (lazy load)**: what a phone user taps first should work before hydration where cheap —
  the mobile drawer is a CSS checkbox (`#nav-drawer`; labels open/close it). Links are plain `<Link>`s.
  Popovers and dialogs need JS; do not add pre-hydration hacks for them.

## Server actions

- Contract: `(prev, fd) => { ok: true, message, vars?, id? } | { error } | { fieldErrors: { field: key } }`,
  all messages are i18n keys. Client forms submit with `onSubmit` + `startTransition(() => action(fd))`
  (a `<form action>` resets uncontrolled fields).
- Re-check permission inside every action; never trust hidden inputs. `FORBIDDEN = { error: 'common.forbidden' }`.
- After writes: `revalidatePath(...)` / `refreshCampaign(id)`; audit with `audit(actorId, action, entity, id, detail)`.
- Server actions can be passed to client components (e.g. `PageMenu` items, `.bind(null, id)`).

## Roles and access

- App roles (lib/roles.js): `super_admin > administrator > sub_admin > sabhyo` (shown as "Member").
- **"Alert everyone" (discussion bell, `chatAccess().canAlert`) is admins and sub-admins only**: app-level
  sub_admin+, a group's admin / sub-admin, a fundraise's own admin, admin / sub-admin of a group the
  fundraise is shown in (`isLeaderOfFundraiseGroup`). Never members, speakers, or organizer / treasurer /
  collector / volunteer. The action re-checks it (`alert && access.canAlert`).
  Capabilities are functions (`canManageMembers`, `canManageGroups`, `canManageSettings`,
  `canInviteMembers`, `canResetPassword`, `canManageAllFundraises`, `canViewAudit`) — add new ones there.
- Group roles (lib/group-roles.js, pure): `admin, sub_admin, speaker, member`; "standing" = app | admin |
  sub_admin | null. Use `canActOnRole`, `canEditDetails`, `canManageMembership`, `canPostIn`.
  Sub-admins never act on admins/sub-admins.
- Fundraise: `fundraisePermissions(user, campaign)` → manage / contribution / expense / post / teamRole.
  Admins & sub-admins of any linked group (`fundraise_groups`) start fundraises; standalone (no group)
  only for fundraise managers. Delete only when archived.
- Private groups are invisible (notFound) to non-members.

## Cross-cutting features to reuse

- **Removing someone from a group / team / Mandal NEVER deletes their account** (users_list row). There is no
  "also delete the unused account" option any more: a never-signed-in invitee may also be a family-tree relative
  or a listed member, and deleting the row wiped them from Members and Family (Oct 2026). Deleting a person is
  only ever an explicit action on the Members page.
- **Invites** (lib/invite.js `ensureInvitedUser`): phone → existing / enabled / created; first password =
  phone, `must_change_password` meta forces `/set-password`, then own details. Use for group add, member
  invite, relation add, contribution "Invite <number>".
- **Notifications**: `notify` / `notifyMany({type,data,link,actorId})` — also sends web push. New type →
  key `notifications.types.<type with . → _>` in both dictionaries; data fields `title/title_local`,
  `group/group_local`, `name` are localised by `notificationText`.
  - Each type maps to a **category** by prefix (lib/notification-prefs.js `categoryOf`); people switch
    categories off in Settings → Notifications (`users_listmeta.notify_off`), and `notifyMany` skips them
    (no notice, no push). New type prefix → add it to the map and a label under `settings.notify.categories`.
  - Push (lib/push.js): title = the source (`data.title` / `data.group`, local spelling for non-English
    readers), else the app name; icon/badge = the Samaj logo via `/api/app-icon` (public/sw.js).
- **System chat notes**: `postSystemMessage` / `postMemberNote` (meeting scheduled, member added/removed).
- **Names**: `composeName` / `splitName` (lib/names.js); full_name / full_name_local are the joins.
- **Timezone**: `todayLocal()` (admin setting, default IST); DB pool follows the offset.
- **Pictures**: `sanitizeAvatar` server-side; `GroupAvatar` / `SamajLogo` to render.
- **Settings**: add keys to `SETTINGS` in lib/settings.js (`hidden: true` for keys with custom UI). App-wide
  notify switches live in Settings → Samaj → **Alerts** (`?section=alerts`, `saveAdminNotify`), not in their
  module's section nor in the personal Notifications section.
- **Fundraise audience = who sees it** (lib/fundraise.js `AUDIENCE_OK` / `audienceFilter(user)` / `canSeeCampaign`):
  no rows → everyone; rows → only matching members, unless meta `audience_others = '1'` ("also everyone else,
  lower in their list"). Team, admins / sub-admins of its groups and app-level managers always see it. Applied
  to the feed, a group's Fundraises tab, the detail page and print. Matching rows still sort first (for_you).
- **Family tree** (lib/family.js, actions/family.js, profile Family card + /members/[id]/tree — no Family page): relatives are ordinary
  users_list rows (may have **no phone** → no login; with a phone → login, password = phone, must change);
  they show in the Members list (late = status 'deceased', label "Late"). Links in users_relations: child→father /
  mother, spouse (both ways), sibling (both ways, only without a shared parent). Slots: father, mother, spouse
  (wife/husband by gender), brother, sister, son, daughter; gender follows the slot. `linkRelative` keeps it
  consistent (father ⇄ mother spouses, siblings share parents, a child gets the only spouse as other parent,
  spouses → married). **Who sees / edits**: `canSeeFamily` = self, member managers, whoever added the person, or
  anyone connected in the tree (`familyIds`: all links read in ONE query per request (`allLinks`, React cache), walked in
  memory — never one query per generation; that queued requests with 4+ users). Children (tree, Family card) and siblings are
  ordered by `byAge`: eldest first, left to right, among those with a birth date; people without one keep their added order.
  The tree opens centred on the person whose tree it is (their tile, aria-current, scrolled to the middle).
  Tree page switches: "Married daughters" (on by default; off hides every married daughter — married/widowed/divorced or
  with a husband — and her branch, in every chain, except the person whose tree it is) and "Details". Tree-added people (meta added_via='family')
  hide phone / dob / marital status from others (profile, Members list, member search). Male-line picker
  (father / brother / son) searches the person's surname only (`/api/members/search?surname=…&family=1`).
  Whoever added a relative who never signed in may edit them (`canEditUser` — the target row must carry
  created_by + last_login_at). Member edit → Basic has marital status; for a relative without a phone, phone and
  father's name are optional there. Adding a number to someone with no login (Basic tab) turns the login on
  (password = number, must change) — `members.loginEnabled`; the profile shows "Cannot sign in yet" to editors.
- **Matrimony** (lib/matrimony.js, actions/matrimony.js, /matrimony, /matrimony/[id], /[id]/edit): opt-in rows in
  matrimony_profiles for **alive, unmarried (or unset), 18+ with a dob** members (`ELIGIBLE`); a listing drops off by
  itself when that stops being true. List / edit / remove (`canListFor`): the person, their **father or mother**,
  member managers — and, **only when the father is marked late**, anyone in their family tree (guardian). No father
  recorded = strict. **Browse rule = `canBrowseMatrimony` only** (for now: member managers + families with a listed
  profile — the user will decide; change it there). Profile shows basics, education & work (users_listmeta
  education / occupation), family names from the tree, preferences, about, and a family contact (default: father
  with a phone, else the person). No photos yet (no upload storage).
- **Married women — two names** (users_list maiden_* columns; lib/names.js `isMarriedWoman`, `birthName`): a married /
  widowed / divorced woman's MAIN name = first + husband's name (middle) + in-laws' surname; her maiden parts (father's name +
  father's surname, en + local) sit in maiden_*. Forms show 4 parts for her (member edit Basic: gender + marital drive it;
  add-relative popup: wife / mother default married, daughter / sister switch when Married is chosen; parts pre-filled from
  the person). Shown: married name by default + "Maiden name: …" on her profile; maiden name in her father's family (Family
  card daughter / sister rows, tree hover when she is a blood node, relation chain reached via 'daughter' / 'sister').
  `fillFatherNames` fills her maiden_* from her father and an empty husband part from her husband — never her main middle
  from her father. Live backfilled 2026-10-02.
- **Family tree page** (/members/[id]/tree) is open to every signed-in member (links on profile, Family card, row menu).
  Without `canSeeFamily` the nodes lose dob, phone and marital_status (privacy); editing / adding relatives still needs it.
- **Error screen** (app/(app)/error.js): shows the digest / short message and POSTs it to /api/client-error, which logs
  "[client error] user=… path=… message=…" (Vercel → Logs). Ask the user for that line, or read the log, before guessing.
- **Stale server actions after a deploy**: a page open across a deploy calls OLD action ids → Next throws
  UnrecognizedActionError. app/(app)/error.js detects it (`unstable_isUnrecognizedActionError`) and reloads the page once
  (sessionStorage guard, 30 s) instead of showing "Something went wrong".
- **Speed — parallel queries**: in pages and actions, never await independent DB calls one after another. Load the user
  and the main record together, then everything that needs only the id in ONE Promise.all (start background pieces as
  promises and await them after the tab's data). Fundraise / group / member pages follow this.
- **Debounce**: every search / suggestion field that reacts to typing goes through `useDebouncedCallback`
  (components/ui/use-debounce.js, DEBOUNCE_MS = 300): list search boxes (search as you type; Enter still immediate),
  Combobox / member pickers, Google local-script suggestions. Never a hand-made setTimeout for this.
- **Clear fundraise edit history** (fundraise_history): same rule — `canClearHistory(role)`, action `clearCampaignHistory`,
  a row in the fundraise Danger zone; the ledger stays.
- **Clear discussion history** (chatAccess.canClear): app admins / sub-admins (`canClearChats`) + a group's admins and
  sub-admins / for a fundraise or Mandal ONLY its own team admins (teamRole admin) — a group admin / sub-admin of its
  group gets nothing on the fundraise unless on its team. A group sub-admin sees the
  Danger zone card with only that row; pause / archive / status rows stay admin-only (`canManage`).
- **Fundraise team roles** (fundraise_members, one row PER ROLE — PK campaign + user + role): a person can hold several
  (admin, organizer, treasurer, collector, expenser, volunteer). `fundraiseTeamRoles` → perms.teamRoles (rank order),
  perms.teamRole = main one. Rights add up: manage = admin; contribution = treasurer / collector (add, edit, delete,
  mark paid); expense = expenser. Team card: role chips, ⋮ Edit roles (ticks), Add with ticks (saveTeamMember sets the set).
  Every ledger change is in fundraise_history (who); role changes in the audit log (added / removed).
- **Copy list / Copy all** (money tab → /api/fundraise/[id]/ledger → lib/ledger-text.js): every contribution, unpaid ones
  too with "(pending)" after the name; Total counts paid only, then a "Pending ₹…" line when any; anonymous stays hidden.
- **Holdings card** (About tab under Team, everyone who sees the fundraise; not on a Mandal), listHoldings(campaign):
  Income / Expense switch in the header. Treasurer = team's first treasurer, else first admin, else creator.
  Income = received contributions by who holds them: keeper until handed over; handed-over and keeper-less ones →
  treasurer (sums to collected; treasurer row shows "₹… handed over by others"). Expense = expenses by payer (no
  paid_by → treasurer), with "To get back" for not-repaid ones paid by someone else (sums to spent). Totals row.
- **Fundraise History** (About): native <details>, collapsed by default; below lg the two columns are `contents` and
  History is ordered just before the Danger zone (max-lg:order-1 / -2).
- **"By contributor"** — money tab view AND Statement (print / PDF / public page): only people with paid > 0,
  entries = paid entries (contributorTotals.paid_entries). The Contributions table still lists every entry, pending in red.
- **Mark as paid** (pending pledge → row ⋮, `markContributionPaid`): popup in parts — Amount (mode, date)
  and Holding (`KeptBy` from contribution-dialog: kept by, default the marker; handed over, default on for treasurer /
  admin). Saves kept_by + handed_over with mode / date; a pending pledge never has a keeper.
- **Expense paid by** (fundraise_expensesmeta paid_by = user id, repaid = '1'): the expense form's "Paid by" (searchable Combobox filtering fundraisePeople in the browser —
  team + group members + Mandal members, default = the recorder) and a "Treasurer has paid them back" switch (default off).
  The list shows "Paid by X" + Repaid / To repay; both are in the expense snapshot, so History shows changes.
- **Contribution kept by** (fundraise_contributions.kept_by, handed_over): "Kept by" (searchable, default = the recorder) +
  "Handed over to the treasurer" (default ON for a treasurer / admin recording it, OFF for a collector); none for a pledge
  (mode unpaid). List shows "Kept by X" + With treasurer / Not handed over; both in the snapshot → History.
  Donor name: at least two words on new names (first [father's] surname), the "Anonymous" switch sits INSIDE the name box on its right (title = "Hide name publicly").
- **Add family member dialog** title names the person and, once picked, the relation: "Add Mother of <name>" (family.addKindOf /
  addTitleOf, the person's local name for gu/hi).
- **Fundraise Danger zone** (About tab, FundraiseDangerCard; its admins = fundraisePermissions.manage): clear discussion (app admins only),
  pause ⇄ resume (`setCampaignStatus` closed ⇄ active — discussion read-only via chatAccess.paused), archive ⇄ restore
  (`setCampaignArchived`, no longer app-level only). Group: GroupDangerCard also holds "Clear history".
- **App name = the Samaj name** (Settings → General): `samajName(general, locale)` (lib/settings) everywhere the app names
  itself — browser tab titles (root generateMetadata), sidebar, login / public / print headers, push titles, manifest.
  `t('app.name')` ("Parivar") is only the fallback when no Samaj name is set; never hard-code "Parivar" in UI text.
- **"Everyone" meetings** (events_listmeta audience 'all'): people who join are invited AT ONCE — `syncGroupJoin(groupId)`
  after any group add (pick, phone invite, bulk add; also fills "everyone" Mandals of that group), `syncEveryoneMeetings`
  after a fundraise team add or a Mandal member add — plus the lazy sync on meeting lists and reminders.
  NEVER add anyone to a "selected" (Choose people) meeting — or one with no saved audience — automatically: only an
  edit by a manager changes that list. Every sync path must filter on audience = 'all'.
  `getMeta(base, id)` returns ALL keys as an object (no key argument) — read `(await getMeta(…)).key`.
- **Blood donors** (lib/blood.js listDonors, /blood?tab=donors): show and filter by CURRENT city (`?city=`), not native
  village — donors are needed where people live now.
- **Members list → groups**: the row ⋮ and the bulk bar only "Add to group" (as member; assignToGroup /
  bulkAssignToGroup force member_role = member). Group admins are made ONLY inside the group (its Members tab).
- **Bulk edit members** (Members bulk bar → Bulk edit, `bulkEditMembers`, app admins / sub-admins = canManageMembers): rows of
  "what to change ▾ / value / ×" (+ Add a change; each field once): status, role, native village, current city, caste → sub-caste,
  blood group, donor. Per person: canEditUser, role only via canChangeRole, never own role / status, non-active → sessions revoked;
  audited user.bulk_edit; forget('places','castes').
- **Delete member** (`deleteMember`, `canDeleteMember`): super admin / administrator only (never sub-admin), never
  themselves; an administrator cannot delete an administrator / super admin. In the Members row ⋮ and the profile ⋮ (red,
  last, confirm). Hard delete: FK cascades remove memberships, relations, roles, Mandal marks, sessions; contributions
  keep donor_name (user_id → NULL), chat messages stay without author. Audited (user.delete).
- **Surname → caste** (lib/surnames.js, actions/surnames.js, /members/surnames via Members ⋮ — visible to EVERYONE;
  add / edit / tick-assign only for administrators, `canEdit`; each row has "Members" (→ /members?surname=…&status=all&reg=all,
  disabled only when 0 members) before Edit; Members list filters by `surname`): list = every surname in use
  + saved ones, shown COMPACT (name · local · members · caste → sub-caste, Edit button); add / edit happen in a small
  popup (SurnameDialog: local spelling with Google's list + caste); one or many (tick boxes) mapped to caste → sub-caste. `applySurnameCastes(ids?, q?)` fills members WITHOUT a
  caste — called on admin create, invite (ensureInvitedUser), register, family link (after fillCastes) and surname edit.
- **Caste follows the family**: `fillCastes(q)` (lib/family.js) after every family link — anyone without a caste takes caste +
  sub-caste from father → husband (married woman) → spouse → mother → brother / sister → son / daughter, repeated until stable;
  never overwrites a set caste. Live backfilled 2026-10-02.
- **Father's name follows the father**: `fillFatherNames(q, ids)` (lib/family.js) runs after every family link — an EMPTY
  middle_name (+ _local) of a child is filled from the linked father's first name and full_name(_local) rebuilt; typed
  middle names are never overwritten. Live data was backfilled once (2026-10-02).
- **Kinship** (lib/kinship.js, pure): steps father | mother | son | daughter | husband | wife | brother | sister;
  `KIN_TERMS` maps a path ('father.sister.husband' → 'fuva') to `kin.terms.*`. lib/family.js `relationPath(from, to)`
  (shortest chain, BFS over parents / children / spouses / siblings incl. shared-parent siblings) and
  `relationStepsFrom(root)` (labels for the tree). Add new names to KIN_TERMS + both dictionaries.
- **Members list default = registered only** (`last_login_at IS NOT NULL`); the Filters panel's Registration
  select (`reg=unregistered|all`) shows the rest (invited / family-tree people). Counts as an active filter.
- **Meeting audience**: saved as events_listmeta `audience` = 'all' | 'selected'. 'all' = everyone, **including people who
  join later**: `syncEveryoneMeetings` (lib/meetings.js) adds current group / fundraise members to upcoming 'all' meetings when a
  meeting list opens and before reminders are sent. 'selected' stays a fixed list.
- **Mandal (savings circle)** — a fundraise with `kind = 'mandal'` (started from the group page "+ New ▾" menu → /fundraise/new?group=X&kind=mandal; fixed after).
  A Mandal is its group's own: the form shows its home group only (no other groups, no "Add to group") and no audience (server forces both);
  the public link works as for any fundraise;
  seen only by its group's members, its members and team (AUDIENCE_OK) — in its group's list and in the /fundraise
  feed, both with a "Mandal" badge. Its pending
  (summary) = members' dues.
  lib/mandal.js + actions/mandal.js + components/mandal/*. Same tabs as a fundraise (Discussion, Money, Meetings,
  About — team roles + history included); the Mandal part (members, Schedules with the money sheet, who has the money)
  sits at the top of About (?tab=mandal → About). No place of its own (per schedule). On its group's Fundraises list an
  active Mandal (not archived/closed, not past end date) is pinned on top (groupFundraises `pinned`). Sheet payments
  write fundraise_history (add / edit / delete) like ledger entries. Members =
  fundraise_subscribers, chosen on the form like a meeting's attendees (PeopleChoice: meta members_mode 'all' = whole
  group, kept in sync by syncMandalMembers; 'selected' = chosen people) and/or added on the tab (added by admins / sub-admins / its treasurer / collector — `canRunMandal`; pick or invite by phone).
  Meetings = the fundraise's own meetings, inviting its members — everyone or chosen ones (FUNDRAISE_PEOPLE in
  lib/meetings; dues and the sheet count only the members a meeting is for, `isFor`); per meeting meta collect ('1'/'0') + installment (default = campaign meta
  installment). "Attendance & money" sheet → fundraise_mandal_marks (present, paid) + a contribution per payment in the chosen mode (cash / UPI / bank / cheque / other) (so the
  ledger / totals include it). Dues = installments of collecting meetings held since joining − paid; missed = absent marks
  since last present (+ days away). Opening balance = one "Opening balance" contribution (meta opening_contribution_id).
  Mandal form: no target, no amount-per-meeting (amount is per schedule), place = plain text (never a suggestion —
  knownLocations skips Mandals); right column: Who is in it, Sharing, Schedules (SchedulesEditor: rows in state,
  posted with the form as sch_*; writeMandalSchedules creates / updates / archives / deletes-if-no-money).
  Schedules (also on the Mandal tab, right card, with the money sheet): each = a Mandal meeting "<date> - Mandal" (saveMandalSchedule: date, place,
  installment, meta held_by = who keeps that day's money; audience 'all'). Kebab: Edit; Archive (meta archived '1',
  money in — sheet locked) or Delete (only while nothing received); archived → Restore. Income per schedule, expenses
  common (Money tab); "Who has the money" = schedule collections summed per held_by, minus common expenses = balance.
  Income = the schedule's "Attendance & money" sheet → contributions (Money tab, print, history). A "Latest Mandal" strip
  on top opens the sheet of the newest non-archived schedule. Pending per member: `unpaidBySchedule` (payments clear the
  oldest dues first) → PendingList shows the last 3 unpaid schedules with dates (+N older), in the sheet and members list.
- **Discussion moderation** (`chatAccess`): delete others' messages = admins + sub-admins (group standing; fundraise
  manage or sub-admin of its groups); **Clear history** (`clearChat`, `canClear`) = admins only (group admin / app-level;
  fundraise manage) — deletes all messages + read markers for good, audited.
- **Anonymous gifts** ("Hide name publicly"): only fundraise managers see the donor (name + badge). Everyone
  else sees `fundraise.anonymousLabel` — "Anonymous" / "રામભરોસે" — via `maskAnonymous(rows, label)`, and
  by-contributor totals use `contributorTotals(id, { publicView: !manage })`. Copied text, the PDF list and
  public pages always show the label.
- **Group status** (`admin_groups.status`, `GROUP_STATUSES`): active · inactive (listed, discussion read-only:
  `chatAccess` returns `canPost:false, paused:true`) · archived (hidden: lists use `status <> 'archived'` except
  for app-level managers / that group's admins; the page 404s for others). `setGroupStatus` = canAdminister;
  `deleteGroup` = archived + app-level, refused while it is a fundraise's home group; deletes its meetings and chat.
  New group pickers (fundraise / events / members) list `status = 'active'` only.
- **App icons** (lib/app-icons.js): Samaj logo PNGs drawn in the browser, stored base64 in
  `admin_settings.app_icon_<size>`; `getSettings` skips `app_icon_%` rows; `logo_version` busts caches.
  Manifest, favicon and apple-touch icon all use `/api/app-icon`. The built-in `favicon.ico` lives in
  `public/` (the no-logo fallback) — never `src/app/favicon.ico`, which Next links on every page.
- **Manifest** (src/app/manifest.js): static + `revalidate = 3600` (no `connection()`) — the browser fetches it on every
  page, so it must be a cache hit, not a function + DB read. Saving Settings → General calls
  revalidatePath('/manifest.webmanifest') so a new Samaj name / logo shows at once. Browser keeps it a day
  (next.config headers). Favicon `/favicon.ico` and unversioned `/api/app-icon` (+ its fallback redirect): 7 days;
  `/api/app-icon?v=…`: a year, immutable.
- **No loading.js — ever** (user's choice: no loading screens on navigation). Speed comes from
  `BackgroundPrefetch` (components/shell, in AppShell): once per app load, on idle, router.prefetch of the main menu
  pages + /notifications + /calendar (not the audit log), 300ms apart, skipped on Data Saver / 2G. Prefetched pages
  live `experimental.staleTimes.static = 180`s; a save (revalidatePath) drops them. New main sections are prefetched
  automatically from the nav `sections`.

## i18n

Full rules and the Gujarati glossary: the **parivar-i18n** skill.

- Dictionaries `src/lib/i18n/dictionaries/{en,gu}.js`; **parity must stay exact** — verify with a
  node script comparing key paths after every change.
- `useT()` client / `getT()` server → `{ t, locale, localLang }`. `localized(row, field, locale)`.
- Plurals: `{ one, other }` + `vars.count`. Dotted notification types use `_` in keys.

## Verification before saying "done"

1. `npx eslint src --quiet` clean; en/gu parity clean.
2. Render-check changed routes on the dev server as super admin with a **temporary session**
   (`users_sessions` row, `user_agent='node'`, expiry `INTERVAL 1 DAY` because the probe connection is
   UTC while the app is IST) and **delete it in a finally block with a fresh connection**.
3. Never click through in Chrome (user preference); say plainly what was not exercised.
4. Production build only when pushing (dev stopped first).

## Git / push routine (only when the user says "git push")

Stop dev → free port 3000 (kill leftover `next start-server` for this repo) → lint → `npm run build` →
`git add -A` → check no `.env`, no `public/app-icons/`, no `scripts/_*` staged, grep staged diff for
`DB_PASSWORD|SEED_ADMIN_PASSWORD|DB_HOST|VAPID_PRIVATE_KEY|CRON_SECRET` → commit (attribution line from
the session reminder) → push `origin main` → delete `.next` → restart `npm run dev` → check /login 200.

## Keep TODO.md

Append `- [x] …` for every delivered request; pending items stay `- [ ]`.

## Maintaining the skills

The project skills live in `.claude/skills/` (parivar-design, parivar-dev, parivar-db, parivar-i18n).
They are **meant to change**: whenever the logic, a rule, a component or a convention changes —
especially when the user says "apply this like this" for several places — edit the matching SKILL.md
in the same piece of work (add the rule, fix what is now wrong, drop what no longer applies), and say so
in the reply. Code and skills must never disagree.
