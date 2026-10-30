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
  scheduler may hit `/api/cron/reminders?key=…`. DB pool 5 per instance (parivar-db).
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
- **Group team roles** (admin_group_team, one row per role, like a fundraise team): `GROUP_TEAM_ROLES` =
  members · fundraise · meetings · details · discussion, set in the group's Team card (About) by its leaders —
  `saveGroupTeam` (roles[]: admin / sub_admin set member_role and clear tasks; otherwise tasks, a former leader becomes a
  member; a non-member joins as member) and `removeFromGroupTeam` (leader → member, tasks cleared). Admin / sub-admin
  changes follow `canActOnRole` (admins); tasks `canSetTeam`. `teamOf(members)` (group-roles) = the team list. Leaders (app, admin, sub_admin — `isGroupLeader`) do
  everything; others by role: `groupCan(standing, team, task)`. `groupStanding()` returns `{ standing, myRole, team }`
  — pass `team` to canActOnRole / canManageMembership / canEditDetails / canPostIn. Meanings: members = add / edit /
  remove members & speakers (never admins / sub-admins); fundraise = start fundraisers in the group
  (`canCreateFundraiseIn`, pickers use `createFundraiseGroupIds`; drafts list stays leaders-only + your own drafts) and
  then edit only those (they are its team admin); meetings = schedule — edit / cancel only the meetings they scheduled
  (`meetingScope().moderate` = leaders, else `events_list.created_by`, checked in saveMeeting / cancelMeeting and the
  list's Edit / Cancel); details = edit the group; discussion = always may post.
- **Danger zones**: group — its leaders only (status: admins; delete: app-level). Fundraise — `fundraisePermissions().danger`
  = app-level or a leader of a group it is shown in (NOT its creator / team admins, who only edit it); setCampaignStatus /
  setCampaignArchived use `authorize(id, 'danger')`. A Mandal keeps danger = manage (run by its own team).
  Decided (user, Oct 2026): a group's creator gets NO danger rights unless they are a leader — keep it leaders only.
- **Group team = members first**: saveGroupTeam refuses someone not in admin_group_members (groups.errors.memberFirst)
  — it never adds them to the group any more; "Add to team" picks only from the group's members not on the team
  (AddGroupTeamButton `candidates`, local Combobox). Outsiders are added on the Members tab first.
- **Contact numbers — the one rule**: women see EVERY number; men see every man's; the only limit is a man seeing a
  woman's number (Settings → Permissions → Women's contact numbers; `seesAllNumbers(viewer)` = woman or sub-admin+).
  Where someone was added from (family tree) never hides contact details (mobile, alternate, email) — only birth date
  and marital status stay family-only. Lists / search / donors / group members: a woman's number for women + admins
  (hideWomenPhones; search also won't match her number for men). getCurrentUser carries `gender`.
- **Women's contact numbers** (lib/contact-privacy.js; Settings → Permissions → "Women's contact numbers", admin
  multi settings female_phone_viewers = WHO: women · same_surname (hers or her maiden surname) · close (≤ 5 steps) ·
  married · over35 · same_village · same_city · everyone; female_phone_shown = WHOSE: over30 · married · daughter /
  sister / aunt in the viewer's family (≤ 5 steps, from the viewer → her steps) · everyone). Shown when viewer AND she
  match. Always: admins (sub-admin+) see all, an admin woman's number shows, everyone sees their own. canSeeContact
  gates the PROFILE (Call / WhatsApp, Mobile, Alternate mobile). LISTS show a woman's number to admins only:
  hideWomenPhones (group members, blood donors — stripped server-side), Members list phoneShown + phone search
  (f.phoneWomen). Defaults everyone / everyone. Privacy policy (lib/legal.js) says so.
- **Phone numbers, any country** (lib/phone.js): stored Indian = 10 digits (unchanged), any other = "+<code><number>"
  (the "+" keeps e.g. +65 8… apart from an Indian 10-digit number); columns VARCHAR(16). normalizePhone reads "+…"/"00…"
  as international (+91 → 10 digits), no code = Indian, 11–15 bare digits = already with a code. formatPhone shows
  "+1 2025550123"; waNumber for wa.me; phonePassword = the digits (first password of a login made from a number — login
  also accepts it typed with "+"/spaces while must_change_password). Every phone box is components/ui/phone-input.jsx
  (+91 ▾ code picker over a hidden native select, posts ONE value under the field name) — login, register, member
  edit/new, add relative, change phone, blood contact, matrimony contact. Invite rows stay a plain box ("+1 …" works).
  Members' Country = users_listmeta `country` (COUNTRIES code, empty = India), Details → Other contact; profile shows it
  when abroad.
- **Login phone**: only its owner changes it (actions/profile.js, needs their password). Whoever added a relative may
  edit that relative's profile but never their mobile number once the relative signs in (decided, Oct 2026).
- **Settings → Permissions** (admin section, KeyRound): who-may-do-what settings of every module in ONE form —
  lib/settings.js PERMISSION_GROUPS [[admin, signup], [admin, members], [fundraise, sharing]]; fields post as
  `<module>.<key>` with module `*` (actions/settings.js saves each module in one transaction). General / Fundraise skip
  those groups (isPermissionGroup). A new permission setting: give it one of those groups (or add a pair).
- **Adding a phone to a relative who has none** (= a login): Settings → Permissions → Members, `relative_phone_by` (multi):
  admins (sub-admin+) · added_by (who added them; for a new relative the adder) · close (≤ 4 family steps from that
  relative, a new one counting one step past the person) · anyone (whoever may edit that family). Super admins always.
  lib/relative-phone.js `canAddRelativePhone` — checked in actions (members basic tab, family addRelative →
  members.phoneNotAllowed) and used to HIDE the phone box (edit page `member.canAddPhone`, AddRelativeDialog
  `canAddPhone`). Default: all four (as before).
- **Group history** (admin_group_history, lib/group-history.js `recordGroupHistory` — never throws): every group action
  writes one entry — edit (changed fields), status, member_add / member_remove, role, team, team_remove, and from
  fundraise actions (`recordFundraiseInGroups`) fundraise_create / fundraise_link / fundraise_unlink. Shown on the About
  tab (collapsed, like the fundraise History) to the group's admins + app-level managers only (`canAdminister`); its
  admins clear it (`clearGroupHistory`, danger zone). The app-wide admin_audit_log is separate and keeps its record.
  A NEW group action must record its history too.
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
  - **Push tokens** (users_push_subscriptions, one row per browser): ONE person per token — saving it from another
    account moves it (created_at restarts, last_used_at cleared); many tokens per person (each device). last_used_at =
    last notification that reached it. /api/push sets the `pv_push` cookie (endpoint hash); Log out unsubscribes the
    browser (lib/push-client disablePush) AND destroySession deletes that token server-side. createSession sets
    `pv_push_ask` → PushPrompt (shell) after a login ONLY: that person said yes on this device + browser allowed → on
    again silently; else, while this phone/browser has no notifications, the Allow / Not now card on any page at most
    once every 7 days (localStorage `pv-push-asked` = last shown) — a centred modal over a blurred page. A
    REMINDER (members list → red slashed bell → `remindPush`, users_listmeta `push_remind`) makes the next app open
    ask again regardless of the 7 days (`takePushReminder` deletes it and answers once; called only when this device
    has no subscription); when the browser has notifications blocked, the reminded pop-up explains how to unblock. The service worker is registered at idle on app open (warmServiceWorker) so Allow is quick; the card
    closes once the browser answers and the token saves behind it. Browser code: lib/push-client.js only.
  - **Performance**: notifyMany sends push in next/server `after()` (falls back to direct outside a request); /api/push's
    test push too. lib/push `deliver`: waves of 50 sends, then ONE UPDATE last_used_at + ONE DELETE of gone tokens
    (404/410) per batch — never a statement per device.
  - **Icons**: payload icon = /api/app-icon?size=192&v=, badge = /api/app-icon?badge=1&v= — a white silhouette of the
    logo's glyph on transparent (readAppBadge, sharp, cut from the saved 512 icon, cached per process). Android paints
    only the badge's shape; a coloured square would be a white box. The site name / URL line in a notification is the
    browser's: an installed app (WebAPK) shows the app name, a browser tab shows the domain — not settable from code.
  - Event notices (bell + push): fundraise.new / fundraise.mandal (on create, not drafts, to campaignViewerIds —
    the audience rules), fundraise.received / fundraise.pledged (the registered donor: contribution added, marked
    paid, paid at a Mandal meeting), fundraise.mandal_meeting / _collect (new Mandal schedule → its members),
    group.member / admin / sub_admin, group.removed, group.team (new task roles).
  - **Admin push** (Settings → Samaj → Push notification, administrators): Title, Description, Target (Everyone /
    Groups / Selected members) → `sendPushMessage` → lib/push `pushMessage` — push ONLY, no bell copy; only active
    people with a token. Profile: a green bell badge on the avatar's bottom-right (navy ring) when on (sub-admins and up only); ⋮ → Notification devices: each token, turned on / last notification, for administrators two tabs — Devices · Send notification (title + description; more than one device: All devices (default) or Choose → device_ids),
    remove. Members filter `?push=on|off` + the row-end square (before the home pin): green bell → PushDevicesDialog
    (`trigger` prop instead of `menuKey`), red BellOff (active + has a phone) → remind (components/members/member-push-cell). Member-level
    push (list bell + filter, profile bell, ⋮ → Notification devices, sending to one member): sub-admins and up
    (`canManageMemberPush`); everyone / groups sending: administrators (`canManageSettings`).
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
  anyone connected in the tree (`familyIds`, walked in memory over the **family map** — never one query per generation).
  **Family map** (lib/family `familyMap`): all users_relations rows + the gender of everyone linked, built once per
  server instance (lib/memo 'family:graph', `clone=false` — read-only, never mutate) → adjacency, parents, children,
  spouses, siblings. Every writer of links or members calls `forget('family')` (actions/family add/remove,
  actions/members); otherwise MEMO_TTL. familyIds, relationPath, relationStepsFrom, relativeTerms, the tree all use it. Children (tree, Family card) and siblings are
  ordered by `byAge`: eldest first, left to right, among those with a birth date; people without one keep their added order.
  The tree opens centred on the person whose tree it is (their tile, aria-current, scrolled to the middle).
  Tree page switches: "Married daughters" (OFF by default — only the viewed person stays if she is one; off hides every married daughter — married/widowed/divorced or
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
  recorded = strict. The "Your family" card uses `canListFor(..., { asFamily: true })` — family rules only, so a
  manager sees just their own family there. **Browse rule = `canBrowseMatrimony` only** (for now: member managers + families with a listed
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
- **Public routes** (no sign-in, proxy.js): /login, /register, /language, /p/[token] (+ /print), /privacy-policy, /install.
- **/install** (components/shell/install-app.jsx — a link to share): inside the installed app (display-mode standalone)
  → /; Android Chrome / Edge / desktop: the beforeinstallprompt "Install app" button (else the browser-menu steps);
  Android in-app browsers (WhatsApp …) → "Open in Chrome" intent link; iPhone Safari → the 3 Add-to-Home-Screen steps;
  other iOS browsers → open in Safari (copy link); already installed (getInstalledRelatedApps, manifest
  related_applications from VERCEL_PROJECT_PRODUCTION_URL) → "Open the app". Manifest: id / scope "/",
  launch_handler navigate-existing. Android opens in-scope links tapped in other apps in the installed app itself.
- **Mini loaders — ONLY where there is a real wait** (a page load, a server action, a fetch). Never on something that
  switches instantly in the browser (Relation / Family tab, Holdings Income / Expense) — the user asked for that.
  The loader REPLACES the icon / number / chevron it belongs to and the original comes back when done:
  `LinkIconSpinner` (components/ui/link-spinner.jsx, useLinkStatus) wraps a link's icon or count — WaTabs tab icons,
  the money view-switch counts, LinkButton icons, sidebar / bottom-bar / bell / calendar icons, the Members-list map
  pin; `<LinkSpinner />` sits beside a text link (relation-chain cards, family names, Holdings names, print chips,
  calendar page arrows); `FormIconSpinner` (components/ui/form-spinner.jsx, useFormStatus) does it for a form submit
  (opening a notification). A client switch that navigates (meetings List/Calendar, calendar month arrows) shows Loader2
  while its transition is pending; a collapsed part that loads on open shows Loader2 in place of its chevron.
- **Pagination** (components/ui/pagination.jsx) renders nothing when there is one page or none (no "0–0 of 0", no
  rows-per-page) — still shown on a page past the end. Group Members tab is paginated (?page, per-page cookie).
- **Browser cache for on-demand parts** (lib/client-cache.js `useOnDemand(key, fetcher)`): answers of the load-on-open
  actions are kept in the TAB's memory for 3 min (never shared, gone on reload; only ok answers) and fetched early on
  pointer-enter / touch-start / focus, so the loader rarely shows. Put what changes the data in the key (a count);
  a write that keeps the key calls `forgetCached(prefix)`. History cards (group / fundraise / Mandal) and meeting
  minutes do NOT fetch early — the user wants them loaded only when opened. Calendar arrows router.prefetch the next month on hover;
  next.config staleTimes { static: 180, dynamic: 30 }. The DB is tiny — the wait is the Vercel→Hostinger round trip,
  so caching / early fetching helps, more indexes do not.
- **Load on open, not with the page**: content hidden behind a toggle is fetched when opened (server action), the page
  carries only counts. Meeting minutes: the meetings list gets `minutesCounts(campaignId)` ({eventId: n}); each card shows
  "Minutes (n)" collapsed (components/meetings/meeting-minutes.jsx) and opening it calls `loadMeetingMinutes`
  (actions/minutes.js — same visibility as the page). One row: the Minutes (n) toggle left, Add minutes right; with no minutes yet a plain grey uppercase
  "Minutes" label instead of the toggle; text 13px. Loaded ONLY on open (no hover prefetch): Loader2 replaces the chevron
  and shows in the body until it arrives.
  Edit / Delete icons on each minute (editMinutes / deleteMinutes) for its author and lib/access `canModerateMinutes`: app
  super admin / administrator / sub-admin, whoever manages it, and in its group (own or shown-in) admins, sub-admins and
  the Meetings team role. After a write the hook's `reload(nextKey)` fetches afresh (delete → under count − 1). Past meetings: the list view loads only upcoming meetings + `countPastMeetings`; "Past meetings (n)" calls
  `loadPastMeetings` (actions/meetings.js, same visibility as the page); the calendar view (?view=calendar → MeetingsSection
  `view`) loads ONE month (?month=YYYY-MM, default the next meeting's month via `nextMeetingMonth`, else this month):
  `listMeetings({ when: 'month', month })` + `scopeBirthdays(scope, id, monthNumber)`; its arrows navigate to ?month=
  (Loader2 in place of the arrow). Sundays are red text on a light-red cell (list view loads no birthdays).
  History cards (group About, fundraise / Mandal About) carry only a count (`countGroupHistory` / `historyCount`) and
  load on first open: `loadGroupHistory` (actions/groups.js, `canAdminister`) / `loadFundraiseHistory`
  (actions/fundraise.js, `canSeeCampaign` + `manage` for a draft / archived one). Settings renders only the active
  ?section= (Activity log paginated). Group page: member COUNT on every tab (`groupMemberCount`), one page of members
  on Members (+ `groupMemberIds` for the Add picker), the full list only on About (Team card). Mandal attendance: the page carries
  `mandalAttendanceCounts`; opening a schedule's line calls `loadMandalAttendance`. A Mandal's About tab shows no News & minutes (they live under
  its meetings) and does not load them.
- **Surnames** (/members/surnames, actions/surnames.js): editing (administrators) can change the English spelling too —
  `saveSurname` with original_name renames it for every member carrying it (surname + maiden_surname, any case; English
  and local), rebuilds full names that were the join of the parts, moves / merges the saved row; audited
  surname.rename. `deleteSurname`: app admins + sub-admins, only a saved surname nobody carries (checked server-side).
- **Add-relative name suggestions**: father / mother / brother / sister take the person's OWN father (`ownFather`): for a
  married (widowed / divorced) woman that is her maiden father's name + maiden surname, never her husband's. Changing
  the marital status (single ↔ married name form) keeps what was typed (`carry`: father's name / surname ↔ maiden parts).
- **Members list sort + data filter** (lib/members.js): ?sort= MEMBER_SORTS (name default, name_desc, newest / oldest
  by created_at, age_young / age_old with no-birth-date last) — not counted as a filter; ?data= MEMBER_DATA, built
  from MEMBER_DETAILS (phone, alt_phone, address, pin, city, village, dob, caste, surname, middle — each one "is filled"
  SQL): has_<detail> and no_<detail> (its NOT). The panel shows them in two optgroups, Has / Missing (DATA_DETAILS in
  members-toolbar.jsx sets the order). Fixed SQL picked from the map, never the raw param. Both sit in the filter panel's first section "Sort & data".
- **Home pins / Nearby Homes** (/nearby, nav Miscellaneous: My family tree · Nearby homes · Members): users_listmeta home_lat / home_lng, set on ANY existing
  profile (women too; theirs are saved but not shown on the map yet) — member edit → Details → the map-pin button beside the address (components/members/home-pin-button.jsx,
  actions/home.js `setHomeLocation`, canEditUser; saved on its own). The map shows active MEN only (never a woman's
  home) to every signed-in member: Leaflet (components/maps/osm-map.jsx, browser-only via
  next/dynamic ssr:false; CSS pins, no images), person-icon pins with a mini profile card (name, village · city, address,
  phone — not for a relative added via the family tree, like the profile — then icon-only Profile / Directions / Call).
  "Near me" is a square icon button on the map's bottom-right corner (like the tree's Focus), with the Map ⇄ Satellite
  toggle (`layerToggle`) just above it; the viewer's own spot is a dark dot with a soft ring (never orange / navy).
  Tiles (free, open source, no key — the user wants NO CARTO, no keyed providers, not Google): road = OpenStreetMap's
  own picture tiles; satellite = Esri World Imagery + Esri road and place-name overlays. MapLibre + OpenFreeMap vector
  tiles were tried (Oct 2026) and drew a BLANK map in production (style background only, no tiles) — reverted; do not
  bring a WebGL vector map back without checking it in a real browser first. The Map / Satellite choice is remembered per
  device (localStorage `pv-map-view`, osm-map.jsx) for every map with the toggle. The list floats on the map and shows only the homes in the VISIBLE area (`onView` on every pan / zoom),
  nearest to me after Near me, else to the map's middle — from the homes fetched so far. Each row: name + distance /
  village · city, then icon buttons Profile (navy) · Directions (light blue: blue-50 + border-blue-200 / blue-700 — never grey or orange) · Call
  (light green, only with a number); the pin's card uses the same three colours. NEVER all homes at once: the page sends only the count, where to open (?focus home, else my own
  home, else the box around all — lib/homes.js homesSummary / homeOf) and those homes; the rest load BY AREA as the map
  moves (actions/home.js `loadHomesInArea`, lib/homes.js homesInArea, max AREA_LIMIT 300, `full` when capped). The
  client waits 350 ms after a move, asks for the view padded by half on each side snapped to a 0.01° grid (fetchCached
  key `homes:s:w:n:e`), skips a view inside the last box (unless that one was full and the view is now < 1/3 of it), keeps
  every home fetched, and shows a mini loader (top middle) while asking. OsmMap `fit={false}` + `bounds` / `center`:
  markers are kept by id (an open card survives a load). It starts open on sm+, closed on a phone (chip) until Near me.
  The pin picker button has a light grey background; the picker also has the Satellite toggle. ?focus=<id> opens on one home; the Members
  list shows a pin button (has_home) before ⋮. The profile's address link uses the pin when set. Privacy policy +
  licences (Leaflet, OSM data, Esri) say so.
- **Family tree focus**: a square Focus button (bottom-right of the canvas) scrolls back to the tree's person.
- **Family tree loading** (built for thousands of people): the page only checks access + `familyTreeMeta` (version of
  the family: its links' count / sum of ids + MAX(users_list.updated_at) and count of its people, plus 'f' / 'p' for
  whether the viewer may see private details) and preloads `/api/family-tree/<id>?v=…`; the API (`familyTreeData`)
  answers with `Cache-Control: private, max-age=1y, immutable` — the browser never asks twice for the same version.
  Parts: base (married daughters' branches out, no dob / marital / kin) · `&married=1` · `&details=1` (+ dob, marital,
  kin — the costly relation walk runs only then), fetched when that switch is turned on; the loader keeps each part in
  memory and shows the current tree while one loads. Empty values are left out of the JSON. **Signing in must not
  touch users_list.updated_at** (`updated_at = updated_at` in createSession); anything else that writes a person
  bumps it (the default ON UPDATE). The tree itself (HTML, not canvas — the user rejected a canvas
  version): zoom is written straight onto the tree element (style.zoom, crisp) at most once per frame — never React
  state, so a pinch never re-renders the cards; Branch is memo'd; the man / woman figures are hidden <symbol>s re-used
  by every tile (<use href="#ft-man">).
- **Very big family trees fold** (lib/family.js familyTreeData; numbers = admin settings `tree_*`, Settings → Samaj →
  Family tree, each with Now / Recommended / Reset): a tree with more than tree_fold_above (1000) people opens at most
  tree_up_generations (15) above the viewed person — top card "See father" (`&up=<id>`, the next ancestors as one line,
  each with "See brothers" `&brothers=<id>`); from that top tree_open_generations (7) open, the next generation's cards
  with a child get "See family" (`&branch=<id>`, tree_branch_generations (10) below, then folds again). The line to the
  person and their own family always stay open. No counts up front — "has a child" comes from the in-memory links.
  Server sends the decided shape (married-daughter rules too — Branch renders `node.children` as given); folded flags
  `more` / `brothers` / `up`; the loader grafts opened parts (graft / withFathers) and refetches them per switch.
  The fold settings are part of the tree's `v=` (a change refetches). `TREE_FOLD=size.open.branch.up` (env) overrides
  them to try the folding locally on today's small families (e.g. `TREE_FOLD=50.2.2.1 npx next start`).
- **Number settings** (lib/settings type 'number' with min / max): SettingsForm draws them with "Now: x · Recommended: y
  · min–max" and a Reset button (puts the default back; Save stores it). A settings group with its own section:
  OWN_SECTION_GROUPS + a SECTIONS entry with `groupOf: [module, group]` (GroupSection), kept out of the module's form.
- **Full-screen canvases** (family tree, Nearby Homes map): `useFillHeight()` (components/ui/use-fill-height.js) on
  the canvas wrapper grows it to the bottom of #content (above the phone bar), measured live; keep a CSS
  h-[calc(100dvh-…)] for the first paint. Leaflet redraws on resize (ResizeObserver in osm-map).
- **Members "Added by" filter** (?by=<id>): app admins / sub-admins pick anyone (listCreators, with counts); members
  only "Added by me"; a searchable Combobox in its own grid cell — rows Role | Status, Registration | Added by,
  Gender | Age; picking one sets Registration to All.
- **Spouse ⇒ married**: linking a wife / husband (linkRelative 'spouse') sets BOTH to married when both are alive and
  their status is empty / unmarried / engaged (never over widowed / divorced; nothing when one has passed away).
- **Names in Name Case**: every typed English name part (first / father's / surname, maiden parts, an invite's full
  name) goes through `nameCase()` (lib/names.js — "MANTHAN" → "Manthan", Gujarati untouched) on the server when saved
  (members, family, register, invite) and on leaving the box in the forms (name-fields, person-or-phone, invite dialog).
- **Editing someone else's profile** (`canEditUser`): themselves; whoever added a FAMILY relative (users_listmeta
  added_via = family) — always; whoever added anyone else — until that person first signs in; member admins by rank.
  The Access tab (role / status) is member admins only (page + updateMemberSection). Member page: a small right-aligned
  line at the very END of the page (under both columns, phone and desktop) — shown only to app
  admins / sub-admins (who added anyone, or "Joined") and to whoever added that profile ("Added by you"); hidden from
  everyone else — "Added by <name> · date" (created_by) or "Joined · date".
- **Speed — parallel queries**: in pages and actions, never await independent DB calls one after another. Load the user
  and the main record together, then everything that needs only the id in ONE Promise.all (start background pieces as
  promises and await them after the tab's data). Fundraise / group / member pages follow this.
  Measured (Oct 2026): one round trip to the live DB ≈ 25 ms — pages are slow by the NUMBER OF WAITS in a row, not by
  query size. Rules: (1) never a query per person / per generation / per row in a loop — one INSERT … SELECT or one IN
  list (syncEveryoneMeetings, family tree from the request's `allRelations`); (2) look things up by the parent id with a
  JOIN instead of "load ids, then load by ids" (mandalMeetings: 4 lookups in one wave); (3) lookups a page repeats are
  React `cache()`d per request: getCampaign, getGroup, fundraiseTeamRoles, isAdminOfFundraiseGroup, groupRoleOf,
  syncMandalMembers' insert, `mandalMeetingsOnce` / `mandalMembersOnce` (pages only — actions use the plain ones);
  (4) a child server component may take promises as props (MeetingsSection minutes / attendance) so its own loading
  overlaps the page's; (5) start the likely rows before a dependent check finishes and redo only if the guess was wrong
  (Savings tab ?schedule=). To profile: temporarily log each query's start + ms in lib/db.js, `next start` a build and
  fetch pages with a probe session; count the sequential "waves".
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
- **Members list → groups**: only the bulk bar has "Add to group" (as member; bulkAssignToGroup forces member_role =
  member) — the row ⋮ has Activity history instead (sub-admins and up = canViewAudit; MemberActivityDialog →
  `loadMemberActivity`: the member's own audit rows as actor, 30 per page; administrators can clear them there (`clearAuditLog('', '', memberId)`) or in Settings → Activity log with
  its filters (type / member / search → "Clear these N entries"; no separate danger zone). Every sign-in is logged
  (createSession → audit 'auth.login', entity 'login' = the "Sign-in" type, detail { device }). Members sort also: `login_old` / `login_recent`
  (last sign-in; never signed in last). Group admins are made ONLY inside the group (its Members tab).
- **Bulk edit members** (Members bulk bar → Bulk edit, `bulkEditMembers`, app admins / sub-admins = canManageMembers): rows of
  "what to change ▾ / value / ×" (+ Add a change; each field once): status, role, native village, current city, caste → sub-caste,
  blood group, donor. Per person: canEditUser, role only via canChangeRole, never own role / status, non-active → sessions revoked;
  audited user.bulk_edit; forget('places','castes').
- **Archive → then Delete member** (two steps, like groups). `setMemberArchived(id, on)` and `deleteMember` — same people
  (`canDeleteMember`). users_list.status `archived`: hidden from everyone but administrators (+ super admin) — the
  `status=all` list excludes it, only their "Archived" filter shows it, their profile 404s for others; cannot sign in
  (sessions revoked; every `status = 'active'` query skips them). Restore brings back the status kept in meta
  `status_before_archive`. The Edit page / Bulk edit never change an archived member's status. Row ⋮ and profile ⋮:
  Archive, or (archived) Restore + Delete permanently.
- **Delete member** (`deleteMember`, `canDeleteMember`): super admin / administrator only (never sub-admin), never
  themselves; an administrator cannot delete an administrator / super admin; ONLY an archived member (else
  `members.archiveFirst`). In the Members row ⋮ and the profile ⋮ (red, last, confirm). Hard delete: FK cascades remove memberships, relations, roles, Mandal marks, sessions; contributions
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
  `relationStepsFrom(root)` (labels for the tree). Equal-length paths: fewer marriages wins (blood line first).
  relationPath reads only the chain's people (one tiny query). Add new names to KIN_TERMS + both dictionaries — and to
  a `KIN_GROUPS` group.
- **Members "Relation" filter** (`rel` = lib/kinship KIN_FILTERS: any, parents, spouse, brothers, sisters, children,
  grandparents, grandchildren, uncles (= kaka+foi+mama+masi), kaka, foi, mama, masi, nephews, cousins, inlaws; near and
  distant together) + `relof` (anyone may pick anyone; default the viewer). The page runs `relativeTerms(relof)` (one
  in-memory walk), sets `filters.onlyIds` (u.id IN, integers inlined), and each row shows its term under the name
  (orange text-xs). The tag shows whenever ANY filter or a search is on — phones too, same table (relation to relof, else to the viewer; unnamed path → kin.relative).
  The "Relatives of" MemberPicker keeps its label in the draft and is re-keyed only on open/clear (re-keying on pick lost the choice).
  It searches the whole app: /api/members/search?all=1 (active + inactive + late, never archived; 50 results). Choosing a relation / person switches Registration to All (family-tree people are unregistered).
- **Members list default = registered only** (`last_login_at IS NOT NULL`); the Filters panel's Registration
  select (`reg=unregistered|all`) shows the rest (invited / family-tree people). Counts as an active filter.
- **Meeting audience**: saved as events_listmeta `audience` = 'all' | 'selected'. 'all' = everyone, **including people who
  join later**: `syncEveryoneMeetings` (lib/meetings.js) adds current group / fundraise members to upcoming 'all' meetings when a
  meeting list opens and before reminders are sent. 'selected' stays a fixed list.
- **/fundraise sections** (listCampaigns): **For you** = you BELONG (FOR_YOU: a group of yours is linked — fundraise_groups or a
  Mandal's own group — or you're on its team / a Mandal member) · **Recommended** = an audience rule matches you (AUDIENCE_MATCH:
  surname, caste, sub-caste, city, native village) and not For you · then the rest. AUDIENCE_MATCH (not FOR_YOU) is what
  AUDIENCE_OK uses for who may see it.
- **Who runs a Mandal**: ONLY its own people — app admins / sub-admins (canManageAllFundraises), its team admins (manage),
  treasurers and collectors (canRunMandal). fundraisePermissions skips the group-admin rule for kind = 'mandal', and
  canRunMandal has no group-leader path: a group admin / sub-admin with no Mandal role only views it (no + Contribution,
  sheet Edit, Add members, New schedule, Edit, Danger zone). Chat clearing keeps its own rule (group admins may clear).
  Callers must pass the campaign with `kind` (getCampaign / authorize / loadMandal / meetings already do).
- **Mandal (savings circle)** — a fundraise with `kind = 'mandal'` (started from the group page "+ New ▾" menu → /fundraise/new?group=X&kind=mandal; fixed after).
  Meetings tab of a Mandal: each schedule card shows "n came · n absent · n not marked" instead of RSVP counts
  (meetings/mandal-attendance.jsx — compact list, 1 / 2 / 3 / 4 columns by width; data lib/mandal `mandalAttendance`). Those who run it (canRunMandal) mark each member
  by tapping the row (same ✓ / ✗ / – icons as viewers; – or ✗ → ✓, ✓ → ✗), saved at once by `setMandalPresence` (marks.present only — payment untouched); not on an archived
  or future schedule. No "Are you coming?" on a Mandal schedule.
  **Address: /mandal/[id]** (route renders the fundraise page with `asMandal`; /fundraise/[id] of a Mandal redirects there, query kept;
  revalidate both paths). **About**: `mandalAboutParts()` → { main: summary + Members (scrolls), side: Schedules } placed INTO
  DetailsTab's two columns (no separate block → no gaps). **Attendance & money** has a member search (rows hidden, still posted).
  **PDF**: /fundraise/[id]/print for a Mandal = MandalPrint — all schedules or `?schedule=<id>` (chips; Savings: "All schedules"
  button + icon per schedule). Data stays in fundraise_campaigns (kind) + events_list (schedules = meetings linked by campaign_id).
  **Schedule lifecycle** (About → Schedules ⋮, ScheduleActions): Edit · Archive → (archived) Restore · Delete permanently.
  deleteMandalSchedule requires archived (mandal.errors.archiveFirst) AND no money (sheet marks + contributions.event_id,
  mandal.errors.hasMoney — it stays archived). Archived schedules are left out of every picker and take no money.
  The delete is a pop-up (deleteMandalScheduleForm) with "Also delete its history" (off by default): removes the history
  records of payments once added there and later removed, and those removed rows. Always: marks cascade, expenses named
  for it fall back to common savings. Public page filter uses the same ScheduleSelect (place under each date).
  **Attendance & money is VIEW ONLY** (came ✓/–, paid, mode, owed; anyone who sees the Mandal, archived schedules too) —
  except its ONE in-pop-up **Edit** (icon-only blue pencil, top right, left of ×; who runs the Mandal, open schedules; nowhere else): the whole list
  becomes editable (came / paid / mode) for backfilling; beside the search an All / Present / Absent filter (counts; follows
  the draft while editing); Save posts every row to saveMandalMeeting (members not posted are
  never touched), Cancel drops the draft;
  money + attendance are entered with "+ Contribution". /fundraise list: a Mandal's Place = its latest-created schedule's
  place (listCampaigns `latest_place`).
  **Schedule pickers** (contribution / expense / edit): ScheduleSelect — searchable, two lines: date + place · per person (no "Money with" in pickers).
  **Schedules table rows**: one ⋮ (ScheduleRowMenu: Attendance & money — sheet opened from the item, mounted outside the menu —,
  PDF; + for those who run it: Edit, Archive / Restore — delete stays on About; the date link opens a schedule; the same ⋮ sits on the
  schedule strip). **Money kept by**
  (ScheduleDialog): searchable en/gu Combobox; a new schedule defaults to the last
  schedule's keeper, else the team treasurer.
  **Schedules own collect yes/no + amount per member** (ScheduleDialog, About); the attendance sheet only shows it (read-only,
  list in a max-h-[50vh] scrolling box) and never writes it; the Mandal edit form keeps each schedule's collect. **Expenses**:
  Savings → Expenses card (ExpenseDialog / RowActions with `schedules` → optional "For schedule", meta event_id on
  fundraise_expensesmeta; empty = common savings).
  **Public link** of a Mandal: the normal Statement card (By contributor · Contributions · Expenses) from the FILTERED rows
  (mandalLedger + mandalStatement: one schedule | from–to, lib/mandal-filters.js, GET) behind ONE "Filters" button
  (MandalFilterButton pop-over); totals follow the filter. /p/[token]/print = PrintSheet with the same section chips, the
  filter kept on every chip (`query`) and named under the title (`period`).
  Header Edit / PDF buttons always point at /fundraise/[id]/edit|print (there is no /mandal/[id]/edit|print).
  A Mandal is its group's own: the form shows its home group only (no other groups, no "Add to group") and no audience (server forces both);
  the public link works as for any fundraise;
  seen only by its group's members, its members and team (AUDIENCE_OK) — in its group's list and in the /fundraise
  feed, both with a "Mandal" badge. Its pending
  (summary) = members' dues.
  lib/mandal.js + actions/mandal.js + components/mandal/*. Tabs: Discussion, Meetings, **Savings** (the Mandal's Income/Expense:
  the SAME MoneyTab as a fundraise (summary, view switch, + Contribution / + Expense, Copy / PDF). Overview: views
  Schedules (default) · Contributions · Expenses · By contributor; the Schedules table (mandalMoneyParts: date opens
  ?tab=money&schedule=<id>; place, per person, came, received, spent — ALL columns on phones too, the table scrolls sideways). One schedule: exactly the
  fundraise views limited to it (listContributions / listExpenses / contributorTotals take eventId; boxes = its totals) with
  the strip on top (back, details, sheet, PDF) + an **Absent** view (everyone it was for not marked came — nothing recorded =
  absent; owed before, run of absences, anything paid anyway). fundraise_contributions.event_id = the schedule (sheet payments, and the
  short Mandal "+ Contribution" — MandalContributionDialog → saveMandalContribution: member (this Mandal's members only),
  schedule (default the open one, else the latest open), came, amount (starts at its per-member amount), mode; written like one
  sheet row (mark + contribution, kept_by = schedule keeper) — no Kept by / handed over / donor name / anonymous / reference;
  rows: member · amount + mode · schedule + came; the member LIST shows each one's record before that schedule (absences in a
  row since added, owed) and the amount starts at per-member + owed (mandalAdd.info). Nothing recorded on a schedule = ABSENT
  (mandalMembers `missed` counts unmarked schedules too). One payment per member per schedule via "+ Contribution" (server
  refuses a second: mandal.errors.alreadyPaid; members who paid there are left out of its picker — mandalAdd.paid).
  **Attendance & money AUTOSAVES per row** (no Save button): Came on tick, Mode on change, Paid ~0.9s after typing / on blur —
  each row = saveMandalContribution(sheet=1, queued per row, Saving…/Saved/error mark; no page refresh per row, one
  router.refresh() on Done / close). (superseded: the sheet is view-only with its own Edit — see below);
  only for those who run the sheet, while a schedule is open); expenses: meta event_id ("For schedule").
  Holdings card: About, under Team. Sheet payments save kept_by = the schedule's held_by, else the recorder, handed_over = the
  schedule's "Handed over to the treasurer" (events_listmeta handed_over='1', set in Edit schedule; saving it updates every
  contribution of that schedule; so does a changed keeper — kept_by follows held_by, and a sheet / + Contribution save
  writes the schedule's keeper, never COALESCE, when it names one). listHoldings reads the keeper as
  COALESCE(schedule held_by, kept_by), so an older payment saved before a keeper change still counts for the right person. Mandal money rows show no per-payment Kept by / badge (MoneyTab holdingPerRow=false); the
  overview schedules table shows With treasurer / Not handed over per schedule that has money;
  money is ALWAYS taken against a schedule, never the Mandal as a whole), About (`section="about"` at its top: summary,
  Members in a fixed-height scrolling card beside Schedules — create / edit / archive, no money entry — then team, history;
  each member row has a ⋮ (MandalMemberMenu: View profile; Remove — red, confirm — for those who run it, phone-added only))
  (?tab=mandal → About). No place of its own (per schedule). On its group's Fundraises list an
  active Mandal (not archived/closed, not past end date) is pinned on top (groupFundraises `pinned`). Sheet payments
  write fundraise_history (add / edit / delete) like ledger entries. Members =
  fundraise_subscribers, chosen on the form like a meeting's attendees (PeopleChoice: meta members_mode 'all' = whole
  group, kept in sync by syncMandalMembers; 'selected' = chosen people) and/or added on the tab (added by admins / sub-admins / its treasurer / collector — `canRunMandal`; pick or invite by phone).
  Meetings = the fundraise's own meetings, inviting its members — everyone or chosen ones (FUNDRAISE_PEOPLE in
  lib/meetings; dues and the sheet count only the members a meeting is for, `isFor`); per meeting meta collect ('1'/'0') + installment (default = campaign meta
  installment). "Attendance & money" sheet → fundraise_mandal_marks (present, paid) + a contribution per payment in the chosen mode (cash / UPI / bank / cheque / other) (so the
  ledger / totals include it). Dues = installments of collecting meetings held since joining − paid; missed = absent marks
  since last present ("Missed n meetings · last came n days ago", or "never came"). Opening balance = one "Opening balance" contribution (meta opening_contribution_id);
  when > 0 the Finance card shows "Handed over to the treasurer" (opening_handed, default yes → its handed_over).
  Mandal form: no target, no amount-per-meeting (amount is per schedule), place = plain text (never a suggestion —
  knownLocations skips Mandals); right column: Who is in it, Sharing, Schedules (SchedulesEditor: rows in state,
  posted with the form as sch_*; writeMandalSchedules creates / updates / archives / deletes-if-no-money).
  Schedules (also on the Mandal tab, right card, with the money sheet): each = a Mandal meeting "<date> - Mandal" (saveMandalSchedule: date, place,
  installment, meta held_by = who keeps that day's money, picked from the Mandal's GROUP's active people + its members — buildMandal keepers, not only the Mandal's members; audience 'all'). Kebab: Edit; Archive (meta archived '1',
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
- **Offline**: OfflineGuard (root layout) — while navigator says offline, a transparent layer pauses every click and a small
  amber notice shows; on 'online': toast "Back online" + router.refresh(). (app)/error.js treats network errors (Failed to
  fetch, network changed, load failed …) as "Connection lost": not reported, retries by itself on 'online'.
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

1. `npx eslint src --quiet` clean; en/gu parity clean. The project config does NOT flag undefined names (a prop used
   in a child component it was never passed to built and linted clean, then crashed /members) — also run
   `npx eslint --rule '{"no-undef":"error"}' <changed files>` (ignore 'process' hits).
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
- **Mandal sheet edit mode** (components/mandal/mandal-sheet.jsx): ticking "Came" on a row with no amount fills Paid with
  pending before this schedule + this schedule's amount (still editable); a typed amount is never overwritten.
- **Mandal team = its group's members**: AddTeamMemberButton `groupId` → MemberPicker search `?group=<id>` (api/members/search
  filters admin_group_members); saveTeamMember refuses a NEW person not in campaign.group_id (mandal.errors.teamGroupMember).
  Plain fundraises: anyone, as before.
- **Notification tap** (public/sw.js): only app links (else home). App open → focus its window, post `pv-open` →
  PushNavigator (shell) answers and `router.push`es (no reload) with a mini "Opening…" pill until the route changes;
  no answer in 800 ms → `navigate`; app closed → `openWindow`. Admin / member messages take an optional
  "Open page" link (`appLink`: an in-app path or a pasted address of this host; another site is refused; empty = home).
- **Nearby filters**: URL params family / city / village / surname / age_min / age_max → lib/homes
  `resolveHomeFilters` + `filterSql` (summary, homeOf, homesInArea); the map sends them with every area request
  (loadHomesInArea(box, filters), part of the cache key) and is remounted when they change; "family" = familyIds of
  the CALLER. URL built by lib/home-filters `homeFiltersHref` (pure).
- **Push sends**: the composer's members choice lists only active people with a token (MultiSelect, bulk); a member's
  Send tab posts device_ids only when "Only some devices?" is on (off = all). lib/device-name: deviceName / isPhone.
