const bodyParser = require('body-parser');
const crypto = require('crypto');
const Debug = require('debug');
const Promise = require('bluebird');
const Router = require('express').Router;
const shopifyAPI = require('shopify-node-api');
const shopPromise = require('./shopPromises')(shopifyAPI);
const url = require('url');


function appRouter(opts) {

	const router = Router();
	const debug = Debug('kotn-base');
	const installPath = opts.path;
	const hostName = opts.hostName;
	const appName = opts.name;
	const apiKey = opts.apiKey;
	const apiSecret = opts.apiSecret;
	const logger = opts.logger || console;
	const backoff_level = opts.shopifyBackoffLevel || 0.8;

	const dbEngine = require('./dbEngine')[opts.dialect || 'pg-promise'];
	
	opts.appScope = opts.appScope || 'read_products,write_products';
	const scopeHash = crypto.createHash('md5').update(opts.appScope).digest('hex');

	function makeNonce() {
		var data = Math.floor(Math.random() * 10000000000) + Date.now();
		return crypto.createHash('md5').update(data.toFixed()).digest('hex');
	}

	const API_TARGET = opts.API_TARGET || '/admin/api/2019-10';


	function makeFinishURL(req) {
		var assumeHeroku = process.env.USE_PORT == 'N';
		var finishURL = url.format({
			protocol: assumeHeroku ? 'https:' : req.protocol,
			hostname: req.hostname,
			port: assumeHeroku ? '' : process.env.PORT,
			pathname: installPath + '/finish_auth'
		});
		debug('making finish url: ' + finishURL);
		return finishURL;
	}

	var session = opts.sessionHandler || require('./shopify-ui-session')();

	router.use((req, res, next)=>{
		if(req.method != 'POST' || req.is('json')) {
			next();
			return;
		}
		var shopHMAC = req.get('x-shopify-hmac-sha256');
		if (!shopHMAC) {
			next();
			return;
		}
		if (req.get('x-kotn-webhook-verified')) throw 'Unexpected webhook verified header';
		
		debug('wait for raw body on webhook verification');
		var rawBody = '';
		req.on('data', (chunk)=>{
			rawBody += chunk;
		});
		req.on('end',()=>{

			var digest = crypto.createHmac('sha256', apiSecret).update(rawBody).digest('base64');
			debug('checking digest: ' + digest.slice(0,5) + ' expect ' + shopHMAC.slice(0,5) +' '+ req.get('content-type'));
			if (digest == shopHMAC) {
				req.headers['x-kotn-webhook-verified'] = '200';
			}else{
				debug(JSON.stringify(req.headers, null, ' '));
			}
			next();
		});

	});

	router.use((req, res, next)=>{
		res.locals.ctx = res.locals.ctx || {};
		res.locals.ctx.apiKey = apiKey;
		next();
	});

	router.use(bodyParser.json({
		verify: (req, res, buf, encoding)=>{
			var shopHMAC = req.get('x-shopify-hmac-sha256');
			if (!shopHMAC) return;
			if (req.get('x-kotn-webhook-verified')) throw 'Unexpected webhook verified header';
			var digest = crypto.createHmac('SHA256', apiSecret).update(buf).digest('base64');
			debug('json checking digest: ' + digest.slice(0,5) + ' expect ' + req.get('x-shopify-hmac-sha256').slice(0,5) +' '+encoding);
			if (digest == req.get('x-shopify-hmac-sha256')) {
				req.headers['x-kotn-webhook-verified'] = '200';
			}else{
				debug(JSON.stringify(req.headers, null, ' '));
			}
		}
	})); // to support JSON-encoded bodies)); // to support JSON-encoded bodies
	router.use(bodyParser.urlencoded({ // to support URL-encoded bodies
		extended: true
	}));



	router.get('/', session, (req, res)=>{
		var indexURL = url.parse(req.originalUrl, true, true);
		if (!indexURL.pathname.endsWith('/')) {
			indexURL.pathname = indexURL.pathname + '/';
			res.redirect(url.format(indexURL)); // keep query and hash
			return;
		}
		if (req.session.shopConfig && req.session.shopConfig.shop) {
			return processAuth(req.session.shopConfig.shop, req, res);
		}


		res.render('pages' + installPath + '/index', res.locals.ctx, (err, html)=>{
			if(err){
				logger.error(err);
				res.redirect(installPath +'/preferences');
				return;
			}
			res.send(html);
		});
	});

	function processAuth(shop, req, res) {
		debug('processing auth');
		req.session.shopConfig = {
			shop: shop, // MYSHOP.myshopify.com
			shopify_api_key: apiKey,
			shopify_shared_secret: apiSecret,
			shopify_scope: opts.appScope,
			redirect_uri: makeFinishURL(req),
			nonce: makeNonce(),
			verbose: false,
			backoff_level:backoff_level
		};
		var Shopify = new shopifyAPI(req.session.shopConfig);
		var auth_url = Shopify.buildAuthURL();
		var withRedirect = (req.query.checkSession == 'T' || res.locals.doScriptRedirect) ? 
			Promise.resolve(true) :
			(()=>{
				return dbEngine.checkAccess(req.db, appName, Shopify.config.shop.split('.')[0], scopeHash).
					then(result=>{
						debug('checked hash and found '+ JSON.stringify(result));
						return result.need_auth; // scope changed or not yet installed.
					});
			})();
		return withRedirect.then(needRedirect =>{
			debug(' with with needRedirect ' + needRedirect);
			if(needRedirect){
				debug('about to script redirect ');
				res.send('<html><head><script type="text/javascript">'+
						'window.top.location.href = "'+ encodeURI(auth_url) + '"</script></head></html>');
				return null;
			}
			debug('redirect to auth url');
			res.redirect(auth_url);
			return null;
		});
	}

	router.get('/auth', session, (req, response)=>{
		if (req.query.shop) {
			req.headers['x-frame-options'] = 'ALLOW-FROM https://'+ req.query.shop +'.myshopify.com';

			var shop = req.query.shop.split('.')[0];
			var Shopify = new shopifyAPI({
				shop: shop, // MYSHOP.myshopify.com
				shopify_api_key: apiKey,
				shopify_shared_secret: apiSecret,
				verbose: false
			});
			if (Shopify.is_valid_signature(req.query, true)) {
				logger.log('processing valid signature for ' + shop);
				return processAuth(shop, req, response);
			}
			debug('no valid signature for get auth');
			//processAuth(shop, req, response);
			//return;
		}

		response.render('pages' + installPath + '/auth', response.locals.ctx);
	});
	router.post('/auth', session, (req, response)=>{
		var shop = req.body.shop;
		if (!shop) {
			response.redirect(installPath + '/auth');
			return;
		}
		return processAuth(shop, req, response);
	});

	router.get('/finish_auth', session, (req, res)=>{
		debug('finish with '+ JSON.stringify(req.query));
		var doNext = (req.session.shopConfig ? 
			Promise.resolve(req.session.shopConfig) : 
			Promise.resolve(validateRequest(req)).then((isValid)=>{
				debug('checked valid with no session: '+ isValid);
				if(!isValid) throw 'invalid request and no session';
				res.locals.doScriptRedirect = true;
				return processAuth(req.query.shop.split('.')[0], req, res);
			}));
		doNext.then((shopConfig)=>{
			if(!shopConfig) return null;
			debug('with config: '+JSON.stringify(shopConfig));
			var Shopify = new shopifyAPI(shopConfig); // You need to pass in your config here 
			return new Promise((resolve, reject)=>{
				Shopify.exchange_temporary_token(req.query, (err, data)=>{
					if (err) {
						logger.error(err);
						reject(err);
						return;
					}
					req.session.shopConfig = Shopify.config;
					resolve(data.access_token);
				});
			}).then((token)=>{ // have a valid token 
				return dbEngine.getShopToken(req.db, appName, Shopify.config.shop.split('.')[0], token, scopeHash).
					then((result)=>{
						debug('exists token: ' + result.token.slice(0, 5) + ' is ' + (result.isnew ? 'new' : 'existing'));
						if (result.isnew) {
							return new Promise((resolve, reject)=>{
								var uninstallHook = {
									webhook: {
										topic: 'app/uninstalled',
										format: 'json',
										address: 'https://' + hostName + installPath + '/uninstall'
									}
								};
								Shopify.post(API_TARGET +'/webhooks.json', uninstallHook, (err, data)=>{
									if (err) {
										reject(err);
										return;
									}
									logger.log('installed webhook: ' + data.webhook.id);
									resolve(Shopify.config);
								});
							}).then((config)=>{
								if (opts.onInstall) return opts.onInstall(req.db, config);
								return null;
							});
						} else {
							logger.log('token already installed for ' + Shopify.config.shop);
							if (opts.onInstall && opts.canHandleReinstall) return opts.onInstall(req.db, Shopify.config, true);
							return null;
						}
					});
			}).then(()=>{
				res.redirect(installPath + '/preferences');
				return null;
			});
		}).catch((err)=>{
			res.status(500).send(err);
		});
	});

	function getShopConfig(req, nosession, refreshConfig, defaults) {
		//logger.log(JSON.stringify(req.headers));
		return new Promise((resolve, reject)=>{
			var config = (!nosession && req.session.shopConfig);
			var shop = req.query.shop || ('200' == req.get('x-kotn-webhook-verified') && req.get('x-shopify-shop-domain')) || (!nosession && req.session.shop);
			if (shop) shop = shop.split('.')[0];
			if(!shop && req.session && req.session.shopConfig) shop = req.session.shopConfig.shop;

			if ((shop && config && config.shop == shop) || (config && !shop)) {
				debug('have session config');
				if(!refreshConfig){
					resolve(config);
					return;
				}
			}
			if (!shop) {
				debug('invalid request from: '+req.originalUrl +' have session: '+ JSON.stringify(req.session)); 
				reject(new Error('invalid request'));
				return;
			}
			if(nosession && !(('200' == req.get('x-kotn-webhook-verified')) || validateRequest(req))){
				throw new Error('Missing required authentication');  // session requests need validation from auth token
			}
			lookupShopConfig(req.db, appName, shop, defaults).then((freshConfig)=>{               
				if(!nosession) req.session.shopConfig = freshConfig;
				resolve(freshConfig);
			}, (err)=>{
				logger.error(err || new Error('no installed shop'));
				reject(err || new Error('no installed shop'));
			});
		});
	}

	function lookupShopConfig(db, appName, shopName, defaults) {
		return dbEngine.getShopConfig(db, appName, shopName).
			then((row)=>{
				debug('found shop token ' + row.token.slice(0, 5) + '...');
				var config = Object.assign({
					app_id: row.id,
					shop: shopName, // MYSHOP.myshopify.com
					shopify_api_key: apiKey,
					shopify_shared_secret: apiSecret,
					access_token: row.token,
					scope_hash: row.scope_hash,
					verbose: false,
					backoff_level:backoff_level,
					is_subscribed: row.is_subscribed,
					subscription_ends : row.subscription_ends
				}, defaults || {});
				return config;
			}).catch((err)=>{
				logger.error(JSON.stringify(err));
				return Promise.reject(new Error(err.message));
			});
	}


	function validateRequest(req){
		var ts = parseInt(req.query.timestamp,10);
		var d = new Date().getTime()/1000;
		if(Math.abs(d-ts)  > 120){ // 2 minutes
			logger.info('stale request '+ (d-ts));
			return false;
		} 
		
		var keys = Object.keys(req.query);
		keys.sort();
		var parts = [];
		var haveHmac = false;
		keys.forEach((k)=>{
			switch(k){
			case 'hmac': 
				haveHmac = true;
				break;
			default:
				parts.push(k+'='+ encodeURIComponent(req.query[k]));
				break;
			}
		});

		var signedPayload = (haveHmac ? parts.join('&') : url.parse(req.url).query) || '';

		var shopifyHMAC = (haveHmac ? req.query.hmac : req.headers['x-shopify-hmac-sha256']) || '';

		if(!shopifyHMAC){
			logger.info('unsigned request: '+ req.url);
			return false;
		}

		var digest = crypto.createHmac('sha256', apiSecret).update(signedPayload).digest(req.query.hmac ? 'hex' : 'base64');
		var digestMatch = digest == shopifyHMAC;
		if(!digestMatch){
			logger.error('invalid digest from '+signedPayload +' expected '+ digest.slice(0,5) +', received: '+ shopifyHMAC.slice(0,5));
		}
		return digestMatch;

	}

	function validSession(req, res, next){
		var config = req.session && req.session.shopConfig;
		var applyConfigToSession = (config)=>{
			res.locals.shopConfig = config;
			req.session.shopConfig = config;
			session(req, res, next);
			return null;
		};
		debug('check for valid session');
		var authenticatedRequest = validateRequest(req);
		var shop = req.query.shop || ('200' == req.get('x-kotn-webhook-verified') && req.get('x-shopify-shop-domain'));
		if(shop) shop = shop.split('.')[0];
		if(authenticatedRequest){
			// have auth info so use it
			debug('auth in request - set session and return');
			if(config && config.shop == shop) return applyConfigToSession(config);
			return lookupShopConfig(req.db, appName, shop).then(applyConfigToSession);
		}
		// not freshly validated.
		// use the existing session config
		
		if(!config){
			logger.log('invalid prefs access - return with checkSession');
			res.redirect(installPath + '/auth?checkSession=T&noCache=' + Date.now());
			return;
		}
		logger.log('already valid prefs access');

		applyConfigToSession(config);

	}




	router.getCustHash = (()=>{
		function generateHashSecret(shop) {
			if(!opts.inboundHashSeed) throw 'Missing inboundHashSeed from config';
			var hash = crypto.createHash('sha1');
			hash.update(shop);
			hash.update(opts.inboundHashSeed);
			hash.update(apiSecret);
			return hash.digest('hex');
		}

		function generateHash(shop, id){
			var hasher = crypto.createHash('sha1');
			hasher.update(id);
			hasher.update(generateHashSecret(shop));
			return hasher.digest('hex');
		}

		function check(shop, custId, hash) {
			var check = generateHash(shop, custId);
			// logger.log('compare : '+ hash +" vs "+ check);
			return hash === check;
		}
		return {
			getSecret: generateHashSecret,
			makeHash: generateHash,
			checkHash: check
		};
	})();

	router.get('/preferences', session, validSession, (req, res)=>{
		var config = res.locals.shopConfig;
		res.render('pages' + installPath + '/prefs', Object.assign({hostName:process.env.HOSTNAME, is_subscribed: config.is_subscribed, subscription_ends:config.subscription_ends}, res.locals.ctx));
	});

	router.post('/uninstall', (req, res)=>{
		if ('200' != req.get('x-kotn-webhook-verified')) {
			logger.error('invalid signature for uninstall with hmac '+ req.get('x-shopify-hmac-sha256').slice(0,5));
			res.status(403).end();
			return;
		}
		var shop = req.get('x-shopify-shop-domain');
		if (!shop) {
			logger.error('missing shop header for uninstall');
			res.status(400).send('missing shop');
			return;
		}
		debug('valid remove request for ' + shop);
		shop = shop.split('.')[0];
		var uninstall =  opts.onUninstall ? opts.onUninstall(req.db, shop) : Promise.resolve(null);
		return uninstall.then(()=>{
			return lookupShopConfig(req.db, appName, shop).then(shopConfig=>{


				return shopPromise.get(shopConfig, API_TARGET +'/webhooks.json').then((data)=> {
					const currentHooks = data.webhooks;
					debug(JSON.stringify(currentHooks, null, ' '));
					const processed = [];
					console.log('removing hooks for ' + currentHooks.map((hk)=>(hk.topic)).join(', '));
					const removeHook = ()=> {
						if (!currentHooks.length) return processed;
						const hook = currentHooks.shift();
						debug('remove: ' + hook.topic);
						return shopPromise.delete(shopConfig, API_TARGET +'/webhooks/' + hook.id + '.json').then(()=> {
							processed.push(hook);
							return removeHook();
						});
					};
					return removeHook();
				});
			}).then(()=>{
				return req.db.func('uninstall_shop_token', [appName, shop], 1).then((result)=>{
					if (result || result.uninstall_shop_token) {
						logger.log(shop + ' uninstalled ' + result.uninstall_shop_token);
					}
					res.json({
						status: 'uninstalled'
					});
					return null;
				});
			});

		});
		
	});

	router.getShopConfig = getShopConfig;
	router.lookupShopConfig = lookupShopConfig;
	router.validSession = validSession;
	return router;
}
module.exports = appRouter;