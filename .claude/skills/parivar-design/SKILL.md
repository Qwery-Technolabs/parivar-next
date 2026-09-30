---
name: parivar-design
description: Visual design system and UI patterns of the Parivar app (Next.js 16 + Tailwind v4, Gujarati/English). Use before building or changing ANY page, card, form, table, filter, dialog, menu, tab strip or avatar in this repo, and whenever the user says "make it like X", "same as the other page", or asks to apply a look in several places. Keeps every screen consistent with what was already agreed.
---

# Parivar — design system

`references/design-system.md` (in this skill) holds the generic recipes (token layers, measured contrast, type scale,
responsiveness, component basics). This skill is the **project's own decisions** layered on top.
When the two disagree, this skill wins — it records later choices the user made.

**Keep this file current.** When the user asks for a look or behaviour to be applied "like this"
or "everywhere", change the code *and* add or amend the rule here (see "Changelog of decisions").

## Brand and colour

- Navy `#172f56` (`bg-brand-navy`) = app header, sidebar, group/fundraise header cards, public header.
- Secondary = deep orange `#b85d09` (`btn-secondary` / `seg-active` / `bg-brand-orange-strong`) with
  **white** text (4.56:1). Never white on the lighter `brand-orange`.
- Card headers are tinted: `bg-card-head` strip with `border-b`, title `text-sm font-semibold text-primary`.
- Scoped themes: `.theme-fundraise` (blue primary), `.theme-blood` (rose). Wrap module pages in them.
- **Fundraise ledger colours: contributions BLUE (`income` #1d4ed8), expenses ORANGE (`expense` #b85d09)** —
  every amount (`text-income` / `text-expense`), add + edit buttons (`bg-income` / `bg-expense`, FormDialog
  `submitVariant="income|expense"`), the Contributions / By contributor tab (blue) and Expenses tab (orange),
  and the phone "+" buttons (one blue, one orange). Pending (unpaid) stays amber; a negative balance rose.
- Status colours: emerald = success, rose = danger, amber = pending/warning
  (e.g. "Not registered yet", "Pending" contributions), gray = neutral.
- Every new colour pair must pass 4.5:1; `avatarInk(hex)` (lib/group-avatar.js) picks white vs dark
  text for any background.
- Density: 15px root; controls `h-9` (compact `h-8`), cards `p-3.5`, gaps `gap-3`.

## Layout shell

- Sidebar sections: **Overview** (Dashboard) · **Community** (Groups) · **Services** (Fundraise, Blood)
  · **Miscellaneous** (Members). Settings pinned at the bottom. Collapse arrow straddles the sidebar edge.
- The sidebar logo row has the same faint bottom line as the header (`border-b border-white/10`), in the
  desktop sidebar and the phone drawer, so the two edges line up.
- Sidebar section titles (Overview, Community, …): small uppercase `text-white/60` with `pt-[5px]` above.
- Top header (navy): menu (phone) · **page back link** (portalled into `#page-back-slot` by
  `HeaderBack`; always a link to the parent page — never history-back through tabs) · … · bell · calendar · light divider (`w-px bg-white/25`)
  · profile. Never render a back link inside the page body — pass `back` to `PageHeader`.
  On phones a page with a back link (group, fundraise) hides the hamburger (`.nav-burger`, CSS `:has`) —
  back only, like a chat app.
- **Phone drawer**: slides in/out (`translate-x`, 200 ms, backdrop fade), driven by the `#nav-drawer`
  checkbox so it opens before the JS loads; the logo row's name truncates (`min-w-0 flex-1`) so it never
  runs under the close button. Any link inside closes it.
- **Phone bottom bar** (`BottomNav`): Home · Groups · Fundraise · Blood · Members (those the person can
  see), white. Active tab: orange pill behind the icon (`bg-orange-100 text-orange-600`), bold navy
  label, thin orange top bar. Shown **only on those section pages** — never
  inside a group, fundraise, chat or any detail page.
- Content gutters `px-2 sm:px-3 lg:px-4 py-3`, full width. Pages never add negative margins;
  navy header cards sit *inside* the gutters (`mb-3 overflow-hidden rounded-lg bg-brand-navy`).
- Browser / app **theme colour** = brand navy `#172f56` (`lib/theme-color.js`, used by the root
  `generateViewport` and the manifest) — matches the navy header. Not the logo colour (user's call).
- Samaj logo = `SamajLogo` (rounded square, settings-driven), used in sidebar, sign-in, public header.
  Brand name = Samaj name from settings (local spelling on Gujarati pages), else `app.name`.

## Page header

`PageHeader({ title, subtitle, back, actions, menu })`:
- **One "create" action** (New event, New group, New fundraise, Post request) → plain button in `actions`.
- **Several actions or non-create ones** → `menu={<PageMenu items=[...]>{dialogs}</PageMenu>}` — the kebab
  sits at the **right end** of the title row. Items: `{key,label,icon:<Icon/>,href}` link,
  `{…,action,confirm,danger}` server action, `{key,…}` opens a dialog registered with `menuKey`
  (dialogs mount outside the menu via `MenuOpener`).
- Page-level controls that belong to a form (e.g. fundraise **Status**) go in `actions`, left of the
  kebab, bound to the form with `form="<id>"`.

## Kebab (⋮)

Only `KebabMenu` from `components/ui/popover.jsx` — white background, `border-ink-gray/35`, grey dots,
`size-8`. Row kebabs in tables: last column `w-12 text-right`. Menus list safe items first, a
`MenuSeparator`, then the destructive one (`danger`). Sub-choices (e.g. **Change role ›**) open *in
place* with a "‹ Back" row — never a side flyout (the portalled panel scrolls and would clip it).

## Tables and toolbars
- Phone tables: the name column gets `min-w-44` so full names show (tables scroll sideways); secondary
  lines under a name (occupation etc.) are `hidden sm:block` — on phones the name alone.

- Every list uses the shared toolbar: `FilterBar` (data-configured) or `ToolbarRow` + `SearchBox` +
  `FilterPopover`. **Left**: count / heading / month nav; **right**: search + Filters button.
- Filter popup (`FilterPopover`, popover `flush`): tinted **header** ("Filters" + count + ×), fields in a
  **2-column grid** that is the *only* scrolling part, tinted **footer** with Clear (white, bordered) and
  Apply (primary). Group long panels with `FilterSection` titles.
- Filters that depend on another use `showIf: { param, value | not | in: [...] }`.
- Bulk selection bar sits **above** the table. Destructive bulk/admin actions (clear log) sit **below**
  the table, right-aligned, after pagination — never in the always-visible toolbar.

## Forms

- Picture fields (group, fundraise, Samaj logo) use `AvatarPicker`: a clickable avatar with a pencil badge
  that opens its own popup (Icon ~125 lucide names / Emoji / ≤2 letters + preset or custom colour).
  New records start on a random icon. Layout: **picture alone in the left column, every other field in
  the right column** (`flex items-start gap-4` → `shrink-0` + `min-w-0 flex-1 space-y-3`).
- Long create/edit pages: tinted-header `Panel` cards, two columns on `lg` (main | side), pinned bottom
  action bar (`sticky bottom-0 … bg-white/95 backdrop-blur`).
- Edit pages with many fields: iconed tabs (`MemberEditTabs` pattern) — **each tab saves on its own**,
  tab kept in `?tab=`.
- Names: three required parts (first / father's / surname) each with an auto-transliterated local twin
  (`NameFields`); Gujarati labels તમારું નામ / તમારા પિતાનું નામ / અટક.
- **No `<datalist>` anywhere.** Single free-text-with-suggestions → `PickOrType` (text box + dropdown,
  safe inside a `<label>`). Several values → `TagSelect`. Fixed list → `<select>`. Many checkboxes →
  `GroupChecklist` (5 visible, searchable past 5).
- Any custom control rendered inside `Field` (a `<label>`) must `preventDefault` its clicks or the
  label re-clicks its first button (this once cleared chosen values).
- Phone entry: accept pasted lists (one per line, +91 or not, optional name) and spread into rows.
- Pickers that choose a member can offer **"Invite <number>"** when a typed phone number is unknown.

## Tabs, calendars, chat

- WhatsApp-style `WaTabs` on navy headers (icon over label, count bubble, orange bar). Tab links use
  `replace`, so the browser Back leaves the page rather than stepping through tabs. Group tabs:
  Discussion · Meetings · Fundraise · Members · About. Fundraise tabs: Discussion · Income/Expense ·
  Meetings · About. Phones: labels `text-[10px]` without tracking, icons `size-4` (from `sm`: 11px tracked, 18px).
- Fundraise navy header: row 1 = picture + title (left) · Add to group, PDF, Edit pinned top-right. **Status is
  a dot on the picture's bottom-right** (green active, grey draft, red closed; title + aria-label) — no status
  badge. Row 2 only when needed: Archived badge (left) · "Your role" (right, sm and up only). Phones see
  "Your role" at the top of the About tab's Team card.
- Fundraise Income / Expense tab on phones: no summary boxes / progress bar (the navy header shows the
  totals + target % to 2 decimals); ONE toolbar row = view switch · Share menu (copy list / copy all / PDF) ·
  two round "+" buttons — blue adds a contribution, orange an expense (only those the person may add).
  Prefer round "+" buttons and one menu for secondary actions over rows of labelled buttons on phones.
- Detail lists (label + value, e.g. /members/[id]): phones = label left (40%), value right-aligned on one
  line, rows divided; from sm = label above value in two columns.
- Settings → Language: App language and Local language cards side by side (`md:grid-cols-2`), each a
  dropdown (`LanguageSelect`) that saves on change — no big choice tiles.
- Fundraise header "Add to group" (`AddToGroups`, FolderPlus): only when the person manages the fundraise and
  there is a group they may start a fundraise in that it is not in yet; icon-only on phones.
- **Every Cancel / Save bar** (dialogs, full-page forms like new fundraise, event, member, picture picker):
  **side by side on phones** — `flex flex-row gap-2 *:flex-1 sm:*:flex-none sm:justify-end`; never `flex-col-reverse`.
- **Dialogs (FormDialog)**: Cancel + Save side by side on phones too (each `flex-1`, own width from sm);
  **no field autofocus** — the dialog itself takes focus (`DialogContent focusPopup`) so no keyboard pops up.
- **Status dot on pictures** (fundraise header + list, group header + list): small bottom-right dot with a
  ring in the background colour — green active · grey draft/archived · red closed/inactive. Maps and sizes in
  `lib/status-dot.js` (`FUNDRAISE_STATUS_DOT`, `DOT_SIZE` size-2.5, `DOT_SIZE_SM` size-2) + `GROUP_STATUS_DOT`.
- Group About tab → **Danger zone** card (`GroupDangerCard`): status now, Mark inactive/active, Archive/Restore,
  and "Delete permanently" once archived (app-level only), each with a one-line explanation. Buttons coloured by
  meaning — pause amber-700, archive slate-600, active/restore emerald-700, delete red — **icon-only on phones**.
- **Family card** on the member profile (no separate page): near relatives only — Father, Mother, Wife/Husband,
  Brothers, Sisters, Sons, Daughters (slot name once per group; name → that person's profile; Late badge; age ·
  marital; unlink icon). Header: "Family tree" (outline) + "+ Add" (icon-only on phones). Add popup: **relation
  first**, then New person | Pick from members; it **stays open** after each save (FormDialog `keepOpen`).
- **Family tree** (/members/[id]/tree): a real tree (`.ftree` CSS connectors in globals.css) from the oldest
  ancestor up the father's line down to the youngest descendant — couples boxed side by side (heart), children
  hanging below; the person has an orange ring; navy / rose top stripe = male / female; late = muted. Dotted
  canvas, drag to pan, − / 100% / + zoom; cards link to profiles.
- Add-relative popup asks only the **first name**: father's name and surname follow from the person
  (`defaultsFor` in add-relative-dialog.jsx), previewed as "Full name: …" with "Change surname / father's name".
- **Action buttons are icon-only on phones** (square `size-8`/`size-9`, `aria-label` + `title`, label in
  `<span className="hidden sm:inline">`), icon + text from `sm`: Edit group / Edit fundraise on the navy
  header, meetings' Schedule / Edit / Cancel. Apply the same to new row/card action buttons.
- Calendar entries always carry a type icon (cake birthday, hand-coins fundraise, calendar event,
  calendar-clock meeting, party festival). Birthdays are rose.
- Calendar on phones: a compact month grid (day number + one coloured dot per kind, `TYPE_DOT`); a day
  with entries links to its first row in the agenda below (`#ag-<key>`, highlighted with `target:`). Never
  hide the grid on phones.
- Discussion system notes (meeting scheduled, member added/removed) are centred pills; alert messages
  carry an amber "Alert" badge. The composer's bell toggle = "alert everyone" (off by default).

## Public & print

- Public pages: navy header, Samaj logo + name, language toggle on navy.
- PDF/print is an **icon-only** button (`FileDown`) wherever it appears; print CSS keeps background
  colours (`print-color-adjust: exact`).

## i18n in UI

Full rules and the Gujarati glossary: the **parivar-i18n** skill.
Every visible string comes from `t()`; add keys to **both** `en.js` and `gu.js`. Plurals use
`{ one, other }`. Gujarati for roles: Member = સભ્ય.

## Changelog of decisions (append when the user sets a new "everywhere" rule)

- Filters → 2 columns, header/footer fixed, body scrolls; Clear/Apply in footer.
- Kebab: white bg, darker border, grey dots; page kebab at the right of the title row.
- Single create actions stay buttons; kebab only for several/non-create actions.
- Back link lives in the top header; history-back on phones.
- No datalists; PickOrType / TagSelect / select instead.
- Picture-left / fields-right for any form with an avatar.
- Destructive admin actions below tables, not in toolbars.
- Card-level "add" buttons (e.g. Add to team) go in the card header's `actions`, compact `btn-secondary h-8 text-xs`.
- Active sidebar item: navy-soft background, orange bar, **orange-400 icon**.
- Sidebar logo row: same `border-white/10` bottom line as the header.

## Maintaining the skills

The project skills live in `.claude/skills/` (parivar-design, parivar-dev, parivar-db, parivar-i18n).
They are **meant to change**: whenever the logic, a rule, a component or a convention changes —
especially when the user says "apply this like this" for several places — edit the matching SKILL.md
in the same piece of work (add the rule, fix what is now wrong, drop what no longer applies), and say so
in the reply. Code and skills must never disagree.
