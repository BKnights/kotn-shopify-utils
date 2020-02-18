

/** db is a pg-promise connection */
const pg = {

	checkAccess: (db, appName, shopName, scopeHash)=>(db.func('check_shop_access', [appName, shopName, scopeHash], 1)),
	getShopToken : (db, appName, shopName, token, scopeHash)=>(db.func('get_shop_token', [appName, shopName, token, scopeHash], 1)),
	getShopConfig : (db, appName, shopName)=>(db.one('select id, token, is_subscribed, subscription_ends, scope_hash from app_installs where app = $1 and shop = $2 and uninstalled is null', [appName, shopName]))
	
};



const mysql = {

	checkAccess: (pool, appName, shopName, scopeHash)=>(pool.query('call check_shop_access(?, ?, ?)',[appName, shopName, scopeHash]).
		then(rows =>{
			const r = rows[0][0];
			r.need_auth = Boolean(r.need_auth);
			return r;
		})
	),
	getShopToken : (pool, appName, shopName, token, scopeHash)=>(pool.query('call get_shop_token(?,?,?,?)',  [appName, shopName, token, scopeHash]).
		then(rows =>{
			const row = rows[0][0];
			row.isnew = Boolean(row.isnew);
			return row;
		})
	),
	getShopConfig : (pool, appName, shopName)=>(pool.query('select id, token, is_subscribed, subscription_ends, scope_hash from app_installs '+
		'where app = ? and shop = ? and uninstalled is null', [appName, shopName]).
			then(rows=>{
				console.log(JSON.stringify(rows, null, ' '));
				var row = rows[0];
				row.is_subscribed = Boolean(row.is_subscribed);
				return row;
			}))
};

module.exports = {
	'pg-promise' : pg,
	'mysql' : mysql
};

