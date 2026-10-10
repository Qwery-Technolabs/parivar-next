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
- Loading: one thin line at the very top (TopLoader in the root layout), in the Samaj logo colour (admin logo_color),
  shown for any app request > 150 ms (page data / server actions / own /api) — it watches window.fetch, so pages need
  nothing; typing-time lookups (transliterate, member search) and prefetches are excluded. No per-page spinners for this.
- Page area behind the cards (`main#content`) = `#f5f6fa` (`bg-surface-content`).
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
  · **Miscellaneous** (My family tree → /members/<me>/tree, then Members; Members is not highlighted on my own tree —
  nav item `exclude`). Settings pinned at the bottom.
  Phone bottom bar: Dashboard · Groups · Fundraise · Family tree (own, short label `bottomLabel`) · Members — Blood is
  in the side menu only. Collapse arrow straddles the sidebar edge.
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
- Inside a card, group fields with `FormPart` (components/ui/form-part.jsx): a thin rule + small-caps title per
  part, ALWAYS with an icon before the title (`icon={…}`, orange-strong, size-3.5) (first part has no rule). Member form: Name · About them · Contact & place / Caste · Blood / Work & education ·
  Other contact · About; fundraise Details: picture alone in the left column (top), parts on the right — Name · Place & dates
  (a Mandal: Dates — no place) · Description; money fields on their own **Finance** card below (Target / Mandal: Opening
  balance).
  The member Add page looks like Edit: the same iconed tab strip (MemberTabStrip) but ONE form and one Save —
  panels stay mounted (hidden), a required field / server error on another tab opens that tab.
- Settings module forms: each setting has a `group` in lib/settings.js; SettingsForm draws every group as a FormPart
  with its icon (GROUP_ICONS: samaj, signup, language, sharing, expenses) — logo alone in the left column for General.
- Lists of many editable rows (e.g. Surnames): compact one-line rows + an Edit button that opens a small popup —
  never inline edit forms per row.
- People lists (Members) show ONE name, in the viewer's language (`localized`: Gujarati app → Gujarati, else English;
  falls back to English) — no second-language line under it; search still matches both spellings. The line under the name
  (position / education) is light grey `text-xs text-ink-gray`, not bold navy, so the name stays the one strong line.
- Contributor / donor names follow the same rule: a member's name from users_list in the viewer's language (donor_name_local,
  Gujarati screen → local script); a typed non-member name as typed. Anonymous masking clears BOTH names.
- Optional fields say so IN THE LABEL — "Reference (optional)" (`${t(label)} (${t('common.optional')})`) — never as a hint
  line under the field (also when only SOME users may leave it empty: label switches, e.g. relative phone, new-member
  password). A hint is only for a real requirement or a needed explanation.
- Hints, notes and short descriptions: aim for 5-6 words ("Who paid from their pocket"); up to 8-10 words when the
  rule needs it ("Skips higher roles and yourself. An empty value clears it."). Same length in gu.
- EXCEPT Danger zone rows (every danger card in the app): a full explaining sentence, up to ~20 words, keeping the
  "Action: …" prefix — what happens, who can still see / undo it, or "This cannot be undone."
- Mandal Attendance & money is a view-only sheet (came / paid / mode per member, search); entry happens in "+ Contribution".
- Repeater rows (Bulk edit, Invite by phone): small uppercase column headings, plain rows (no box per row), a bordered square × at the
  right of each row, "+ Add …" as an outlined button bottom-right. Short rows (Invite: mobile · full name · ×) stay ONE
  line on phones too (grid minmax(0,1fr) / minmax(0,1.4fr) / 2.25rem).
- Money forms are grouped with FormPart: contribution = Contributor · Amount · Holding (Kept by); expense = Details · Amount
  (+ Notes) · Holding (Paid by). What / Where / Notes / Reference carry example placeholders.
  Mandal Edit / New schedule: row 1 Collect? + Amount per member, row 2 Date + Place, then the same Holding part (HandCoins): Money kept by + "Handed over to the treasurer" on
  one row (grid sm:grid-cols-2 items-start, switch sm:pt-7).
- Money / amount inputs: type="number" inputMode="decimal" min="0" step="0.01" everywhere (contribution, expense, Mandal
  sheet + schedules, target, opening balance).
- Dialog footer (FormDialog) is pinned flush to the bottom edge (sticky -bottom-4, no strip of content under it).
- **Every picker list floats — everywhere** (`components/ui/floating-list.jsx`): Combobox, PickOrType, TagSelect and the
  Gujarati suggestions render their list through `<FloatingList anchorRef>` — portalled to <body>, position fixed under
  (or above, when more room) the input, z-[70], follows any scroll / resize; data-floating-list so FormDialog ignores
  presses on it; mousedown cancelled so the input keeps focus (blur closes). Never clipped by an overflow-hidden card,
  a table or a dialog, and nothing in the form moves. A NEW picker list must use FloatingList — never `absolute`
  under the input. (Menus / pop-overs: Popover, already portalled.) A switch beside a combobox is top-aligned
  (items-start + sm:pt-7), not bottom-aligned.
- Page ⋮ menus (PageMenu): `icon` is a NAME ('trash', 'pencil' …, MENU_ICONS in page-menu.jsx), never a `<Icon />` element
  from a server page (React #306 when the same icon repeats). Add new names to MENU_ICONS. Group related items with
  `group: 'name'` — a separator line is drawn where the group changes (Members: Add · Invite / Castes · Surnames).
- Password fields: always `<PasswordInput>` (components/ui/password-input.jsx) — eye button to show / hide; never a raw
  type="password" input.
- Placeholder colour everywhere: light grey `#b3b8c2` (globals.css `::placeholder`), never a per-input class.
- Name / title fields carry example placeholders ("e.g. Ramesh" / "ઉદા. રમેશ") — lib/examples.js.
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
  Discussion · Meetings · Fundraise · Members · About. Fundraise tabs: Discussion · Meetings ·
  Income/Expense · About (same order as a group: Discussion, then Meetings); a Mandal shows **Savings** instead of
  Income/Expense (PiggyBank icon). Phones: labels `text-[10px]` without tracking, icons `size-4` (from `sm`: 11px tracked, 18px).
- Fundraise / Mandal summary boxes: Collected · Spent · Balance, and **Target only when one is set** (no "No target" box).
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
  hanging below; the person has an orange ring; navy / rose top stripe = male / female; late = muted.
  **Couples are ONE joined card — husband always left, wife right** (heart on the divider); each person a tile with a
  round gradient initial "photo" (navy men, rose women, grey + flower badge = late); the tree's person has an orange
  outline (no tag). Compact: size-9 avatars, 4.25rem tiles, 1.1rem generation step; no detail line when the
  birth date is unknown. Couple cards: soft white→accent gradient, rounded-2xl, lift on hover.
  Canvas: warm glow + dot grid.
  **Cards show the first name only** (local first name when not English; full name as title / aria-label) and one
  detail line — age, or "Late". No father's name, surname or marital status in the tree (user's call). Dotted
  canvas, drag to pan, − / 100% / + zoom; cards link to profiles.
- **Tree looks like the Parivar reference**: each couple in ONE light rounded card (white, ring-slate-200, soft
  shadow) with two square rounded "photo" tiles side by side — husband left, wife right — first name under each. Tiles show
  a **man / woman silhouette (ManIcon / WomanIcon), same navy tile for both** — **one coloured tile per person (w-14, 3px padding): the figure fills it and the first name is written INSIDE it in
  white** (10px; details 9px white/80; leaf marital orange-200); couple card = white, 3px padding and 3px gap; grey + flower
  = late; connector step --ft-gap 1.75rem, sibling gap 0.625rem. **Every generation sits on one level across all branches**: an only
  child keeps the same top spacing (straight line, no bar); with Details on, tiles always reserve both detail lines; the
  tree's person has a slim 1.5px orange ring; light grey canvas (bg-gray-100, no pattern) so the white cards stand out. With Details on, the **end of a line** (no spouse, no
  children) also shows marital status (orange, small) — nobody else. A
  single person gets a one-tile card. Dark-grey square-cornered connectors (--ft-line #6b7280) drop from the card's
  middle to a bar and down to each child. Relation (Kaka …) + age live in the hover text; Details shows them.
  **No zoom buttons**: inside the box drag to pan, pinch to zoom (trackpad pinch / Ctrl + wheel on desktop), centred on the
  fingers; box is `touch-none` so the page does not scroll or zoom instead.
- **"How you're related" lives in the Family card**: a Family | Relation switch in its header (only when the profile is
  someone else connected to the viewer; icon-only on phones). Relation view = the chain from the viewer (`RelationChain`,
  client): rows (avatar, full name + **relation tag** to the viewer (Father, Dada, Kaka …), gender · **generation**
  ("1st generation above / below", "Same generation") · village). Cards step right **10px per generation away** from the
  viewer (max 4); the **joint is an SVG curve from under the previous avatar to over the next one** — top-left →
  bottom-right going further away, top-right → bottom-left coming back, straight when level — dots at both ends, the step
  ("’s father" / "ના પિતા") beside it. Chains over 6 people fold the middle behind "Show N more"; summary with the kinship
  word when known. Every blood relative gets a tag: exact paths from KIN_TERMS, longer ones a "distant" term by
  generation / side / gender (lib/kinship.js farTerm: Kaka (distant), Dadi / Baa (distant), Sister (distant) …;
  gu "(કુટુંબી)"); their spouse gets the matching term (Kaki, Fuva, Bhabhi …); in-laws' relatives stay untagged.
  Before naming, a parent's spouse counts as a parent and a spouse's child as a child (father → wife = Mother), since
  families often link only the father and his wife.
- Married woman in the add popup (`MarriedName`): **ask only unknown parts** — known ones (a daughter's father, a sister's
  father, a wife's / mother's husband) post hidden, previewed in one line with "Change". A woman's child's father = her
  linked husband, else the husband named in her married name (her middle name + surname).
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

- **Group About tab**: two columns like a fundraise's About (lg: main + 22rem / xl: 26rem side) — About card left; its History (admins only, collapsed <details>, like the fundraise History) under it; Team
  card and Danger zone on the right (stacked on phones).
- **Group Team card** (About tab, like the fundraise Team card): everyone who is admin / sub-admin or holds task
  roles, with role badges; header "Add to team" (MemberPicker + tick boxes) for the group's leaders; row ⋮ → Edit
  roles, Remove from team (they stay in the group). Tick boxes: Admin · Sub-admin (one at most, admins only; ticking one
  greys the tasks — "admins and sub-admins already do every task") · Members · Fundraise · Meetings · Group details ·
  Discussion, each with a hint (components/groups/group-team-panel.jsx). The Members tab shows the task roles as badges
  only; its ⋮ keeps Change role › and Remove.

- **English ↔ local-language pairs** (a field and its auto-filled Gujarati twin): always together in ONE lightly
  shaded box — `translationPair` (components/ui/field.jsx: bg-surface-bggray/60 + ring). NameFields = one box per name
  part — on phones English | local side by side (grid-cols-2), from sm up stacked (three boxes per row); add-relative
  dialog the same; BilingualName = one box spanning the grid row (`side` = the two side by side);
  add-relative dialog and the surname manager too. Any new pair must use it.

## Public & print

- **Privacy policy**: public /privacy-policy (proxy.js allows it) and Settings → About (everyone; group "App"): one card — "Designed and developed
  by" Qwery Technolabs / Manthan Kanani / tel link + "contact for any issue or app development" (lib/legal DEVELOPER),
  then two plain links: Privacy policy (public page, new tab) · Open-source licences (link-styled toggle, hidden by
  default; the table appears below — components/settings/about-links.jsx). The policy text: components/legal/privacy-policy.jsx over lib/legal.js (en + gu). lib/legal.js must change WITH the app whenever what it stores, shows or sends changes.
- **Address** (member page): the address itself is the link — navy theme colour (text-primary), underlined — opening Google Maps (search); a plain
  grey copy icon beside it (no background). No Directions button. components/members/address-actions.jsx; the city is
  added to the map search when the address lacks it.
- Public pages: navy header, Samaj logo + name, language toggle on navy.
- Public fundraise / Mandal page actions: icon-only blue squares (bg-primary, size-9), Download PDF then (a Mandal) Filters at
  the far right; a filter count sits as an orange dot on the corner. A "back to the list" inside a strip is a round ← button
  (tooltip = its label), never a text link squeezed beside the title.
- PDF/print is an **icon-only** button (`FileDown`) wherever it appears; print CSS keeps background
  colours (`print-color-adjust: exact`).
- **Page breaks (all print pages, globals.css @media print)**: tables FLOW across pages — never `break-inside: avoid`
  on a section / table / wrapper (Chrome then moved the whole table and left a blank first page), and no scroll box
  around a printed table (`print:overflow-visible` — a scroll container cannot split). Rows never split (`tr`),
  headings and `.print-keep-next` stay with what follows, `thead` repeats on every page.
- **Mandal print** (MandalPrint — the app's /fundraise/[id]/print and the public /p/[token]/print): chip rows
  Print (one): By contributors (default) · By schedules · Expenses; Print includes: All or any schedule dates
  (multi-select, `?schedule=4,7`; All clears them); NO date range in the Mandal print (`mandalPrintFilters` drops one
  from the URL — the multi-select schedules are the filter); Show (By schedules only): Everyone ·
  Came only · Absent only. By contributors / Expenses = the fundraise Statement tables over the chosen money
  (mandalLedger + mandalStatement); By schedules = MandalScheduleSheets (tables styled like the Statement: rounded
  border, grey bg-surface-login head and total row, px-4 cells). Defaults by mode (lib/mandal-filters MANDAL_MODES):
  public = latest schedule + Came only, app = all + Everyone.
  A schedule nobody came to (upcoming / never marked) is left out of the chips and the sheets — except on Expenses.
  Sheet total under "Came": just `came/total` (20/35).
- Mandal public page (/p/[token]): Show chips + the schedule sheets of the filter (latest schedule by default) +
  totals & Expenses of the same selection; its Filter pop-over picks one schedule or all + a range.
- **Filter loaders**: filter chips that are links use `ChipLink` (components/ui/chip-link.jsx — ✓ when on, a spinner via
  `useLinkStatus` while loading); the Mandal Filter pop-over navigates in a transition with a spinner on Apply / the button.
- Fundraise print pages (/fundraise/[id]/print, /p/[token]/print): a no-print "Include in print" chip row under
  the toolbar — By contributor / Contributions / Expenses, toggled by links to `?show=a,b` (default Contributions only;
  the last one on can't be switched off). Totals always print.
- Statement (print / public): payment mode = a coloured pill per mode (cash emerald, UPI violet, bank sky, cheque amber,
  other slate, Not paid rose); a Not paid amount and the Pending total are rose-700.
- Never `overflow-x: hidden` on html/body — it makes body a scroll box and long pages stop scrolling; use `clip`.

## i18n in UI
- Name fields say which script they take: English ones "First name (English)" (`lang.en`), local ones "First name (ગુજરાતી)".

Full rules and the Gujarati glossary: the **parivar-i18n** skill.
Every visible string comes from `t()`; add keys to **both** `en.js` and `gu.js`. Plurals use
`{ one, other }`. Gujarati for roles: Member = સભ્ય.

## Changelog of decisions (append when the user sets a new "everywhere" rule)

- Filters → 2 columns, header/footer fixed, body scrolls; Clear/Apply in footer. The Filters button is icon-only on phones (text from sm). Without a search box (calendar) it stays at the right end of the same row on phones (ToolbarRow inline). Clear ONLY in that popup footer — never a loose "× Clear" in the toolbar.
- Kebab: white bg, darker border, grey dots; page kebab at the right of the title row.
- Single create actions stay buttons; kebab only for several/non-create actions.
- Back link lives in the top header; history-back on phones.
- No datalists; PickOrType / TagSelect / select instead.
- Picture-left / fields-right for any form with an avatar.
- Destructive admin actions below tables, not in toolbars.
- Card-level "add" buttons (e.g. Add to team) go in the card header's `actions`, compact `btn-secondary h-8 text-xs`.
- Active sidebar item: navy-soft background, orange bar, **orange-400 icon**.
- Sidebar logo row: same `border-white/10` bottom line as the header.
- Destructive actions (clear discussion history, status, archive, delete) live ONLY in the About tab's Danger zone
  card (`<Card tone="danger">`: red border + solid red header, white title) — a sentence saying what it does + a confirm — never as a button in the Discussion or other working tabs.
- Long forms grouped into FormPart sections; row lists compact with popup edit; example placeholders on name fields.

## Maintaining the skills

The project skills live in `.claude/skills/` (parivar-design, parivar-dev, parivar-db, parivar-i18n).
They are **meant to change**: whenever the logic, a rule, a component or a convention changes —
especially when the user says "apply this like this" for several places — edit the matching SKILL.md
in the same piece of work (add the rule, fix what is now wrong, drop what no longer applies), and say so
in the reply. Code and skills must never disagree.
