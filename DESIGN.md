# Design system — Parivar App

A portable description of how this app looks and is built, so the same design can
be rebuilt somewhere else without re-deriving it. Everything here is taken from
the running codebase, and the numbers were measured rather than estimated.

**This is the portable extract. It does not replace `.cursor/rules/*.mdc`** —
those hold the per-area detail and the failure each rule was written after. Read
`ui.mdc` when working *in this repo*; read this when taking the design *out* of it.

---

## 0. The stack, and how to start a project on it

**Build it in Next.js (App Router) + Tailwind v4 + shadcn, in JavaScript.** That
is a requirement of this design, not a preference — the token layering in §1 is
Tailwind v4's CSS-first `@theme`, which has no equivalent in a v3 config file, and
every component recipe below is a shadcn-style wrapper over a Base UI primitive.

**JavaScript, not TypeScript.** `.js` and `.jsx` throughout, types expressed as
JSDoc on exported functions (`@param {{ checked: boolean }} props`). Every snippet
in this document is copy-pasteable as-is because of that. If you scaffold with
TypeScript you will spend the first day converting this file instead of using it.

### Versions this is written against

| Package | Version | Note |
| --- | --- | --- |
| `next` | 16.2.x | App Router. `params`/`searchParams`/`cookies()` are **async**. |
| `react` / `react-dom` | 19.2.x | |
| `tailwindcss` | ^4 | **No `tailwind.config.js`** — theme lives in CSS. |
| `@tailwindcss/postcss` | ^4 | The only PostCSS plugin. |
| `shadcn` | ^4 | CLI; components are generated into your repo, not imported. |
| `@base-ui/react` | ^1.6 | The primitives shadcn wraps here (`Dialog`, `Menu`, `Combobox`). |
| `lucide-react` | ^1.25 | The only icon set. |
| `sonner` | ^2 | Toasts. |
| `clsx` + `tailwind-merge` | — | `cn()`; `class-variance-authority` for variants. |
| `next-themes` | ^0.4 | Only if you actually ship dark mode — see §11. |

### Scaffold

```bash
npx create-next-app@latest my-app --js --app --tailwind --eslint --src-dir --import-alias "@/*"
cd my-app
npx shadcn@latest init            # answer: JavaScript (not TSX), CSS variables YES
npx shadcn@latest add button card dialog input label sonner
npm i @base-ui/react lucide-react clsx tailwind-merge class-variance-authority
```

### The four config files, in full

`package.json` — **`"type": "module"`**. Every source file is ESM and every config
is `.mjs`; a CommonJS `.js` with `require`/`module.exports` will not load.

`jsconfig.json` — the `@/` alias, and nothing else. No `tsconfig.json` anywhere.

```json
{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }
```

```js
// postcss.config.mjs — Tailwind v4 needs exactly this.
const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
```

`components.json` — the shadcn contract. **Strict JSON: no comments**, so the
annotations are below it rather than inside it.

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "rsc": true,
  "tsx": false,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "utils": "@/lib/utils",
    "hooks": "@/hooks"
  }
}
```

- **`"tsx": false`** — generates `.jsx`, not `.tsx`. This is the JavaScript switch.
- **`"tailwind.config": ""`** — empty on purpose. Tailwind v4 has no config file;
  pointing this at one makes the CLI write v3-shaped output.
- **`"tailwind.css"`** — the file holding `@theme`, which the CLI appends tokens to.
- **`"rsc": true`** — generated components assume server components by default and
  add `'use client'` only where a primitive needs it.
- **`"cssVariables": true`** — **check this twice.** With it off, shadcn writes
  fixed colour classes into every generated component, and the whole token
  mechanism in §1, including the one-class theme retarget, silently does nothing.

### Directory shape

```
src/
├── app/                 routes (App Router). globals.css lives here.
│   ├── (group)/         a route group = its own layout + gate + theme class
│   └── api/             route handlers
├── components/
│   ├── ui/              shadcn-generated primitives — edited, not reinstalled
│   └── <feature>/       composed components, grouped by area
├── lib/                 logic, db access, pure helpers. Server-only unless stated.
└── proxy.js             route protection (Next 16 replaces middleware.js)
```

`@/` → `src/`. **`lib/` modules that touch the database are server-only** and must
never be imported, even transitively, into a `'use client'` component.

### Scripts

The `scripts` block of `package.json`:

```json
{
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "node --max-old-space-size=1536 node_modules/next/dist/bin/next build",
    "start": "next start",
    "lint": "eslint"
  }
}
```

The explicit heap size is not decoration: a Next 16 production build of a
component-heavy app OOMs on a small VPS with the default. Raise it locally, keep
the deploy target's real limit in the committed script.

### Before writing any Next code

Next 16 changed enough that training data and blog posts are actively misleading.
Read `node_modules/next/dist/docs/` for the version you installed. The three that
catch people immediately: **`params`, `searchParams` and `cookies()` are
Promises** (`const sp = await searchParams`), **`middleware.js` is now
`proxy.js`**, and **error boundaries use `unstable_retry`, not `reset`**.

---

## 1. Token layers — the one rule that makes theming work

Three layers, and the boundary between them is the whole mechanism:

```
@theme inline { }   ← LITERALS. Fixed brand values. Cannot be overridden downstream.
:root { }           ← SEMANTIC. What a role means right now. Overridable.
.theme-x { }        ← A SCOPE that retargets the semantic layer. One class, whole subtree.
```

```css
@theme inline {
  /* literal, immutable */
  --color-brand-navy: #172f56;
  --color-brand-orange: #f79812;

  /* semantic, pointing at :root so a scope can move them */
  --color-primary: var(--primary);
  --color-accent: var(--accent);
  --color-ring: var(--ring);
}

:root {
  --primary: #172f56;
  --accent: #f3f9ff;
  --ring: #66aae1;
}

/* A second area of the app, same components, different colour. */
.theme-billing {
  --primary: #003294;
  --accent: #eef3ff;
}
```

**The rule that follows from this, and it is the one people break:** shared chrome
must use **semantic** tokens (`text-primary`, `bg-accent`, `ring-ring`), never
literals (`text-brand-navy`). A literal in `@theme` cannot be overridden by a
descendant, so the moment a shared component hard-codes one it stays navy inside
the themed scope while everything around it changes, and the mechanism has a hole
in it. Components that need to work in both scopes take a `color` prop defaulting
to the literal, so existing callers are unaffected and themed callers pass
`text-primary`.

Use a literal only where the value *is* the brand regardless of scope — here that
is the orange accent, which stays orange in every theme.

---

## 2. Colour, with measured contrast

### Palette

| Token | Value | Role |
| --- | --- | --- |
| `brand-navy` | `#172f56` | Primary. Sidebar, headings, primary buttons. |
| `brand-navy-soft` | `#30466a` | Hover/active inside the navy sidebar. |
| `brand-orange` | `#f79812` | The accent. Active states, switches, selected tabs. |
| `brand-orange-dark` | `#e6890f` | Orange hover. |
| `brand-blue` | `#66aae1` | Focus ring. |
| `brand-blue-deep` | `#003294` | Secondary area primary (billing). |
| `ink` | `#041527` | Body text at full strength. |
| `ink-gray` | `#475467` | Secondary text, captions, table headers. |
| `surface-border` | `#d3d5d8` | Every border. |
| `surface-bggray` | `#e9eaf3` | Table head, inset strips. |
| `accent` | `#f3f9ff` | Row hover, soft fills. |

### Contrast — computed, WCAG 2.1

| Pair | Ratio | Verdict |
| --- | --- | --- |
| ink `#041527` on white | **18.39:1** | AAA |
| navy `#172f56` on white | **13.31:1** | AAA |
| white on navy | **13.31:1** | AAA |
| navy on `accent` `#f3f9ff` | **12.56:1** | AAA |
| white on billing blue `#003294` | **11.15:1** | AAA |
| navy on `surface-bggray` | **11.11:1** | AAA |
| ink-gray `#475467` on white | **7.69:1** | AAA |
| ink-gray on `surface-bggray` | **6.42:1** | AA |
| orange `#f79812` on navy | **5.99:1** | AA |
| blue `#66aae1` on navy | **5.33:1** | AA |
| **orange on white** | **2.22:1** | **FAILS** |
| **white on orange** | **2.22:1** | **FAILS** |
| **orange-dark on white** | **2.64:1** | **FAILS** |
| **blue `#66aae1` on white** | **2.50:1** | **FAILS** |
| `surface-border` on white | 1.47:1 | not text — a border, ≥3:1 not required of it |

**Three rules fall straight out of that table:**

1. **Orange is never text on white, and white is never text on orange.** Both are
   2.22:1. Orange is a *state* colour — a switch track, a 2px tab underline, a
   filled pill that carries an icon, a dot. Where an orange surface must carry a
   label, the label is navy, not white.
2. **`brand-blue` is a ring, not a colour for text.** 2.50:1 on white. It works on
   navy (5.33:1), which is where it appears.
3. **Secondary text is `ink-gray`, and it stops being AAA on tinted surfaces.**
   7.69:1 on white but 6.42:1 on `surface-bggray` — still AA, so caption text in a
   table head is fine, but do not go lighter than `#475467` anywhere.

Non-text UI (borders, dividers, disabled tracks) is exempt from 4.5:1, but any
control whose *state* is signalled only by colour needs 3:1 against its
surroundings — which is why the switch track is `surface-border` when off and
solid orange when on, not two tints of the same hue.

### Semantic status colours

Fixed map, exported from one module and imported everywhere — never re-declared
per table, or two screens disagree about what amber means:

```
done → green   pending → amber   crawling → blue
error/unreachable → red   blocked → purple   paused → gray
```

Money, in a financial table: received `text-emerald-700`, outstanding
`text-amber-700`, spend `text-rose-700`, negative net `text-rose-700`.

---

## 3. Typography

```css
--font-sans: Geist, system-ui, sans-serif;   /* next/font/google, self-hosted */
--font-mono: Geist Mono;
--font-heading: var(--font-sans);            /* deliberately the same */
```

One family. A second display face was never added because every screen here is
dense data, and a heading face buys nothing in a table.

### The real scale (occurrences across the codebase)

| Class | Uses | Role |
| --- | --- | --- |
| `text-sm` (14px) | 719 | **The default.** Body, table cells, buttons, inputs. |
| `text-xs` (12px) | 522 | Captions, table headers, hints, badges, dense rows. |
| `text-[11px]` | 75 | Uppercase micro-labels (`tracking-wide text-ink-gray`). |
| `text-2xl` (24px) | 63 | Stat-card numbers. |
| `text-base` (16px) | 22 | Page titles in a compact header. |
| `text-lg` (18px) | 21 | Section titles on a roomy page. |

Read that as: **two sizes do 93% of the work.** If a new element wants a size not
on this list, the layout is usually the thing that is wrong.

### Weights

| Class | Uses | Role |
| --- | --- | --- |
| `font-semibold` | 450 | Headings, table headers, the emphasised value in a pair. |
| `font-medium` | 409 | Buttons, labels, links, anything interactive. |
| `font-normal` | 19 | Rare — the default, so it is almost never written. |
| `font-bold` | 13 | Almost never. Prefer semibold + colour. |

**There is no light weight anywhere**, and that is deliberate: at 12–14px on a
data screen, a 300 weight loses legibility before it gains elegance.

### The caption idiom

The single most repeated text pattern in the app:

```html
<span class="text-[11px] uppercase tracking-wide text-ink-gray">Pages sent</span>
```

Micro size + uppercase + letter-spacing + `ink-gray`. Use it for column labels,
stat-card captions and section eyebrows; do not use uppercase for anything a
person has to *read* rather than *scan*.

---

## 4. Shape, spacing, elevation

```css
--radius: 0.625rem;          /* 10px — the base everything derives from */
--radius-sm: calc(var(--radius) * 0.6);   /* 6px  */
--radius-md: calc(var(--radius) * 0.8);   /* 8px  */
--radius-lg: var(--radius);               /* 10px */
--radius-xl: calc(var(--radius) * 1.4);   /* 14px */
```

Measured usage: `rounded-md` (435) for controls, `rounded-lg` (201) for panels and
cards, `rounded-full` (150) for pills, badges and switch tracks. `rounded-xl` (12)
for the largest cards only.

**Control heights — three, and no others:**

| Height | Uses | When |
| --- | --- | --- |
| `h-9` (36px) | 128 | **Default.** Filter fields, inline buttons, search boxes. |
| `h-8` (32px) | 104 | Dense option rows, in-card buttons, secondary actions. |
| `h-10` (40px) | 101 | The primary field on a tool's main form. |

Elevation is nearly flat: `shadow-sm` on cards and raised segments, no shadow on
anything inline. Depth is carried by the 1px `surface-border` and the
`surface-bggray` fill, not by shadow.

Spacing runs on Tailwind's 4px scale; the recurring values are `gap-2` (8px)
inside a control cluster, `gap-3`/`gap-4` between controls, `p-4 sm:p-6` for page
padding, `px-4 py-3` for table cells and `px-4 py-2` for dense ones.

---

## 5. Responsiveness

Breakpoints are Tailwind's defaults; in practice **`sm` (640px) carries almost
everything** and `xl` (1280px) splits a page into two columns. Each rule below
exists because its absence broke a real screen.

### The page must never scroll sideways

```css
html, body { overflow-x: hidden; max-width: 100%; }
```

A backstop, not a licence. The shell is `h-screen overflow-hidden`, `<main>` is
`min-w-0 overflow-x-hidden`, and **wide content scrolls inside its own
`overflow-x-auto` container**. A horizontal scrollbar on the window is always a
bug: it shifts the fixed header out of view and leaves dead space beside it.

### `min-w-0` is load-bearing

`min-width: auto` — the flex/grid default — means "never shrink below your content",
and even a `truncate`d line contributes its full string to that minimum. **One
`auto` minimum anywhere in the chain is enough to push a page sideways.** Put
`min-w-0` on every flex/grid child that contains text of unknown length, the
column, the row and the wrapper alike.

### The standard form row

```html
<form class="flex flex-col gap-2 sm:flex-row sm:items-center">
  <div class="relative min-w-0 flex-1">
    <input class="h-10 w-full rounded-md border border-surface-border px-3 text-sm" />
  </div>
  <button class="h-10 w-full shrink-0 justify-center rounded-md bg-primary px-4
                 text-sm font-medium text-white sm:w-auto">Search</button>
</form>
```

- **Never put a fixed `min-w-*` on the field.** Inside `flex-wrap` it cannot
  shrink, so the button drops to its own line on a tablet and the panel scrolls
  sideways on a phone.
- **An input is never a bare flex child** carrying `w-full min-w-0 flex-1` — it
  goes inside its own `relative min-w-0 flex-1` wrapper.
- **A primary button inside a `flex-col` needs `w-full justify-center … sm:w-auto`**,
  or `align-items: stretch` stretches it and the label sits hard left.

### Two columns, in flexbox

```css
.grid { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; }
.grid > * { flex: 1 1 100%; min-width: 0; }
@media (min-width: 900px) { .grid > * { flex: 1 1 calc(50% - 8px); } }
```

`calc(50% - 8px)` is half the row minus half the gap — that is what lets two fit.
With `flex-grow: 1` a card with no partner fills the row instead of leaving half
of it empty; use `flex: 0 1` instead if you want a rigid grid.

### In a table cell: `max-w-*` + `break-words`, NEVER `truncate`

Under `table-layout: auto` a cell's `max-width` is a *suggestion* — the column is
sized by its minimum content width, and `truncate` sets `white-space: nowrap`,
which makes that minimum the entire string. One long value then widens the table
past its scroll container and the page overflows. `truncate` is fine outside a
table, where a block element's `max-width` is real.

### Segmented controls wrap; tabs scroll

A segmented control must **wrap** — every segment `shrink-0`, and whatever would be
pushed off the edge takes `w-full sm:ml-auto sm:w-auto` so it gets its own line on
a phone. The exception is a segmented set of *tabs*, which scrolls horizontally,
because a wrapped tab bar stops reading as one control.

### Past ~5 options, drop the segmented control

Eleven segments wrap into an unreadable block on a phone. Use a real `<select>`
with `<optgroup>`.

### Combining several controls into one responsive row

The hardest responsive case is not one control — it is a toolbar of four that must
stay one cluster from 360px to 1600px. The recipe:

```html
<!-- The page row: tabs left, the control cluster right, both allowed to wrap. -->
<div class="flex flex-wrap items-center justify-between gap-3">
  <div class="inline-flex rounded-lg border border-surface-border bg-white p-0.5">…tabs…</div>

  <!-- The cluster. w-full below sm so it gets its own line; content-sized above. -->
  <div class="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
    <form class="flex w-full items-center gap-2 sm:w-auto">
      <div class="relative min-w-32 flex-1 sm:min-w-72">
        <input class="h-9 w-full rounded-md border border-surface-border pl-8 pr-3 text-sm" />
      </div>
      <button type="button" class="h-9 shrink-0 …">Crawl</button>   <!-- filter 1 -->
      <button type="button" class="h-9 shrink-0 …">Site</button>    <!-- filter 2 -->
      <button type="submit" class="size-9 shrink-0 …">🔍</button>   <!-- the commit -->
    </form>
  </div>
</div>
```

Five decisions in that markup:

1. **Order is the order of use**: type → narrow → go. The button that *runs* the
   search is last, after the controls that change what it will search. It is worth
   restructuring markup to get this right — putting submit immediately after the
   input is the natural way to write it and the wrong way to read it.
2. **The whole cluster is one `<form>`**, so it wraps as a unit. As siblings, the
   search and the filter button wrap independently and the filter drops below the
   submit on a narrow window.
3. **Anything inside that form that is not the submit must be `type="button"`** —
   a default-type button submits.
4. **`min-w-32` on the field is the wrap valve.** With `min-w-0` the input keeps
   shrinking to a sliver beside its own buttons, because `flex-wrap` only moves a
   child to the next line once it cannot shrink further. With a floor, the buttons
   take a second line instead — two tidy rows beat one unusable one. Above `sm`
   the floor becomes a comfortable `min-w-72`.
5. **`shrink-0` on every button**, or the labels compress before the input does.

Below `sm` the cluster is `w-full` (its own line, full width); from `sm` it is
`w-auto` and `flex-nowrap` so it sits hard right and stops reflowing as the
viewport grows.

---

## 6. Component recipes

### Form field — label, control, error, hint

Everything else in a form composes from this. Two exports, not a component that
owns the input: a `Field` wrapper and a `textInput(hasError)` class function. That
split is deliberate — the wrapper cannot know whether the control inside it is an
`<input>`, a `<select>`, a Combobox or three boxes in a row, so it never tries to
render it.

```jsx
export function Field({ label, error, hint, required = false, className = '', children }) {
    return (
        <label className={`block ${className}`}>
            {label && (
                <span className="mb-1 block text-xs font-medium text-ink-gray">
                    {label}
                    {required && <span className="ml-0.5 text-destructive">*</span>}
                </span>
            )}
            {children}
            {/* Error REPLACES the hint — two lines under one control is noise, and
                the hint is advice you no longer need once something is wrong. */}
            {error ? (
                <span className="mt-1 block text-xs font-medium text-destructive">{error}</span>
            ) : hint ? (
                <span className="mt-1 block text-xs text-ink-gray">{hint}</span>
            ) : null}
        </label>
    );
}

/** The one input class string. Error state is a BORDER + RING, never a fill. */
export function textInput(hasError) {
    return `h-9 rounded-md border bg-white px-3 text-sm text-primary outline-none
            ${hasError
                ? 'border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/30'
                : 'border-surface-border focus:border-ring focus:ring-2 focus:ring-ring/30'}`;
}
```

```jsx
<Field label="Invoice number" required error={e.invoiceNo} hint="Auto-numbered per financial year.">
    <input value={form.invoiceNo} onChange={…} className={`${textInput(!!e.invoiceNo)} w-full`} />
</Field>
```

Rules that come with it:

- **The whole thing is a `<label>`.** No `htmlFor`/`id` pairing to keep in sync, and
  the caption is part of the hit area.
- **Width is the caller's**, not the field's — `w-full` at the call site. A field
  that forces its own width cannot sit in a row of three.
- **Labels are `text-xs font-medium text-ink-gray`**, above the control. Not
  floating, not inline: at 12–14px a floating label either overlaps the value or
  forces the control taller than the 36px rhythm.
- **Error styling is border + ring, never a background fill.** A red-filled input
  competes with the text you are trying to fix, and fails contrast on its own text.
- **The error message replaces the hint**, never stacks under it.
- A required marker is an asterisk in `destructive`; optional fields are unmarked.
  Marking the majority is noise.

For a **number pair** (min/max), a **range**, or any two controls that answer one
question, wrap them in one `Field` with one label and put the two inputs in a
`flex items-center gap-2` row — the pair is one thing the user chose, so it gets
one label and one error.

### Switch (the on/off control)

Used instead of a checkbox everywhere, for a consistent look. A `<button
role="switch" aria-checked>`, not an `<input>` — it needs a styleable track and a
label that is part of the hit area.

```jsx
export default function Switch({ checked, onChange, label, title, color = 'text-brand-navy' }) {
    return (
        <button type="button" role="switch" aria-checked={checked} title={title}
            onClick={() => onChange(!checked)}
            className={`inline-flex cursor-pointer items-center gap-2 text-sm font-medium ${color}`}>
            <span className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors
                ${checked ? 'bg-brand-orange' : 'bg-surface-border'}`}>
                <span className={`inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform
                    ${checked ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
            </span>
            {label}
        </button>
    );
}
```

The `color` prop is the literal-vs-semantic escape hatch from §1.

On a **coloured bar** (a navy header), use a bigger track with an explicit
On/Off label — a native checkbox on a dark surface reads as part of the page
behind it:

```html
<label class="flex items-center gap-1.5 cursor-pointer">
  <input type="checkbox" class="absolute opacity-0 w-0 h-0" />
  <span class="toggle-track"><span class="toggle-knob"></span></span>
  <span class="text-[11px] text-white/85">On</span>
</label>
```
```css
.toggle-track { position: relative; width: 32px; height: 18px; border-radius: 9px;
                background: rgb(255 255 255 / .25); transition: background .15s; }
.toggle-knob  { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px;
                border-radius: 50%; background: #fff; transition: transform .15s; }
input:checked + .toggle-track { background: var(--orange); }
input:checked + .toggle-track .toggle-knob { transform: translateX(14px); }
input:focus-visible + .toggle-track { outline: 2px solid #fff; outline-offset: 2px; }
```

The visually-hidden input keeps it keyboard- and screen-reader-native; the focus
ring is moved to the track because the input has no box of its own.

### Select — when to use which

| Options | Control |
| --- | --- |
| 2–3, short labels | Segmented control |
| 2–3, where "no" is a real answer | **Tri-state** segmented (`Any / Yes / No`) |
| 4–10, fixed | Native `<select>` |
| 10+, or needs search / a second line per option | **Combobox** |
| Any count, many chosen at once | **TagSelect** (multiselect) |

**Do not reach for `<datalist>`.** The browser decides how it looks and how it
matches, it cannot show a second line per option, it gives no keyboard state you
can style, and on several browsers it will not open without typing.

**Tri-state, not a checkbox**, wherever "no" is a real and common answer — a
checkbox can only say *yes* or *don't care*, so "show me the ones that DON'T" is
unaskable.

**Segmented control markup**, and note the active segment is *not* solid navy —
a row of filled navy pills reads as a header rather than a control:

```html
<div class="inline-flex rounded-md bg-surface-bggray/70 p-0.5">
  <button class="h-8 rounded px-2.5 text-xs font-medium
                 bg-white text-brand-navy shadow-sm ring-1 ring-surface-border">Any</button>
  <button class="h-8 rounded px-2.5 text-xs font-medium text-ink-gray
                 hover:text-brand-navy">Yes</button>
</div>
```

On a **navy** bar the same control inverts: active is `bg-primary text-white`,
inactive `text-ink-gray hover:bg-accent`.

### Combobox (searchable single select)

Async, so the source is a request rather than a list shipped into the page — the
list only grows, and matching often has to reach fields the label does not show.

```jsx
<Combobox
  value={partyId}                    // the value the form holds
  valueLabel={partyName}             // what to show when closed
  onSelect={(opt) => set(opt?.value ?? '')}
  fetchOptions={(q) => fetch(`/api/parties?q=${encodeURIComponent(q)}`).then(r => r.json())}
  placeholder="Search…"
/>
```

Behaviours that make it feel right, each of which is a bug if missing:

- The input shows the **selected label when closed** and the **typed query when
  open** — so opening does not wipe the selection, and closing without choosing
  restores it.
- The **empty-query list is fetched once on first open**, so it shows something
  immediately instead of an empty popup.
- It follows an **externally changed value** (form reset, edit loading) with the
  render-time previous-value pattern, not an effect.
- Keyboard: ↑/↓ move an `active` index, Enter selects, Escape closes and restores.

### TagSelect (multiselect from a fixed list)

Chips inside the field plus a searchable popup. At 30+ options a plain checkbox
list stops being scannable; at 5 options a segmented control is better than either.

```jsx
<TagSelect
  label="Top country"
  options={[{ value: 'US', label: 'United States', count: 814 }]}
  value={selected}                   // string[] — VALUES, not objects
  onChange={setSelected}
  placeholder="Any country"
  emptyText="No country matches that."
/>
```

Three decisions worth copying:

- **It deals in option VALUES (strings), not option objects**, because the values
  are what a URL carries and every caller is URL-backed.
- **A value no longer in the list still renders**, as its own code — a filter that
  is demonstrably still applied must not silently vanish from the UI.
- **Show a count only where it helps you choose.** "United States 814" vs
  "Anguilla 1" is how you pick a country; a number beside "Guest post" in a
  4-option enum is decoration competing with the label you are reading.

### TagInput (free-text chips)

The sibling of TagSelect, and deliberately a different component: this takes
*anything*, that takes only what the list offers. Add on Enter / comma / newline /
paste, remove with × or Backspace, case-insensitive de-dupe, optional `max`.

Splitting a paste on `[\n,]+` is what makes "paste a column out of a sheet" work.

### One paste, many rows

Where a list of values is typed one row at a time, let a multi-line paste become
one row per line. Intercept `onPaste` **only** when the clipboard holds a newline
or a tab, so an ordinary paste keeps the browser's undo, caret and `maxLength`:

```js
const onPaste = (ev, idx) => {
    const text = ev.clipboardData?.getData('text/plain') ?? '';
    if (!/[\r\n\t]/.test(text)) return;          // ordinary paste — the browser's job
    ev.preventDefault();
    const el = ev.currentTarget;
    const before = el.value.slice(0, el.selectionStart ?? el.value.length);
    const after  = el.value.slice(el.selectionEnd ?? el.value.length);
    const lines = text.split(/\r\n|\r|\n/).filter((l) => l.trim() !== '');
    lines[0] = before + lines[0];                 // splice AT THE CARET, like a sheet
    lines[lines.length - 1] += after;
    spreadRows(idx, lines);
};
```

Two columns (tab-separated, from a spreadsheet) can fill two fields. Decide the
shape **once for the whole block**, never per line — one line that happens to end
in a number must not be split while its neighbours are not.

### Filter popover vs dialog

A filter panel is a **popover anchored to its trigger**, not a centred dialog: it
belongs to the control you pressed, and a modal for a filter steals the page.
Use a dialog only when the panel has ~5+ fields that need the width.

A dialog's width **must** be written `sm:max-w-…`, never `max-w-…`, if the base
component's own class list ends with an `sm:` width — an unprefixed class from the
caller loses to it at every breakpoint above `sm` and the dialog renders tiny. A
form dialog also wants `max-h-[92vh] overflow-y-auto`, or it grows past the
viewport and hides its own Save button.

### Popup mechanics — the lightweight anchored popover

For a small menu or panel that belongs to one trigger, this hand-rolled idiom is
used rather than a primitive library. It is ~20 lines, has no positioning engine
to fight, and behaves correctly:

```jsx
const [open, setOpen] = useState(false);

<div className="relative">
    <button type="button" onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu" aria-expanded={open}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-surface-border
                   bg-white px-3 text-sm font-medium text-primary hover:bg-accent">
        Filters
        {/* A red dot, not "(2)" — a count and a dot side by side read as two
            different kinds of control. The count lives in aria-label. */}
        {activeCount > 0 && (
            <span aria-hidden className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full
                                          bg-destructive ring-2 ring-white" />
        )}
    </button>

    {open && (
        <>
            {/* CLICK-AWAY LAYER — a full-screen transparent button under the
                popup. One element, no document listener to add and forget to
                remove, and it swallows the click that closes rather than letting
                it also press whatever was underneath. */}
            <button type="button" aria-hidden tabIndex={-1}
                onClick={() => setOpen(false)}
                className="fixed inset-0 z-10 cursor-default" />

            <div role="menu"
                className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-md
                           border border-surface-border bg-white py-1 shadow-lg">
                …
            </div>
        </>
    )}
</div>
```

The five details that make it feel native:

1. **`relative` parent, `absolute` popup** — no portal, no positioning library.
   The trigger and its popup move together when the page scrolls.
2. **`right-0`, not `left-0`**, for a trigger on the right of a toolbar, or the
   panel hangs off the viewport on a phone.
3. **Two z-layers**: the click-away at `z-10`, the popup at `z-20`. One value for
   both and the panel is unclickable.
4. **Escape closes it**, and focus returns to the trigger. Add
   `onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}` on the wrapper.
5. **It closes itself when the URL changes** if its contents navigate — the
   requested thing has happened, and leaving the panel up to be dismissed by hand
   is a second job for the user.

Reach for a primitive library's `Menu`/`Popover` when you need collision
detection, nested submenus, or a typeahead. Reach for a `Dialog` only when the
panel is modal — a filter is not.

**Width on a phone:** an anchored panel wider than ~280px needs
`w-[min(20rem,calc(100vw-2rem))]`, or it is clipped. A panel that genuinely needs
more width should become a centred dialog below `sm`.

### Mini menu (the kebab, ⋮)

The same idiom, narrowed: a `size-9` icon button, `role="menu"` on the panel and
`role="menuitem"` on each row.

```jsx
<button className="flex size-9 items-center justify-center rounded-md text-ink-gray
                   hover:bg-accent hover:text-primary" aria-label="More actions">
    <MoreVertical className="size-4" />
</button>
…
<div role="menu" className="absolute right-0 z-20 mt-1 w-52 rounded-md border
                            border-surface-border bg-white py-1 shadow-lg">
    <button role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left
                                        text-sm text-primary hover:bg-accent">
        <Download className="size-4 text-ink-gray" /> Export CSV
    </button>
    <div className="my-1 border-t border-surface-border" />
    <button role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left
                                        text-sm text-destructive hover:bg-destructive/10">
        <Trash2 className="size-4" /> Delete
    </button>
</div>
```

- **Items are left-aligned text with a leading icon**, icon in `ink-gray` so the
  label leads. A destructive item is the only coloured one, and it goes last,
  after a separator.
- **Keep every kebab in an app identical.** They appear in table rows, card
  headers and toolbars; three variants read as three different controls.
- A kebab holds **secondary** actions only. The primary action is a visible button.

### Megamenu

*Not present in this codebase* — the nav here is a sidebar with grouped links, so
this is derived from the same idioms rather than lifted from a screen. Treat it as
a starting point, not as something already proven here.

```jsx
<div className="group relative" onMouseLeave={() => setOpen(false)}>
    <button aria-haspopup="true" aria-expanded={open}
        onClick={() => setOpen((v) => !v)} onMouseEnter={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-1 px-3 text-sm font-medium text-primary">
        Tools <ChevronDown className="size-4 transition-transform group-aria-expanded:rotate-180" />
    </button>

    {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-0 border-t border-surface-border
                        bg-white shadow-lg">
            <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 p-6 sm:grid-cols-2 lg:grid-cols-4">
                {groups.map((g) => (
                    <div key={g.title} className="min-w-0">
                        <p className="mb-2 text-[11px] uppercase tracking-wide text-ink-gray">{g.title}</p>
                        <ul className="space-y-1">
                            {g.items.map((it) => (
                                <li key={it.href}>
                                    <Link href={it.href} className="block rounded-md px-2 py-1.5 text-sm
                                                                     text-primary hover:bg-accent">
                                        {it.label}
                                        {it.hint && <span className="block text-xs text-ink-gray">{it.hint}</span>}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    )}
</div>
```

Non-obvious parts:

- **It is full-bleed, not anchored to the trigger** — `left-0 right-0 top-full`
  on a `relative` *bar*, not on the button. A megamenu that lines up with one
  button reads as an oversized dropdown.
- **Open on hover AND on click**, close on `mouseleave` and on Escape. Hover alone
  is unusable on a touchscreen; click alone feels broken on a desktop nav.
- **Below `sm` there is no megamenu.** The same groups render as an accordion in
  the mobile drawer — a four-column grid inside a 360px popup is the thing this
  pattern is famous for getting wrong.
- **A group heading is not a link** unless every item under it is a subset of it.
- Delay closing by ~150ms so a diagonal mouse path to the second column does not
  dismiss it.

### Live control vs deferred draft

Two distinct interaction models, and mixing them is what makes a filter panel feel
broken:

- **Live** — a single control that navigates on change (a status dropdown). Right
  when one change is one intent.
- **Draft** — a panel that edits local state and applies on a button. Right when
  several controls make up one question; otherwise applying four filters is four
  round trips through the same popup.

A draft panel closes itself when the URL changes (the filter has been applied),
unless it is a many-filter panel, which stays open with an explicit *Done*.

### Filter plumbing — the URL is the state

Every filter, sort, page and view in this app lives in the query string. Nothing
is held in component state that a reload would lose, and nothing is fetched by the
client that the server could have rendered.

```jsx
'use client';
export default function StatusFilter({ param, options, pageParam = 'page' }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [pending, startTransition] = useTransition();
    const current = searchParams.get(param) || '';

    function select(value) {
        if (value === current) return;                  // no-op navigations are jank
        const params = new URLSearchParams(searchParams.toString());
        if (value) params.set(param, value);
        else params.delete(param);                      // the default is ABSENCE
        params.delete(pageParam);                       // a new filter → page 1
        const qs = params.toString();
        startTransition(() =>
            router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
        );
    }
    …
}
```

The six rules encoded there:

1. **`replace`, not `push`** — a filter is not a navigation. With `push`, Back
   walks every intermediate filter state instead of leaving the page.
2. **`scroll: false`** — re-filtering a table must not jump you to the top.
3. **Changing any filter resets the page param.** Otherwise you land on page 7 of
   a result set that now has two pages, and see an empty table you did not ask for.
4. **The default value is the absence of the parameter**, so one view has one URL.
5. **Read the params on the server**, render the rows there. The client component
   is the control, not the data.
6. **Every href builder on the page carries the full param set** — pagination
   links, sort links and view toggles each rebuild from `searchParams`, or page 2
   quietly drops the filter the count on screen was made under.

Server side, parse once into a shared helper so the page and the control cannot
disagree about what a param means, and **clamp rather than trust**:

```js
export function resolveFilters(sp = {}) {
    const span = String(sp.span ?? '') === 'month' ? 'month' : 'year';   // unknown → default
    const asked = Number.parseInt(String(sp.fy ?? ''), 10);
    const fy = Number.isInteger(asked) && asked >= 2000 && asked <= thisFy + 1 ? asked : thisFy;
    return { span, fy };
}
```

### Pagination, and storing rows-per-page in a cookie

**The page number is a URL param. The page SIZE is a cookie.** That split is the
whole design:

- A page number belongs to a link you can share — someone else opening it must see
  the same rows.
- A page size is a *personal preference* that should apply to every table in the
  app, survive reloads, and not clutter every URL you copy.

```js
// lib/tablePrefs.js — a pure module, imported by both client and server.
export const PER_PAGE_COOKIE = 'table_per_page';
export const PER_PAGE_OPTIONS = [10, 20, 50, 100];
export const DEFAULT_PER_PAGE = 20;
export const PER_PAGE_MAX_AGE = 60 * 60 * 24 * 365;   // a year — it should stick

/** Clamp anything to an allowed option. An old or forged value falls back. */
export function normalizePerPage(value) {
    const n = Number(value);
    return PER_PAGE_OPTIONS.includes(n) ? n : DEFAULT_PER_PAGE;
}
```

```jsx
// The control writes the cookie itself — no API route for a display preference.
function onChange(e) {
    document.cookie =
        `${PER_PAGE_COOKIE}=${e.target.value}; path=/; max-age=${PER_PAGE_MAX_AGE}; samesite=lax`;

    const params = new URLSearchParams(searchParams.toString());
    PAGE_PARAMS.forEach((p) => params.delete(p));   // EVERY page param, not just this table's
    router.push(qs ? `${pathname}?${qs}` : pathname);
    router.refresh();   // the URL may be unchanged; force the server to re-read the cookie
}
```

```jsx
// The server page reads it.
const perPage = normalizePerPage((await cookies()).get(PER_PAGE_COOKIE)?.value);
```

Five things that are easy to get wrong here:

- **`router.refresh()` is required.** If the URL did not change (you were already
  on page 1), a push alone re-renders nothing and the new size does not apply
  until the next navigation.
- **Clear *every* page param, not just this table's.** The cookie is shared, so
  changing the size re-windows every table on the page at once; leaving a second
  table on page 7 of a window that no longer exists strands the user.
- **The allow-list is the validation.** A stored value that is no longer offered
  (an old `500`) normalises back to the default instead of stranding someone on a
  size the UI cannot show.
- **The server clamp is pinned to the same list.** The cookie is user-writable —
  treat it as untrusted input, because a page size goes straight into `LIMIT`.
- **Page size is a query cost, not just a display choice.** Measured here: the
  same table took **2.9s at 500 rows against 0.9s at 100**, which is why the
  ceiling is 100. Export-style screens that genuinely need more keep their own
  `?perPage=` and deliberately do not import this module — a 500 chosen there must
  not ride the shared cookie onto every other table.

**Pagination controls**: previous/next plus first/last, current page and total
rendered as text, every link rebuilt from the full param set, and the whole row
hidden when there is one page. Disabled ends are `<span>`s, not disabled links —
a disabled anchor is still focusable and still announces as a link.

### Table

```html
<div class="overflow-hidden rounded-lg border border-surface-border bg-white shadow-sm">
  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-surface-border bg-surface-bggray/50 text-left
                   text-xs uppercase tracking-wide text-ink-gray">
          <th class="px-4 py-3 font-semibold">Domain</th>
          <th class="px-4 py-3 text-right font-semibold">Pages</th>
        </tr>
      </thead>
      <tbody>
        <tr class="border-b border-surface-border last:border-0 hover:bg-accent/40">
          <td class="px-4 py-3">…</td>
          <td class="px-4 py-3 text-right tabular-nums">…</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

- **Numbers are `text-right tabular-nums`.** Always. A column of proportional
  digits cannot be compared down the column.
- **An empty cell in a data row is an em dash, not `0`** — four zeroes read as "we
  measured this and it came to nothing", which for a period still in the future is
  not what happened.
- Row borders, not zebra striping. `hover:bg-accent/40` is the only row fill.

### The two shadows: sticky header, and refreshing

These are different problems and people conflate them.

**1. The sticky-header shadow** — the rule under a header that stays put while
rows scroll under it.

```html
<div class="overflow-hidden rounded-lg border border-surface-border bg-white shadow-sm">
  <div class="max-h-[calc(100dvh-20rem)] min-h-80 overflow-auto">
    <table class="w-full min-w-[1220px] text-sm">
      <thead>
        <tr>
          <th class="sticky top-0 z-10 bg-surface-login px-4 py-3 text-left text-xs
                     uppercase tracking-wide font-semibold text-ink-gray
                     shadow-[inset_0_-1px_0_var(--color-surface-border)]">Domain</th>
        </tr>
      </thead>
```

Four things, each of which is a bug if missed:

- **The sticky goes on every `<th>`, never the `<tr>`.** A sticky table row is not
  honoured.
- **The header background must be OPAQUE.** A translucent `bg-…/50` shows rows
  sliding *under* the header. Use the colour that tint resolves to over white
  (here `bg-surface-login`), not the tint itself.
- **The bottom rule is an `inset` box-shadow, not a border.** Tailwind's preflight
  sets `border-collapse: collapse`, and a collapsed border does not travel with a
  sticky cell — the underline simply disappears on scroll.
- **Cap the scroll box** (`max-h-*` with a `min-h-*` floor; min-height beats
  max-height, so the floor wins on a short screen). Without a cap the header has
  nothing to stick to, and worse, the horizontal scrollbar ends up hundreds of
  pixels below the fold — to move the columns sideways you first had to scroll to
  the end of the page. Use `dvh`, not `vh`: mobile browser chrome changes the
  viewport height.

Note `overflow-x-auto` alone already makes an element a scroll container in *both*
axes (a `visible` axis computes to `auto` when the other is not visible), so
adding the cap changes *what* scrolls, not *whether* it scrolls.

**2. The refresh affordance** — what the UI does while a soft navigation is in
flight. There is no full-page spinner and no skeleton; the pending state goes on
**the control that caused it**:

```jsx
const [pending, startTransition] = useTransition();
…
<div className={`inline-flex rounded-md border border-surface-border bg-white p-0.5
                 ${pending ? 'cursor-wait opacity-70' : ''}`}>
    <button disabled={pending} …>Month</button>
</div>
```

`opacity-70` + `cursor-wait` + `disabled`, and nothing else moves. The table keeps
showing the previous rows until the new ones arrive, which is the point of a soft
navigation — blanking it to a skeleton throws away a correct screen to show an
incorrect one. For a fetch that is genuinely slow and has no control to dim, a
`toast.loading(…)` resolved with its own `{ id }` is the pattern; a row of grey
bars is not used anywhere in this app.

### Badges and chips

A status badge is a `rounded-full px-2 py-0.5 text-xs font-medium` pill with a
tinted background and a matching text colour from the fixed status map. A filter
chip is **orange when active, soft navy tint otherwise** — `bg-brand-navy/10
text-brand-navy ring-1 ring-inset`, never filled, because there are several per
screen and filled pills read as headers.

### Loaders — four kinds, and which to use

Measured in this codebase: **100 uses of `animate-spin`, 45 of `toast.loading`,
and zero skeletons**. That is a decision, not an omission — pages are
server-rendered and arrive complete, so there is no first-paint gap to fill with
grey bars.

| Situation | What to show |
| --- | --- |
| A button triggered an async action | Spinner **inside the button**, label kept, button disabled |
| A soft navigation is in flight (filter, sort, page) | Dim the **control** (`opacity-70 cursor-wait`), keep the old rows |
| A long background job (upload, bulk verify) | `toast.loading()` resolved by id |
| Fetching options into an open popup | Small spinner **in the popup**, not over the page |

**In a button** — the width must not jump, so the icon is swapped, not added:

```jsx
<button disabled={busy}
    className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm
               font-medium text-white disabled:opacity-60">
    {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
    {busy ? 'Saving…' : 'Save'}
</button>
```

**As a toast**, for anything that outlives the control that started it:

```js
const id = toast.loading('Verifying 120 links…');
try {
    const res = await run();
    toast.success(`${res.live} live, ${res.missing} missing.`, { id });   // same id = it morphs
} catch (err) {
    toast.error(err.message || 'Verification failed.', { id });
}
```

Passing `{ id }` is what makes the loading toast *become* the result instead of
stacking a second one under it.

**Never** put a spinner where the thing it describes already has one, and never
use a spinner for something that finishes in under ~200ms — a flash of a spinner
reads as a glitch, not as progress.

### Fading an overflowing strip

Use a **mask**, not a white gradient overlay — an overlay is opaque to the panel
behind it and shows as a pale block on any non-white surface:

```css
mask-image: linear-gradient(to right, transparent 0, #000 12px, #000 calc(100% - 12px), transparent 100%);
```

Hide a scrollbar only when the overflow is signalled some other way. Without a
replacement affordance, hidden overflow is hidden content.

---

## 7. Clean-code conventions

**Comments say WHY, with the number.** The convention throughout this codebase is
that a comment records the failure the code prevents and what was measured —
`/* 456 rows matched on hostname alone */` — not what the next line does. A
comment that restates the code is deleted; a comment that records a decision is
kept forever.

**One definition of a rule.** When the same predicate is needed in JS and in SQL,
write it in JS and generate the SQL, or list the ids — never write it twice, or
the two drift and nobody notices which is authoritative.

**Derive, don't duplicate state.** Prefer a value computed during render over a
second `useState` kept in sync by an effect.

**Reacting to a changed prop is a render-time pattern, not an effect:**

```jsx
const [seenValue, setSeenValue] = useState(value);
if (seenValue !== value) {
    setSeenValue(value);
    resetSomething();           // runs during render, no extra commit
}
```

**`setState` inside `useEffect` is a lint error** (`react-hooks/set-state-in-effect`)
and usually means the state should have been derived. When an effect genuinely
must reach the DOM after a render (moving focus into a row that did not exist
yet), park the target in a **ref** and read it in an effect keyed on the data that
created the row — a ref costs no second render:

```jsx
const pendingFocus = useRef(null);
useEffect(() => {
    const idx = pendingFocus.current;
    if (idx == null) return;
    pendingFocus.current = null;
    inputs.current[idx]?.focus();
}, [rows]);
```

**Server components by default.** A component becomes `'use client'` only when it
needs state, an event handler or a browser API. URL-backed controls stay server-
rendered: the switch is two `<Link>`s and the server returns the view asked for,
rather than shipping the aggregation to the browser.

**A default view is the ABSENCE of its parameter.** `?span=year` and no parameter
must not be two URLs that render the same page.

**Gate in the API route, not just in the UI.** Hiding a button enforces nothing.

**Validate at the edge, clamp rather than trust.** `?fy=99999` resolves to the
current year; a page size is clamped before it reaches SQL.

**Naming:** `lib/` for logic, `components/` for rendering, `components/ui/` for
unstyled primitives' wrappers. Files are named for the thing they export.

---

## 8. `public/` layout

```
public/
├── common/                      Assets other projects consume over HTTP
│   ├── chrome-extensions/       Unpacked extensions, one directory each
│   │   └── <name>/              manifest.json, background.js, popup.*, options.*,
│   │                            ui.css, icons/, README.md
│   └── script/                  Integration kits for external sites
│       └── <feature>/           README.md (with curl), helper.js, helper.php,
│                                example-usage.html, example-usage.php
├── fonts/                       Self-hosted .woff for the PDF renderer
│                                (the web app gets its fonts from next/font)
├── icons/                       PWA icons — 192, 512, maskable-512
├── splash/                      iOS splash screens, one per device size
├── schema/
│   ├── live/<db>.sql            The current schema dump, kept in sync by hand
│   └── migrations/              {Ymdhis}-{reason}.sql — see §9
├── sw.js                        Service worker
└── logo.svg, logo-blue.svg …    Brand marks, one per theme
```

Two conventions worth carrying over:

- **`common/` is the public contract.** Anything under it may be fetched by
  another property, so its paths are stable and each directory carries a README
  with a copy-pasteable example.
- **Fonts are duplicated on purpose.** `next/font` serves the web app (hashed,
  preloaded, no layout shift); a PDF renderer cannot use that pipeline, so it
  reads real `.woff` files from `public/fonts`. Same family, two delivery paths.

---

## 9. Database conventions

MySQL 8 + `mysql2/promise`. The rules below are the ones that cost real downtime.

### Access

- **One cached pool**, reused across hot reloads via `globalThis`. A module-level
  pool without that cache leaks a pool per reload in development.
- **Named placeholders** (`namedPlaceholders: true`): `query('… WHERE id = :id', { id })`.
- **Never string-concat user input.** Only server-controlled integers already
  clamped (page size, offset) are inlined — and those deliberately, because a
  literal is what lets the planner size the read.
- **`db.js` is server-only.** Anything importing it must never reach a client
  component.

### Prepared statements are a finite, server-wide resource

`conn.execute` caches one prepared statement **per distinct SQL string per
connection**, and MySQL counts them across every session — including other apps on
the same server. Default driver cache 16000 vs a server limit of 16382: the cache
never evicts, so statements accumulate until every `PREPARE` is refused and
unrelated pages die on trivial reads.

- Size the cache from the pool: `maxPreparedStatements = BUDGET / POOL_SIZE`
  (budget ≈ half the server limit, floor 32). Raising the pool size is what makes
  this fire, and dividing by it is what stops the next bump doing it again.
- **An interpolated `IN (…)` list is a new statement every time.** Use a helper
  that emits named placeholders so the SQL text varies only by the *number* of ids.
- Diagnose with `Prepared_stmt_count` vs `max_prepared_stmt_count`, and
  `Com_stmt_prepare` vs `Com_stmt_close`. **A close count of 0 beside a large
  prepare count means accumulation**, whatever else looks wrong.

### A bound value must not contain `:word`

With `namedPlaceholders` on, the driver's `:name` rewrite does not stop at values
it has already substituted. A regex containing `[:alnum:]` was read as a
placeholder and swallowed the rest of the statement. Build patterns with
`[^0-9A-Za-z]`, and split user input so no colon survives into a value.

### Retries: locks always, dead connections for reads only

Retry `ER_LOCK_DEADLOCK` and `ER_LOCK_WAIT_TIMEOUT` for everything. Retry
`ECONNRESET` / `EPIPE` / `ETIMEDOUT` / `PROTOCOL_CONNECTION_LOST` **only when the
statement is a SELECT** — a reset can arrive *after* the server committed, so
retrying a write inserts a second row. The read-only test must be conservative:
strip leading comments, look at the first verb, treat anything uncertain
(`INSERT … SELECT` included) as a write.

### Transactions

Pooled `query()` calls each grab an arbitrary connection, so work that must be
atomic cannot use them — two calls can land on two connections and a failure
halfway leaves the first write committed. A `withTransaction(run)` helper pins one
connection and passes a bound `q()` into the callback; **reaching for the
module-level `query` inside that callback runs outside the transaction.** Do not
wrap it in retry logic (a replay double-writes) and keep the work short.

### Timeouts do not bound the caller

A query timeout that sends `KILL QUERY` protects the *server*, not the request —
InnoDB only acts on a kill at certain points, and a 30s cap has been measured
taking 255s to return. Where one slow query must not decide a page, race the
promise against a timer as well and carry on without it. The raced promise needs
its own `.catch`, or abandoning it surfaces later as an unhandled rejection.

### Query plans on big tables

- **`ORDER BY id LIMIT n` traps the optimizer into a primary-key scan** on a
  multi-million-row table — it walks the PK looking for matching rows. Hint away
  from the PK, or order by the indexed column the filter uses.
- **One query per band beats one query with `OR` and a `CASE` sort.** A CASE
  expression cannot be indexed: a single banded query scanned 5.6M rows and
  filesorted them (11.9s) to choose 200 URLs; per-band indexed queries cost
  0.2–0.7s each and stop at the first band that fills.
- **Drive a scan from the small table.** Selecting candidate parents from a
  700-row table and then reading their children is orders of magnitude cheaper
  than filtering the child table directly.

### Schema conventions

- **Migrations are file-only SQL** in `public/schema/migrations/`, named
  `{Ymdhis}-{reason}.sql`, run manually — no runner, no tracking table. Keep the
  dump in `public/schema/live/` in sync, and include a backfill statement when a
  new column needs populating.
- **Never ship SQL you have not executed** against the real database. A linter
  does not parse SQL and neither does a build.
- **Shared tables owned by another app are read-only**, and that is a hard line —
  renaming a column under a trigger it names will keep working until the next
  INSERT and then fail at the worst possible moment.
- **Denormalize deliberately and say so.** Where a value is kept in two tables
  because a FULLTEXT index cannot span them, the comment must record that, or the
  next reader treats it as drift and "fixes" it.
- **Store counts you read often.** A per-row stats table refreshed at write time
  replaces a grouped scan of the big table on every page render.

### Canonical ids

Where one logical entity repeats across rows (a domain listed by several people),
pick one rule and apply it everywhere: here, derived data keys to the domain's
`MIN(id)`, and a domain-scoped flag matches by **name**, not by id equality — so
pausing any one listing pauses the domain. Every new query against that data has
to honour the same rule, which is why it is written down rather than inferred.

---

## 10. Porting checklist

0. Scaffold per §0 — Next App Router, Tailwind v4, shadcn with **`"tsx": false`**
   and **`"cssVariables": true`**, `"type": "module"`, `@/` → `src/`. Getting
   `cssVariables` wrong is the one that quietly defeats everything after it.
1. Copy §1's three-layer token block; replace the six brand hex values.
2. **Re-run the contrast table** (§2) against your palette before using any colour
   for text. If your accent fails on white, it is a state colour, not a text colour.
3. Take the type scale as-is — two sizes, two weights — before adding to it.
4. Take `min-w-0`, the form row, and the no-horizontal-scroll backstop (§5)
   verbatim. They are the three that break pages.
5. Build **Field + `textInput`** first. Every other control is measured against
   its 36px height and its label style.
6. Then Switch, Combobox, TagSelect, TagInput, in that order. Everything else on a
   data screen composes from them plus a table.
7. Build **one** popup idiom (§6) and use it for the filter panel, the kebab and
   any dropdown. Three hand-rolled variants read as three different controls.
8. Decide the live-vs-draft rule and the URL-is-the-state rule (§6) before
   building the first filter, not after the second.
9. Put the page number in the URL and the page size in a cookie, and clamp both
   server-side against the same allow-list.
10. Decide the loader policy once (§6): spinner in the button, dim the control,
    toast for background work, and no skeletons unless you have a real first-paint
    gap to fill.

## 11. What is NOT in here

Stated so nobody assumes coverage that does not exist:

- **Dark mode.** The tokens exist (`.dark` block, `@custom-variant dark`) but the
  app is light-only in practice and the dark values are unaudited — treat them as
  a starting point, not a supported theme.
- **Megamenu** (§6) is derived from this system's idioms, not lifted from a
  shipped screen here.
- **Skeletons / shimmer**, **charts**, **drag-and-drop**, **rich text**, and
  **animation beyond `transition-colors` and a spinner** — none are used, so there
  is no house style to copy.
- **Accessibility beyond contrast, roles and focus rings** — no full audit has
  been done; keyboard paths are correct in the controls documented above because
  they were built that way, not because they were tested against a checklist.
