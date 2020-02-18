const db = require('./loadPGPromise');

var appName='test';

var testSet = {
	asNew:{
		app:appName,
		token:'abc',
		shop:'newOnly',
		scopeHash:'bde'
	},
	asExists:{
		app:appName,
		token:'def',
		shop:'asExists',
		scopeHash:'ghi'
	},
	needsUpdate:{
		app:appName,
		token:'def',
		shop:'asExists',
		scopeHash:'jkl'
	}
}

beforeAll(async ()=>{
	return db.any("delete from app_installs where app = $1", [appName]).then(()=>{
		return db.any("insert into app_installs (app, shop, token, scope_hash) values(${app}, ${shop}, ${token}, ${scopeHash})", testSet.asExists);
	});
});

var dbEngine = require('../lib/dbEngine')['pg-promise'];

test('test loaded env', ()=>{
	expect(process.env.PG_DATABASE_URL).toBeDefined();
	expect(process.env.PG_DATABASE_URL.indexOf('postgres')).toBeGreaterThan(-1);
});

test('test pg exists token', async ()=>{
	expect.assertions(2);
	var testShop = testSet.asExists;
	const row = await dbEngine.getShopToken(db, appName, testShop.shop, testShop.token, testShop.scopeHash);
	expect(row, 'expected one object from getShopToken').not.toBeInstanceOf(Array);
	expect(row.isnew, 'isnew should not have been true').toBeFalsy();
	return null;
});

test('test pg change scope', async ()=>{
	expect.assertions(2);
	var testShop = testSet.needsUpdate;
	const row = await dbEngine.checkAccess(db, appName, testShop.shop, testShop.scopeHash);
	expect(row, 'expected one object from getShopToken').not.toBeInstanceOf(Array);
	expect(row.need_auth, 'should need auth').toBeTruthy();
	return null;
});

test('test pg new token', async ()=>{
	expect.assertions(2);
	var testShop = testSet.asNew;
	const row = await dbEngine.getShopToken(db, appName, testShop.shop, testShop.token, testShop.scopeHash);
	expect(row, 'expected one object from getShopToken').not.toBeInstanceOf(Array);
	expect(row.isnew, 'isnew should not have been true').toBeTruthy();
	return null;
});

test('test pg get shopify token', async ()=>{
	expect.assertions(4);
	var testShop = testSet.asExists;
	const row = await dbEngine.getShopConfig(db, appName, testShop.shop);
	expect(row, 'expected one object from getShopToken').not.toBeInstanceOf(Array);
	expect(row.is_subscribed, 'should not have been subscribed').toBeFalsy();
	expect(row.token, 'should match existing token').toMatch(testShop.token);
	expect(row.scope_hash, 'should match existing scope').toMatch(testShop.scopeHash);
	return null;
});