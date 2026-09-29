-- Caste master (admin-managed) with one level of sub-caste, and the member's caste.
-- Filtered on in Parivar Jano, so it is a column on users_list (FK), not meta.

SET NAMES utf8mb4;

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

-- users_list.caste_id / subcaste_id. Two columns rather than one leaf id so "everyone in
-- caste X" is a plain indexed equality, whatever sub-caste they picked.
DROP PROCEDURE IF EXISTS pv_add_user_caste;
DELIMITER //
CREATE PROCEDURE pv_add_user_caste()
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users_list' AND COLUMN_NAME = 'caste_id') THEN
        ALTER TABLE users_list
            ADD COLUMN caste_id    INT UNSIGNED NULL AFTER village,
            ADD COLUMN subcaste_id INT UNSIGNED NULL AFTER caste_id,
            ADD KEY idx_users_caste (caste_id, subcaste_id),
            ADD CONSTRAINT fk_users_caste    FOREIGN KEY (caste_id)    REFERENCES admin_castes (id) ON DELETE SET NULL,
            ADD CONSTRAINT fk_users_subcaste FOREIGN KEY (subcaste_id) REFERENCES admin_castes (id) ON DELETE SET NULL;
    END IF;
END //
DELIMITER ;
CALL pv_add_user_caste();
DROP PROCEDURE pv_add_user_caste;
