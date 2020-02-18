
DROP FUNCTION get_shop_token(text,text, text, text);

CREATE OR REPLACE FUNCTION get_shop_token (app_name text, shop_name text, token_val text DEFAULT null, scope_val text DEFAULT null) 
RETURNS TABLE(token text, isnew boolean) as $$
	DECLARE 
	install_id integer;
	install_token TEXT;
	install_scope TEXT;
	prev_id integer;
	BEGIN
		select ai.id,ai.token, ai.scope_hash from app_installs ai where app = app_name and shop = shop_name and uninstalled is null into install_id, install_token, install_scope;
		IF NOT FOUND 
		THEN
			IF token_val is not null
			THEN
				select ai.id from app_installs ai where app = app_name and shop = shop_name and uninstalled is not null into prev_id;
				IF NOT FOUND
				THEN
					insert into app_installs(app, shop, token, scope_hash) values(app_name, shop_name, token_val, scope_val);
					return query select token_val, true;
				ELSE
					update app_installs set lastaccessed = now(), uninstalled = null, token = token_val, scope_hash = scope_val where id = prev_id;
					return query select token_val, true;
				END IF;
			ELSE 
				return query select install_token, false;
			END IF;
		ELSE 
			IF token_val is not null
			THEN
				IF token_val = install_token
				THEN
					update app_installs set lastaccessed = now(), scope_hash = scope_val where id = install_id;
					return query select install_token, false;
				ELSE
					update app_installs set lastaccessed = now(), token = token_val, scope_hash = scope_val where id = install_id;
					return query select token_val, true;
				END IF;
			ELSE
				update app_installs set lastaccessed = now(), scope_hash = scope_val where id = install_id;
				return query select install_token, false;
			END IF;
		END IF;
	END 
$$ LANGUAGE 'plpgsql';

DROP FUNCTION check_shop_access(text,text, text);

CREATE OR REPLACE FUNCTION check_shop_access (app_name text, shop_name text, scope_val text DEFAULT null) 
RETURNS TABLE(scope TEXT, need_auth boolean) as $$
	DECLARE 
	install_id integer;
	install_scope TEXT;
	prev_id integer;
	BEGIN
		select ai.id,ai.scope_hash from app_installs ai 
			where app = app_name and 
			shop = shop_name and 
			uninstalled is null 
			and scope_hash = scope_val into install_id, install_scope;
		IF NOT FOUND 
		THEN
			return query select scope_val, true;
		ELSE 
			return query select install_scope, false;
		END IF;
	END 
$$ LANGUAGE 'plpgsql';

DROP FUNCTION uninstall_shop_token(text,text);

CREATE OR REPLACE FUNCTION uninstall_shop_token (app_name text, shop_name text) RETURNS TEXT as $$
	DECLARE 
	install_id integer;
	uninstalled_date timestamp;
	BEGIN
		select now() into uninstalled_date;
		select ai.id from app_installs ai where app = app_name and shop = shop_name and uninstalled is null into install_id;
		IF NOT FOUND 
		THEN
			RETURN null;
		ELSE 
			update app_installs set uninstalled = uninstalled_date where id = install_id;
			RETURN uninstalled_date;
		END IF;
	END 
$$ LANGUAGE 'plpgsql';
