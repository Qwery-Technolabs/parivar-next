---
name: parivar-db
description: Database rules for the Parivar app — the live MariaDB, table naming (module prefixes, <table>meta, <module>_settings), mysql2 helpers, how to change the schema on live (migrate, fold into public/schema/live/parivar.sql, delete the migration), and the no-test-data-on-live rules. Use before any SQL, schema change, new table/column, data backfill, or when querying live data to debug.
---

# Parivar — database

**Keep this file current.** New conventions the user sets for data (naming, where things are stored,
backfill rules) get recorded here when applied.


**Connection pool** (lib/db.js): 5 per instance (DB_POOL_SIZE overrides), waitForConnections, queueLimit 0, idle kept
15 min, keep-alive. Hostinger: 500 new connections/hour per user + a cap on open connections — never raise the pool
far (100 would take the app down). Slow statements (>800 ms, incl. waiting for a connection) log `[db slow]`.
Settings (getSettings) are memoised per instance for 60 s (+ React cache per request); saveSettings clears them —
always write settings through saveSettings, never raw SQL, or readers stay stale for up to a minute.
## The database

- The app runs against the **live remote MariaDB 11.8** from `.env` (no `.env.local`). Never commit `.env`;
  never print its values.
- Pool (lib/db.js): cached per timezone offset, named placeholders (`:name`), `dateStrings`, strict
  `sql_mode`, session `time_zone` = the admin timezone offset (default +05:30). A standalone node script
  connects in **UTC** — use `DATE_ADD(NOW(), INTERVAL 1 DAY)` style margins when comparing with app rows.
- `matrimony_profiles` (PK user_id): is_active, height_cm, income_range, contact_name / contact_phone, pref_* ,
  about, listed_by. Module prefix `matrimony_`.
- fundraise_campaigns.kind ENUM('fundraise','mandal'); `fundraise_subscribers` (campaign_id, user_id); `fundraise_mandal_marks`
  (event_id, user_id, campaign_id, present, paid, contribution_id → fundraise_contributions).
- `admin_surnames` (name UNIQUE, name_local, caste_id, subcaste_id → admin_castes, SET NULL on delete).
- users_list.maiden_middle_name / maiden_surname (+ _local): a married woman's father's name + surname; her main name parts
  are her married ones (husband's name, in-laws' surname).
- users_list.phone is **nullable** (family-tree relatives without a number; UNIQUE still holds for real numbers);
  `marital_status` ENUM(unmarried, married, engaged, widowed, divorced); users_relations.relation adds 'sibling'.
  Test family writes on the throwaway DB (`npm run db:dev` :3307 + `next start -p 3001` with DB_* overrides).
- **Hosting limit: 500 NEW connections per hour per DB user** (Hostinger `max_connections_per_hour`; error
  `ER_USER_LIMIT_REACHED`, the app then fails until the hour resets). Pool = 2 on Vercel / 3 elsewhere (never 1: a helper using the pool inside a transaction would deadlock), idle
  connections kept (`idleTimeout` 15 min, keep-alive). Every probe script opens fresh connections — reuse ONE
  connection per script, run probes sparingly, and prefer a separate DB user for local dev/scripts.
- Helpers: `query`, `queryOne`, `withTransaction(q => …)`, `inList(values, prefix)`, `getMeta`,
  `getMetaMany(base, ids, keys)`, `setMeta(base, id, values, q)` (empty value deletes the key).
- JSON columns come back as strings — parse defensively. `perPage`/`offset` are clamped ints inlined.
- Generated binary files (favicon / app icon PNGs) are stored base64 in `admin_settings` (`app_icon_512/192/32`)
  — never on disk (Vercel). `getSettings` excludes `app_icon_%`. Per-user switches go in `users_listmeta`
  (e.g. `notify_off` = comma list of categories, queried with `FIND_IN_SET`).

## Naming

- Module prefixes: `users_`, `admin_`, `blood_`, `fundraise_`, `events_`, `chat_`.
- Filterable facts are columns; everything else goes in `<table>meta(meta_id, <fk>, meta_key, meta_value)`
  (registered in the `META` map in lib/db.js: users_list, admin_groups, blood_requests,
  fundraise_campaigns, fundraise_expenses, fundraise_updates, events_list, chat_messages).
- Module settings: key/value tables `admin_settings`, `fundraise_settings`, `blood_settings`,
  `events_settings`; keys declared in `SETTINGS` (lib/settings.js) with type and default.
- Link tables for many-to-many: e.g. `fundraise_groups(campaign_id, group_id)` (home group stays
  `fundraise_campaigns.group_id`, NULL = standalone).
- Soft deletes via `deleted_at` (contributions, expenses, chat); archive via `archived_at` (fundraises).
- Enum values used so far: users_list.role `super_admin|administrator|sub_admin|sabhyo`;
  admin_group_members.member_role `member|speaker|sub_admin|admin`; fundraise_contributions.mode
  `cash|upi|bank|cheque|other|unpaid` (`unpaid` = pledged, excluded from every collected total).

## Changing the schema on live

1. Write `public/schema/migrations/<yyyymmddHHMMSS>-<name>.sql` (additive where possible; backfill in
   the same file when needed, guarded by `WHERE … IS NULL`).
2. Before dropping enum values/columns, **count rows that use them** first.
3. Apply: `npm run db:migrate -- <file>`.
4. Verify with read-only counts (never print personal data — ids/counts only).
5. **Fold** the DDL into `public/schema/live/parivar.sql` (the fresh-install dump) and **delete the
   migration file** (and the folder).
6. Mention in the reply that live was changed and how.

## Live-data safety

- No test data on live. Probes are read-only; the only allowed write is a temporary session row
  (`users_sessions`, `user_agent='node'`) deleted in `finally` with a fresh connection, then verify
  `COUNT(*) = 0`.
- Destructive product features (delete accounts, clear logs) must be guarded server-side and audited.
- Files written at runtime (e.g. `public/app-icons/`) are git-ignored and served through route handlers
  (Next only serves `public/` files present at build time).

## Maintaining the skills

The project skills live in `.claude/skills/` (parivar-design, parivar-dev, parivar-db, parivar-i18n).
They are **meant to change**: whenever the logic, a rule, a component or a convention changes —
especially when the user says "apply this like this" for several places — edit the matching SKILL.md
in the same piece of work (add the rule, fix what is now wrong, drop what no longer applies), and say so
in the reply. Code and skills must never disagree.
