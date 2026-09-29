-- Per-module settings: one key/value row per setting, same shape as admin_settings.
-- admin_settings = app-wide; <module>_settings = that module's switches and lists.
-- Values are JSON-encoded by src/lib/settings.js, so a boolean stays a boolean.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS fundraise_settings (
    setting_key    VARCHAR(64) NOT NULL,
    setting_value  LONGTEXT    NULL,
    updated_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blood_settings (
    setting_key    VARCHAR(64) NOT NULL,
    setting_value  LONGTEXT    NULL,
    updated_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS events_settings (
    setting_key    VARCHAR(64) NOT NULL,
    setting_value  LONGTEXT    NULL,
    updated_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
