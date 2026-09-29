-- Parivar — live schema (MySQL 8). Kept in sync by hand with public/schema/migrations/.
--
-- Naming: every table carries its module prefix (users_, admin_, blood_, fundraise_,
-- events_). Columns that are filtered, sorted or joined on live on the main table;
-- long or never-filtered content (address, bio, descriptions, notes) lives in the
-- sibling `<table>meta` key/value table so the main row stays narrow and indexable.

SET NAMES utf8mb4;
SET time_zone = '+05:30';

-- admin_castes is created first: users_list references it.
-- parent_id NULL = caste; parent_id set = sub-caste of that caste. One level only:
-- the actions refuse a sub-caste under a sub-caste, so a filter never needs recursion.
CREATE TABLE IF NOT EXISTS admin_castes (
    id          INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    parent_id   INT UNSIGNED      NULL,
    name        VARCHAR(100)      NOT NULL,
    name_gu     VARCHAR(100)      NULL,
    sort_order  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    status      ENUM('active','inactive') NOT NULL DEFAULT 'active',  -- inactive = hidden from pickers, kept on members
    created_by  INT UNSIGNED      NULL,
    created_at  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_admin_castes_name (parent_id, name),
    KEY idx_admin_castes_parent (parent_id, status, sort_order),
    CONSTRAINT fk_admin_castes_parent FOREIGN KEY (parent_id) REFERENCES admin_castes (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────── users_

CREATE TABLE IF NOT EXISTS users_list (
    id             INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    phone          VARCHAR(15)      NOT NULL,                 -- login id, digits only, 10–15
    password_hash  VARCHAR(100)     NULL,                     -- NULL = listed member who cannot log in yet
    full_name      VARCHAR(150)     NOT NULL,
    full_name_gu   VARCHAR(150)     NULL,                     -- Gujarati spelling, shown when UI is gu
    gender         ENUM('male','female','other') NULL,
    dob            DATE             NULL,
    blood_group    ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') NULL,
    village        VARCHAR(100)     NULL,
    caste_id       INT UNSIGNED     NULL,                     -- admin_castes (parent_id NULL)
    subcaste_id    INT UNSIGNED     NULL,                     -- admin_castes (child of caste_id)
    role           ENUM('super_admin','administrator','sub_admin','sarpanch','up_sarpanch','sabhyo')
                                    NOT NULL DEFAULT 'sabhyo',
    language       ENUM('gu','en')  NOT NULL DEFAULT 'gu',
    is_blood_donor TINYINT(1)       NOT NULL DEFAULT 0,
    status         ENUM('active','inactive','deceased') NOT NULL DEFAULT 'active',
    last_login_at  DATETIME         NULL,
    created_by     INT UNSIGNED     NULL,
    created_at     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_phone (phone),
    KEY idx_users_role (role),
    KEY idx_users_blood (blood_group, is_blood_donor),
    KEY idx_users_village (village),
    KEY idx_users_status_name (status, full_name),
    KEY idx_users_caste (caste_id, subcaste_id),
    CONSTRAINT fk_users_caste    FOREIGN KEY (caste_id)    REFERENCES admin_castes (id) ON DELETE SET NULL,
    CONSTRAINT fk_users_subcaste FOREIGN KEY (subcaste_id) REFERENCES admin_castes (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Known keys: address, occupation, education, bio, alt_phone, email, native_place, photo_url
CREATE TABLE IF NOT EXISTS users_listmeta (
    meta_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     INT UNSIGNED NOT NULL,
    meta_key    VARCHAR(64)  NOT NULL,
    meta_value  LONGTEXT     NULL,
    PRIMARY KEY (meta_id),
    UNIQUE KEY uq_users_meta (user_id, meta_key),
    CONSTRAINT fk_users_meta_user FOREIGN KEY (user_id) REFERENCES users_list (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Family-tree edges. Only parent and spouse are stored; children, siblings and
-- grandparents are derived, so the tree has one source of truth and cannot contradict itself.
-- relation: user_id's <relation> is relative_id  (e.g. user 5's father is user 2)
CREATE TABLE IF NOT EXISTS users_relations (
    id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id      INT UNSIGNED NOT NULL,
    relative_id  INT UNSIGNED NOT NULL,
    relation     ENUM('father','mother','spouse') NOT NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_rel (user_id, relation, relative_id),
    KEY idx_users_rel_relative (relative_id, relation),
    CONSTRAINT fk_users_rel_user     FOREIGN KEY (user_id)     REFERENCES users_list (id) ON DELETE CASCADE,
    CONSTRAINT fk_users_rel_relative FOREIGN KEY (relative_id) REFERENCES users_list (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Server-side sessions so a role change or logout takes effect immediately.
-- token_hash is sha256(cookie token); the raw token never touches the database.
CREATE TABLE IF NOT EXISTS users_sessions (
    token_hash  CHAR(64)     NOT NULL,
    user_id     INT UNSIGNED NOT NULL,
    expires_at  DATETIME     NOT NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_agent  VARCHAR(255) NULL,
    PRIMARY KEY (token_hash),
    KEY idx_users_sess_user (user_id),
    KEY idx_users_sess_exp (expires_at),
    CONSTRAINT fk_users_sess_user FOREIGN KEY (user_id) REFERENCES users_list (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- In-app notifications. Text is NOT stored: `type` + `data` are rendered through the
-- reader's dictionary at read time, so a notification reads in whichever language they use.
CREATE TABLE IF NOT EXISTS users_notifications (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     INT UNSIGNED    NOT NULL,
    type        VARCHAR(40)     NOT NULL,          -- e.g. blood.request, fundraise.meeting, group.admin
    data        JSON            NULL,              -- interpolation values for the dictionary string
    link        VARCHAR(255)    NULL,
    actor_id    INT UNSIGNED    NULL,
    read_at     DATETIME        NULL,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_users_notif_unread (user_id, read_at, id),
    CONSTRAINT fk_users_notif_user FOREIGN KEY (user_id) REFERENCES users_list (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────── admin_

CREATE TABLE IF NOT EXISTS admin_groups (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name        VARCHAR(150) NOT NULL,
    name_gu     VARCHAR(150) NULL,
    status      ENUM('active','archived') NOT NULL DEFAULT 'active',
    created_by  INT UNSIGNED NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_admin_groups_status (status, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Known keys: description
CREATE TABLE IF NOT EXISTS admin_groupsmeta (
    meta_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
    group_id    INT UNSIGNED NOT NULL,
    meta_key    VARCHAR(64)  NOT NULL,
    meta_value  LONGTEXT     NULL,
    PRIMARY KEY (meta_id),
    UNIQUE KEY uq_admin_groups_meta (group_id, meta_key),
    CONSTRAINT fk_admin_groups_meta FOREIGN KEY (group_id) REFERENCES admin_groups (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- member_role is scoped to the group and independent of users_list.role:
-- a sabhyo can be admin of one group without gaining any app-wide power.
CREATE TABLE IF NOT EXISTS admin_group_members (
    group_id     INT UNSIGNED NOT NULL,
    user_id      INT UNSIGNED NOT NULL,
    member_role  ENUM('member','admin') NOT NULL DEFAULT 'member',
    added_by     INT UNSIGNED NULL,
    added_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, user_id),
    KEY idx_admin_gm_user (user_id, member_role),
    CONSTRAINT fk_admin_gm_group FOREIGN KEY (group_id) REFERENCES admin_groups (id) ON DELETE CASCADE,
    CONSTRAINT fk_admin_gm_user  FOREIGN KEY (user_id)  REFERENCES users_list (id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_settings (
    setting_key    VARCHAR(64) NOT NULL,
    setting_value  LONGTEXT    NULL,
    updated_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    actor_id    INT UNSIGNED    NULL,
    action      VARCHAR(64)     NOT NULL,          -- e.g. user.role, group.admin, fundraise.expense.add
    entity      VARCHAR(32)     NOT NULL,
    entity_id   INT UNSIGNED    NULL,
    detail      JSON            NULL,
    created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_admin_audit_entity (entity, entity_id),
    KEY idx_admin_audit_actor (actor_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────── blood_

CREATE TABLE IF NOT EXISTS blood_requests (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    blood_group   ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') NOT NULL,
    units         TINYINT UNSIGNED NOT NULL DEFAULT 1,
    patient_name  VARCHAR(150) NOT NULL,
    hospital      VARCHAR(200) NULL,
    city          VARCHAR(100) NULL,
    contact_phone VARCHAR(15)  NOT NULL,
    needed_by     DATE         NULL,
    status        ENUM('open','fulfilled','cancelled') NOT NULL DEFAULT 'open',
    created_by    INT UNSIGNED NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_blood_req_status (status, needed_by),
    KEY idx_blood_req_group (blood_group, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Known keys: notes
CREATE TABLE IF NOT EXISTS blood_requestsmeta (
    meta_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
    request_id  INT UNSIGNED NOT NULL,
    meta_key    VARCHAR(64)  NOT NULL,
    meta_value  LONGTEXT     NULL,
    PRIMARY KEY (meta_id),
    UNIQUE KEY uq_blood_req_meta (request_id, meta_key),
    CONSTRAINT fk_blood_req_meta FOREIGN KEY (request_id) REFERENCES blood_requests (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Settings tables share one shape: setting_key/setting_value (JSON), see src/lib/settings.js.

CREATE TABLE IF NOT EXISTS blood_settings (
    setting_key    VARCHAR(64) NOT NULL,
    setting_value  LONGTEXT    NULL,
    updated_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────── fundraise_
-- A manual ledger. No gateway: every rupee is typed in by an admin, and the
-- public page shows exactly those rows.

CREATE TABLE IF NOT EXISTS fundraise_campaigns (
    id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    group_id       INT UNSIGNED  NULL,
    title          VARCHAR(200)  NOT NULL,
    title_gu       VARCHAR(200)  NULL,
    location       VARCHAR(100)  NULL,               -- village/town; drives the "near me" feed
    target_amount  DECIMAL(12,2) NULL,
    start_date     DATE          NULL,
    end_date       DATE          NULL,
    status         ENUM('draft','active','closed') NOT NULL DEFAULT 'active',
    is_public      TINYINT(1)    NOT NULL DEFAULT 0,
    public_token   CHAR(24)      NULL,               -- random, url-safe; regenerating kills old links
    created_by     INT UNSIGNED  NULL,
    created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_fundraise_token (public_token),
    KEY idx_fundraise_group (group_id, status),
    KEY idx_fundraise_dates (start_date, end_date),
    KEY idx_fundraise_location (location, status),
    CONSTRAINT fk_fundraise_group FOREIGN KEY (group_id) REFERENCES admin_groups (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Known keys: description, description_gu
CREATE TABLE IF NOT EXISTS fundraise_campaignsmeta (
    meta_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
    campaign_id  INT UNSIGNED NOT NULL,
    meta_key     VARCHAR(64)  NOT NULL,
    meta_value   LONGTEXT     NULL,
    PRIMARY KEY (meta_id),
    UNIQUE KEY uq_fundraise_camp_meta (campaign_id, meta_key),
    CONSTRAINT fk_fundraise_camp_meta FOREIGN KEY (campaign_id) REFERENCES fundraise_campaigns (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- donor_name is always stored, even when user_id is set: the public list must not
-- change if the member later edits their profile name.
CREATE TABLE IF NOT EXISTS fundraise_contributions (
    id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    campaign_id  INT UNSIGNED  NOT NULL,
    user_id      INT UNSIGNED  NULL,
    donor_name   VARCHAR(150)  NOT NULL,
    amount       DECIMAL(12,2) NOT NULL,
    paid_on      DATE          NOT NULL,
    mode         ENUM('cash','upi','bank','cheque','other') NOT NULL DEFAULT 'cash',
    reference    VARCHAR(100)  NULL,
    is_anonymous TINYINT(1)    NOT NULL DEFAULT 0,  -- public page shows "Anonymous", admins see the name
    recorded_by  INT UNSIGNED  NULL,
    created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_fundraise_contrib_camp (campaign_id, paid_on),
    KEY idx_fundraise_contrib_user (user_id),
    CONSTRAINT fk_fundraise_contrib_camp FOREIGN KEY (campaign_id) REFERENCES fundraise_campaigns (id) ON DELETE CASCADE,
    CONSTRAINT fk_fundraise_contrib_user FOREIGN KEY (user_id)     REFERENCES users_list (id)          ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fundraise_expenses (
    id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    campaign_id  INT UNSIGNED  NOT NULL,
    title        VARCHAR(200)  NOT NULL,             -- what the money was spent on
    place        VARCHAR(200)  NULL,                 -- where it was spent
    category     VARCHAR(64)   NULL,
    amount       DECIMAL(12,2) NOT NULL,
    spent_on     DATE          NOT NULL,
    recorded_by  INT UNSIGNED  NULL,
    created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_fundraise_exp_camp (campaign_id, spent_on),
    CONSTRAINT fk_fundraise_exp_camp FOREIGN KEY (campaign_id) REFERENCES fundraise_campaigns (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Known keys: notes, bill_ref
CREATE TABLE IF NOT EXISTS fundraise_expensesmeta (
    meta_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
    expense_id  INT UNSIGNED NOT NULL,
    meta_key    VARCHAR(64)  NOT NULL,
    meta_value  LONGTEXT     NULL,
    PRIMARY KEY (meta_id),
    UNIQUE KEY uq_fundraise_exp_meta (expense_id, meta_key),
    CONSTRAINT fk_fundraise_exp_meta FOREIGN KEY (expense_id) REFERENCES fundraise_expenses (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fundraise_settings (
    setting_key    VARCHAR(64) NOT NULL,
    setting_value  LONGTEXT    NULL,
    updated_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- NOTE: fundraise_updates references events_list, so it is created after events_ below.

-- Team of one fundraise. Independent of admin_group_members: a person can hold a role on
-- many fundraises, and in fundraises of groups they are not a member of.
--   organizer — manages everything on the fundraise
--   treasurer — records contributions and expenses
--   collector — records contributions
--   volunteer — no write access; kept informed (notifications)
CREATE TABLE IF NOT EXISTS fundraise_members (
    campaign_id  INT UNSIGNED NOT NULL,
    user_id      INT UNSIGNED NOT NULL,
    member_role  ENUM('organizer','treasurer','collector','volunteer') NOT NULL DEFAULT 'volunteer',
    added_by     INT UNSIGNED NULL,
    added_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (campaign_id, user_id),
    KEY idx_fundraise_members_user (user_id, member_role),
    CONSTRAINT fk_fundraise_members_camp FOREIGN KEY (campaign_id) REFERENCES fundraise_campaigns (id) ON DELETE CASCADE,
    CONSTRAINT fk_fundraise_members_user FOREIGN KEY (user_id)     REFERENCES users_list (id)          ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ────────────────────────────────────────────────────────────── events_

CREATE TABLE IF NOT EXISTS events_list (
    id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    title        VARCHAR(200) NOT NULL,
    title_gu     VARCHAR(200) NULL,
    event_type   ENUM('event','fundraise','meeting','festival','other') NOT NULL DEFAULT 'event',
    start_date   DATE         NOT NULL,
    end_date     DATE         NULL,                  -- NULL = single day
    start_time   TIME         NULL,
    location     VARCHAR(200) NULL,
    group_id     INT UNSIGNED NULL,
    campaign_id  INT UNSIGNED NULL,
    created_by   INT UNSIGNED NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_events_dates (start_date, end_date),
    KEY idx_events_group (group_id),
    CONSTRAINT fk_events_group    FOREIGN KEY (group_id)    REFERENCES admin_groups (id)        ON DELETE SET NULL,
    CONSTRAINT fk_events_campaign FOREIGN KEY (campaign_id) REFERENCES fundraise_campaigns (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Known keys: description
CREATE TABLE IF NOT EXISTS events_listmeta (
    meta_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_id    INT UNSIGNED NOT NULL,
    meta_key    VARCHAR(64)  NOT NULL,
    meta_value  LONGTEXT     NULL,
    PRIMARY KEY (meta_id),
    UNIQUE KEY uq_events_meta (event_id, meta_key),
    CONSTRAINT fk_events_meta FOREIGN KEY (event_id) REFERENCES events_list (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────────────────────────────── fundraise_ (depends on events_list)

-- Progress posts on a fundraise; minutes are an update tied to a meeting (events_list row
-- with campaign_id set and event_type = 'meeting'). The text itself lives in the meta table.
CREATE TABLE IF NOT EXISTS fundraise_updates (
    id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    campaign_id  INT UNSIGNED NOT NULL,
    event_id     INT UNSIGNED NULL,
    update_type  ENUM('update','minutes') NOT NULL DEFAULT 'update',
    created_by   INT UNSIGNED NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_fundraise_updates_camp (campaign_id, created_at),
    KEY idx_fundraise_updates_event (event_id),
    CONSTRAINT fk_fundraise_updates_camp  FOREIGN KEY (campaign_id) REFERENCES fundraise_campaigns (id) ON DELETE CASCADE,
    CONSTRAINT fk_fundraise_updates_event FOREIGN KEY (event_id)    REFERENCES events_list (id)         ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Known keys: body
CREATE TABLE IF NOT EXISTS fundraise_updatesmeta (
    meta_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
    update_id   INT UNSIGNED NOT NULL,
    meta_key    VARCHAR(64)  NOT NULL,
    meta_value  LONGTEXT     NULL,
    PRIMARY KEY (meta_id),
    UNIQUE KEY uq_fundraise_upd_meta (update_id, meta_key),
    CONSTRAINT fk_fundraise_upd_meta FOREIGN KEY (update_id) REFERENCES fundraise_updates (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS events_settings (
    setting_key    VARCHAR(64) NOT NULL,
    setting_value  LONGTEXT    NULL,
    updated_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
