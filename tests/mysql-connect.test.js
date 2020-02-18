const msql = require('./loadMYSQL');
let db = null;

var appName='test';
var testDate = new Date(2020, 1, 14, 11, 11)
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
		scopeHash:'ghi', 
		is_subscribed:true,
		subscription_ends:testDate
	},
	needsUpdate:{
		app:appName,
		token:'def',
		shop:'asExists',
		scopeHash:'jkl'
	}
};

beforeAll(async ()=>{
	var ts = testSet.asExists;
	return msql.then(pool=>{
		db = pool;
		return db.query("delete from app_installs where app = ?", [appName]).then(()=>{
			return db.query("insert into app_installs (app, shop, token, scope_hash, is_subscribed, subscription_ends) values(?, ?, ?, ?, ?, ?)", 
				[
					ts.app, 
					ts.shop, 
					ts.token, 
					ts.scopeHash, 
					ts.is_subscribed? 1:0, 
					ts.subscription_ends.toISOString().slice(0, 19).replace('T', ' ')
				]).then(()=>null);
		});
	});
});

afterAll(async ()=>{
	db.end((err)=>{
		if(err) console.error(err);
	});
	return null;
});

var dbEngine = require('../lib/dbEngine')['mysql'];



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
	// console.log(JSON.stringify(row, null, ' '));

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

expect.extend({
	toMatchDate:(exp, matchDate)=>{
		if(!exp){
			return {
				pass:false,
				message:'cannot test null date'
			};
		}
		var pass = exp.getUTCFullYear() == matchDate.getUTCFullYear() && exp.getUTCMonth() == matchDate.getUTCMonth() && exp.getUTCDate() == matchDate.getUTCDate();
		return {
			pass:pass,
			message:()=>('got '+ exp.toISOString() +' but expected '+ matchDate.toISOString())
		};
	}

})

test('test pg get shopify token', async ()=>{
	expect.assertions(5);
	var testShop = testSet.asExists;
	const row = await dbEngine.getShopConfig(db, appName, testShop.shop);
	expect(row, 'expected one object from getShopConfig').not.toBeInstanceOf(Array);
	expect(row.is_subscribed, 'should have been subscribed').toBeTruthy();
	expect(row.subscription_ends, 'should be Valentine\'s').toMatchDate(testDate);
	expect(row.token, 'should match existing token').toMatch(testShop.token);
	expect(row.scope_hash, 'should match existing scope').toMatch(testShop.scopeHash);
	return null;
});