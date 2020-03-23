
DROP PROCEDURE IF EXISTS get_shop_token;

DELIMITER $$

CREATE PROCEDURE get_shop_token (IN app_name TEXT, IN shop_name TEXT,IN token_val TEXT, IN scope_val TEXT) 
MODIFIES SQL DATA
BEGIN
-- RETURNS TABLE(token text, isnew boolean) 
	DECLARE install_id, prev_id INTEGER;
	DECLARE install_token, install_scope TEXT;

	select ai.id, ai.token, ai.scope_hash  into install_id, install_token, install_scope from app_installs ai where app = app_name and shop = shop_name and uninstalled is null;
	IF install_id is null 
	THEN
		IF token_val is not null
		THEN
			select ai.id into prev_id from app_installs ai where app = app_name and shop = shop_name and uninstalled is not null;
			IF prev_id is null
			THEN
				insert into app_installs(app, shop, token, scope_hash) values(app_name, shop_name, token_val, scope_val);
				select token_val token, 1 isnew;
			ELSE
				update app_installs set lastaccessed = now(), uninstalled = null, token = token_val, scope_hash = scope_val where id = prev_id;
				select token_val token , 1 isnew;
			END IF;
		ELSE 
			select install_token token , 0 isnew;
		END IF;
	ELSE 
		IF token_val is not null
		THEN
			IF token_val = install_token
			THEN
				update app_installs set lastaccessed = now(), scope_hash = scope_val where id = install_id;
				select install_token token , 0 isnew;
			ELSE
				update app_installs set lastaccessed = now(), token = token_val, scope_hash = scope_val where id = install_id;
				select token_val token , 1 isnew;
			END IF;
		ELSE
			update app_installs set lastaccessed = now(), scope_hash = scope_val where id = install_id;
			select install_token token , 0 isnew;
		END IF;
	END IF;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS check_shop_access;
DELIMITER $$
CREATE PROCEDURE check_shop_access (IN app_name TEXT, IN shop_name TEXT, IN scope_val TEXT) 
READS SQL DATA
BEGIN
-- RETURNS TABLE(scope TEXT, need_auth boolean)
	DECLARE install_id, prev_id INTEGER;
	DECLARE install_scope TEXT;
	
	select ai.id,ai.scope_hash into install_id, install_scope from app_installs ai 
		where app = app_name and 
		shop = shop_name and 
		uninstalled is null 
		and scope_hash = scope_val ;
	IF install_id is null 
	THEN
		select scope_val scope, 1 need_auth;
	ELSE 
		select install_scope scope, 0 need_auth;
	END IF;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS uninstall_shop_token;

DELIMITER $$
CREATE PROCEDURE uninstall_shop_token (IN app_name TEXT, IN shop_name TEXT)
BEGIN
	DECLARE install_id INTEGER;
	DECLARE uninstalled_date DATETIME;
	
		select now() into uninstalled_date;
		select ai.id into install_id from app_installs ai where app = app_name and shop = shop_name and uninstalled is null;
		IF install_id is null 
		THEN
			select null;
		ELSE 
			update app_installs set uninstalled = uninstalled_date where id = install_id;
			select uninstalled_date;
		END IF;
	END$$
DELIMITER ;
