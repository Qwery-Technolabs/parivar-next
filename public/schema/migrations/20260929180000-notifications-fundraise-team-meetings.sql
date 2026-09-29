-- Notifications, fundraise team roles, fundraise meetings/updates, fundraise location.
-- Idempotent where MySQL allows it; the live dump (public/schema/live/parivar.sql) is updated to match.

SET NAMES utf8mb4;

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

-- Location is filtered on (the "near me" feed), so it is a column, not meta.
-- MySQL 8 has no ADD COLUMN IF NOT EXISTS; this procedure makes the migration re-runnable.
DROP PROCEDURE IF EXISTS pv_add_fundraise_location;
DELIMITER //
CREATE PROCEDURE pv_add_fundraise_location()
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fundraise_campaigns' AND COLUMN_NAME = 'location') THEN
        ALTER TABLE fundraise_campaigns
            ADD COLUMN location VARCHAR(100) NULL AFTER title_gu,
            ADD KEY idx_fundraise_location (location, status);
    END IF;
END //
DELIMITER ;
CALL pv_add_fundraise_location();
DROP PROCEDURE pv_add_fundraise_location;

-- Backfill: a fundraise's location defaults to the village most of its group's members live in.
UPDATE fundraise_campaigns c
   JOIN (SELECT gm.group_id, u.village, ROW_NUMBER() OVER (PARTITION BY gm.group_id ORDER BY COUNT(*) DESC) AS rn
           FROM admin_group_members gm JOIN users_list u ON u.id = gm.user_id
          WHERE u.village IS NOT NULL AND u.village <> ''
          GROUP BY gm.group_id, u.village) v ON v.group_id = c.group_id AND v.rn = 1
   SET c.location = v.village
 WHERE c.location IS NULL;
