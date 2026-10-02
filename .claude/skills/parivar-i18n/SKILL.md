---
name: parivar-i18n
description: Language rules for the Parivar app — English and Gujarati UI, the per-person local script for names (Gujarati default, Hindi), auto-transliteration, *_local columns, dictionary structure and key parity, plurals, and the Gujarati glossary of agreed terms. Use whenever adding or changing any visible text, a label, a message, a notification, a name field, or anything with a local-language twin.
---

# Parivar — languages (English + local)

**This skill is editable.** Whenever the user fixes a word, changes how a language behaves, or asks to
apply a wording rule in several places, update the code *and* this file (glossary, rules) in the same
change. See "Maintaining the skills" at the end.

## Two separate ideas

1. **UI language** (`locale`): `gu` or `en` (`LOCALES` in lib/i18n/config.js). No first-visit
   language page: without a `lang` cookie the app uses the admin's **Default language for new members**
   (Settings → General), else Gujarati. The person's choice (cookie + `users_list.language`) wins once set;
   switchable from `/language` (login link), Settings → Language and the public-page toggle.
2. **Local script for names** (`localLang`): `gu` (default), `hi` (`LOCAL_LANGUAGES` in
   lib/local-language.js). Admin default in Settings → General, overridable per person
   (`users_listmeta.local_language`). Decides which script the *_local name fields are typed and
   auto-filled in — independent of the UI language.

## Dictionaries

- `src/lib/i18n/dictionaries/en.js` and `gu.js` — same key tree, **exact parity** (check key paths with
  a node script after every edit; both files must still start with their normal header).
- Server: `getT()` → `{ t, locale, localLang }`; client: `useT()`. `t('a.b.c', vars)` walks dotted paths.
- Placeholders `{name}`; plurals are objects `{ one: '1 member', other: '{count} members' }` picked by
  `vars.count` (Gujarati usually keeps one form, but keep the object shape for parity).
- Notification types with dots are stored with `_` in keys: `notifications.types.fundraise_contribution_invite`.
- Never hard-code visible text; new keys go into **both** files in the same edit.
- Insert keys by anchoring on a unique section header (`'\n    fundraise: {\n'`) and **throw if the anchor
  is missing** — a failed anchor once wrote keys to the top of both files.

## Local-language data

- Columns ending `_local` hold the local-script twin: `full_name_local`, `first_name_local`,
  `middle_name_local`, `surname_local`, `name_local` (groups, castes), `title_local` (fundraise, events).
- Show with `localized(row, field, locale)` → the `_local` value when the UI is not English and it is
  filled, else the English one.
- Notifications store both (`title` + `title_local`, `group` + `group_local`); `notificationText` picks per reader.
- Fundraise description is single-language now (no local copy on the form; old `description_local` kept).

## Auto-transliteration

- `toGujarati(text)` (lib/transliterate.js) — rules + a `WORDS` dictionary for surnames/places/names
  the rules get wrong (add words there when the user corrects one).
- `toLocalScript(text, lang)` (lib/local-language.js) shifts Gujarati to Devanagari for hi.
- Marathi was removed on purpose (not offered anywhere); don't reintroduce it unless asked.
- **Google Input Tools** is the main source: `/api/transliterate?text=&lang=gu|hi` (signed-in only) calls
  inputtools.google.com (itc gu-t-i0-und / hi-t-i0-und, free, no key) word by word, cached; suggestion k = each
  word's k-th candidate. The rules above are the instant first fill and the fallback when Google fails.
- UI: `useAutoGujarati(en, local)` pairs an English input with its local twin, like the Google keyboard: typing
  English fills the local box (rules at once, then Google's 1st) and shows a numbered list under it — Google's
  suggestions + the English spelling last; click or ↑/↓ in the English input picks. Typing in the local box =
  "Your spelling is kept". ↻ steps 1st → 2nd → 3rd … (round again); typing English or a manual edit restarts at 1st.
  Focusing a local box (also a saved name) loads the list without changing the value — every local field uses
  GujaratiField / BilingualName, incl. each row of the surname manager (editable local spelling). Never add a raw
  local-language input: always go through useAutoGujarati so the Google list is there.
- A single "full name" box (invite by phone, group Add member, bulk invite): label says "in English", hint
  `common.fullNameOrder` (your name, father's name, surname — separated by spaces; splitName splits it so) and
  placeholder from examples `fullName` ("e.g. Ramesh Mahesh Patel").
- Placeholders: `useAutoGujarati(en, local, exampleKey)` / `<BilingualName example="…">` → "e.g. Ramesh" in the English box,
  "ઉદા. રમેશ" (hi: "उदा. रमेश") in the local one; examples live in lib/examples.js (firstName, fatherName, husbandName,
  surname, groupName, fundraise, mandal, caste, meeting) — add a key there for a new pair. Components:
  `BilingualName` (one English + one local field), `GujaratiField`, `NameFields` (three name parts, each
  with its own local twin; the server joins each set).
- Labels with a `{lang}` slot (`members.fullNameLocal`) get the local language's own name
  (ગુજરાતી / हिन्दी).

## Fonts

Geist (Latin) + Noto Sans Gujarati + Noto Sans Devanagari (`next/font/google` in app/layout.js). A dev
start can fail to download a Google font once — restart dev; production builds cache them.

## Gujarati glossary (use these exact words)

| English | Gujarati |
|---|---|
| Dashboard | ડેશબોર્ડ |
| Members (nav) | પરિવારજનો |
| Member (role) | સભ્ય |
| Administrator | વ્યવસ્થાપક |
| Sub-admin | સહ-એડમિન |
| Admin (group) | એડમિન |
| Speaker (group) | વક્તા |
| Groups | જૂથો |
| Fundraise | ફંડ ફાળો |
| Blood | રક્ત · Blood group બ્લડ ગ્રુપ |
| Calendar | કેલેન્ડર |
| Meetings | મીટિંગો |
| Notifications | સૂચનાઓ |
| Settings | સેટિંગ્સ |
| First name | તમારું નામ |
| Father's name | તમારા પિતાનું નામ |
| Surname | અટક |
| Native village | મૂળ ગામ |
| Current city | હાલનું શહેર |
| Caste / Sub-caste | જ્ઞાતિ / પેટા જ્ઞાતિ |
| Archive / Unarchive | આર્કાઇવ કરો / આર્કાઇવમાંથી પાછો લાવો |
| Pending (not paid) | બાકી |
| Filters / Clear / Apply / Save | ફિલ્ટર / સાફ કરો / લાગુ કરો / સાચવો |

Prefer plain, spoken Gujarati; English loanwords the community uses (એડમિન, મીટિંગ, ફિલ્ટર) are fine.

## Maintaining the skills

The project skills live in `.claude/skills/` (parivar-design, parivar-dev, parivar-db, parivar-i18n).
They are **meant to change**: whenever the logic, a rule, a component or a wording convention changes —
especially when the user says "apply this like this" for several places — edit the matching SKILL.md in
the same piece of work, and mention it in the reply.
