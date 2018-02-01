/*jsl:declare require*/
/*jsl:declare process*/
/*jsl:declare console*/
/*jsl:declare module*/
/*jsl:declare JSON*/
function appRouter(opts) {
	var debug = require('debug')('kotn-base');
	var router = require('express').Router();
	var Promise = require('bluebird');
	var crypto = require('crypto');
	var url = require('url');
	var bodyParser = require('body-parser');
	var shopifyAPI = require('shopify-node-api');
	var installPath = opts.path;
	var hostName = opts.hostName;
	var appName = opts.name;
	var apiKey = opts.apiKey;
	var apiSecret = opts.apiSecret;
	var logger = opts.logger || console;

	function makeNonce() {
		var data = Math.floor(Math.random() * 1000) + new Date().getTime() * 1000;
		return crypto.createHash('md5').update(data.toFixed()).digest('hex');
	}


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

	router.use(function(req, res, next){
		res.locals.ctx = res.locals.ctx || {};
		res.locals.ctx.apiKey = apiKey;
		next();
	});

	router.use(bodyParser.json({
		verify: function(req, res, buf, encoding) {
			var shopHMAC = req.get('x-shopify-hmac-sha256');
			if (!shopHMAC) return;
			if (req.get('x-kotn-webhook-verified')) throw 'Unexpected webhook verified header';
			var digest = crypto.createHmac('SHA256', apiSecret).update(buf).digest('base64');
			debug('checking digest: ' + digest.slice(0,5) + ' expect ' + req.get('x-shopify-hmac-sha256').slice(0,5) +' '+encoding);
			if (digest == req.get('x-shopify-hmac-sha256')) {
				req.headers['x-kotn-webhook-verified'] = '200';
			}else{
				debug(JSON.stringify(req.headers, null, ' '));
			}
		}
	})); // to support JSON-encoded bodies
	router.use(bodyParser.urlencoded({ // to support URL-encoded bodies
		extended: true
	}));



	router.get('/api', function(req, res) {
		debug('at ' + appName + ' api: ' + req.originalUrl);
		res.send('API Running');
	});
	router.get('/', session, function(req, res) {
		var indexURL = url.parse(req.originalUrl, true, true);
		if (!indexURL.pathname.endsWith('/')) {
			indexURL.pathname = indexURL.pathname + '/';
			res.redirect(url.format(indexURL)); // keep query and hash
			return;
		}
		if (req.session.shopConfig && req.session.shopConfig.shop) {
			processAuth(req.session.shopConfig.shop, req, res);
			return;
		}


		res.render('pages' + installPath + '/index', res.locals.ctx, function(err, html){
			if(err){
				logger.error(err);
				res.redirect(installPath +'/preferences');
				return;
			}
			res.send(html);
		});
	});

	function processAuth(shop, req, res) {
		req.session.shopConfig = {
			shop: shop, // MYSHOP.myshopify.com
			shopify_api_key: apiKey,
			shopify_shared_secret: apiSecret,
			shopify_scope: opts.appScope || 'read_products,write_products',
			redirect_uri: makeFinishURL(req),
			nonce: makeNonce(),
			verbose: false
		};
		var Shopify = new shopifyAPI(req.session.shopConfig);
		var auth_url = Shopify.buildAuthURL();
		// res.send('<html><head><script type="text/javascript">'+
		// 			'window.top.location.href = "'+ encodeURI(auth_url) + '"</script></head></html>');
		res.redirect(auth_url);
	}
	router.get('/auth', session, function(req, response) {
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
				processAuth(shop, req, response);
				return;
			}
			processAuth(shop, req, response);
			return;
		}
		response.render('pages' + installPath + '/auth', response.locals.ctx);
	});
	router.post('/auth', session, function(req, response) {
		var shop = req.body.shop;
		if (!shop) {
			response.redirect(installPath + '/auth');
			return;
		}
		processAuth(shop, req, response);
	});
	router.get('/finish_auth', session, function(req, res) {
		var Shopify = new shopifyAPI(req.session.shopConfig), // You need to pass in your config here 
			query_params = req.query;
		Shopify.exchange_temporary_token(query_params, function(err, data) {
			if (err) {
				logger.error(err);
				res.status(500).send(err);
				return;
			}
			req.session.shopConfig = Shopify.config;
			var token = data.access_token;
			req.db.func('get_shop_token', [appName, Shopify.config.shop, token], 1).
			then(function(result) {
				debug('exists token: ' + result.token.slice(0, 5) + ' is ' + (result.isnew ? 'new' : 'existing'));
				if (result.isnew) {
					return new Promise(function(resolve, reject) {
						var uninstallHook = {
							webhook: {
								topic: 'app/uninstalled',
								format: 'json',
								address: 'https://' + hostName + installPath + '/uninstall'
							}
						};
						Shopify.post('/admin/webhooks.json', uninstallHook, function(err, data) {
							if (err) {
								reject(err);
								return;
							}
							logger.log('installed webhook: ' + data.webhook.id);
							resolve(Shopify.config);
						});
					}).then(function(config) {
						if (opts.onInstall) return opts.onInstall(req.db, config);
						return null;
					});
				} else {
					debug('token already installed for ' + Shopify.config.shop);
					return null;
				}
			}).
			then(function() {
				res.redirect(installPath + '/preferences');
			}, function(err) {
				res.status(500).send(err);
			});
		});
	});

	function getShopConfig(req, nosession, refreshConfig, defaults) {
		//logger.log(JSON.stringify(req.headers));
		return new Promise(function(resolve, reject) {
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
			lookupShopConfig(req.db, appName, shop, defaults).then(function(freshConfig) {               
				if(!nosession) req.session.shopConfig = freshConfig;
				resolve(freshConfig);
			}, function(err) {
				logger.error(err || new Error('no installed shop'));
				reject(err || new Error('no installed shop'));
			});
		});
	}

	function lookupShopConfig(db, appName, shopName, defaults) {
		return db.one('select id, token, is_subscribed, subscription_ends from app_installs where app = $1 and shop = $2 and uninstalled is null', [appName, shopName]).
		then(function(row) {
			debug('found shop token ' + row.token.slice(0, 5) + '...');
			var config = Object.assign({
				app_id: row.id,
				shop: shopName, // MYSHOP.myshopify.com
				shopify_api_key: apiKey,
				shopify_shared_secret: apiSecret,
				access_token: row.token,
				verbose: false,
				is_subscribed: row.is_subscribed,
				subscription_ends : row.subscription_ends
			}, defaults || {});
			return config;
		}).catch(function(err){
			logger.error(JSON.stringify(err));
			return Promise.reject(new Error(err.message));
		});
	}


	function validateRequest(req){
		var ts = parseInt(req.query.timestamp,10);
		var d = new Date().getTime()/1000;
		if(Math.abs(d-ts)  > 120){ // 2 minutes
			logger.info('stale request');
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
				parts.push(k+'='+ req.query[k]);
			}
		});

		var digest = crypto.createHmac('sha256', apiSecret).update(parts.join('&')).digest('hex');
		var digestMatch = digest == req.query.hmac;
		if(!digestMatch) logger.error('invalid digest '+( haveHmac ? 'with' : 'without') +' hmac from '+parts.join('&'));
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
		var authenticatedRequest = validateRequest(req);
		var shop = req.query.shop || ('200' == req.get('x-kotn-webhook-verified') && req.get('x-shopify-shop-domain'));
		if(shop) shop = shop.split('.')[0];
		if(authenticatedRequest){
			// have auth info so use it
			logger.log('auth in request');
			if(config && config.shop == shop) return applyConfigToSession(config);
			return lookupShopConfig(req.db, appName, shop).then(applyConfigToSession);
		}
		// not freshly validated.
		// use the existing session config
		
		if(!config){
			logger.log('invalid prefs access');
			res.redirect(installPath + '/auth');
			return;
		}
		logger.log('already valid prefs access');

		applyConfigToSession(config);

	}




	router.getCustHash = (function() {
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

	router.get('/preferences', session, validSession, function(req, res) {
		var config = res.locals.shopConfig;
		res.render('pages' + installPath + '/prefs', Object.assign({is_subscribed: config.is_subscribed, subscription_ends:config.subscription_ends}, res.locals.ctx));
	});

	router.post('/uninstall', function(req, res) {
		if ('200' != req.get('x-kotn-webhook-verified')) {
			logger.error('invalid signature for uninstall');
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
		req.db.func('uninstall_shop_token', [appName, shop], 1).
		then(function(result) {
			if (opts.onUninstall) {
				return opts.onUninstall(req.db, shop).then(function() {
					return result;
				});
			} else return result;
		}).then(function(result) {
			if (result || result.uninstall_shop_token) {
				logger.log(shop + ' uninstalled ' + result.uninstall_shop_token);
			}
			res.setHeader('Content-Type', 'application/json');
			res.send(JSON.stringify({
				status: 'uninstalled'
			}));
		});
	});

	router.getShopConfig = getShopConfig;
	router.lookupShopConfig = lookupShopConfig;
	router.validSession = validSession;
	return router;
}
module.exports = appRouter;