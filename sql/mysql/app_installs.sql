-- ----------------------------------------------------------------------------
-- MySQL Workbench Migration
-- Migrated Schemata: postgres
-- Source Schemata: postgres
-- Created: Wed Jan  8 19:13:35 2020
-- Workbench Version: 6.3.10
-- ----------------------------------------------------------------------------

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- Schema shopify
-- ----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `shopify` ;

-- ----------------------------------------------------------------------------
-- Table shopify.app_installs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `shopify`.`app_installs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `app` LONGTEXT NOT NULL,
  `shop` LONGTEXT NOT NULL,
  `token` LONGTEXT NOT NULL,
  `scope_hash` LONGTEXT NULL,
  `lastmodified` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `uninstalled` DATETIME NULL,
  `lastaccessed` DATETIME NULL,
  `is_subscribed` TINYINT NOT NULL DEFAULT 0,
  `subscription_ends` DATE NULL,
  UNIQUE INDEX `app_id` (`id` ASC),
  INDEX `app_installs_app_shop_idx` (`app`(255) ASC, `shop`(255) ASC),
  UNIQUE INDEX `app_shop` (`app`(255) ASC, `shop`(255) ASC));


-- ----------------------------------------------------------------------------
-- Table shopify.sample_app
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `shopify`.`sample_app` (
  `id` INT NOT NULL  AUTO_INCREMENT,
  `active` TINYINT NOT NULL DEFAULT 0,
  `shop` TEXT NOT NULL,
  `email_to_default`       TINYINT   NOT NULL  DEFAULT 1,
  `email_to_cust_email`    TINYINT   NULL  DEFAULT 0,
  `email_to_static`        TINYINT   NULL  DEFAULT 0,
  `custom_notice_email`    TEXT NULL,
  `date_created` DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
  `lastmodified` DATETIME NULL,
  UNIQUE INDEX `sample_app_id` (`id` ASC),
  UNIQUE INDEX `sample_app_shop_key` (`shop`(255) ASC));


