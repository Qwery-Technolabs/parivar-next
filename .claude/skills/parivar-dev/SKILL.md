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
  anyone connected in the tree (`familyIds`, BFS over all links). Tree-added people (meta added_via='family')
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
