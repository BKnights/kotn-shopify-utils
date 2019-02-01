module.exports = (function(){
	var debug = require('debug')('kotn-base');
	var Promise = require('bluebird');
	var shopifyAPI = require('shopify-node-api');
	var shopPromise = require('./lib/shopPromises')(shopifyAPI);

	function instantPromise(data, fail){
		return new Promise(function(resolve, reject){
			if(fail){
				reject(fail);
				return;
			}
			resolve(data);
		});
	}


	return {
		appRouter : require('./lib/appRouter'),
		dbSanitizer : require('./lib/dbSanitizer'),
		recordPager : require('./lib/recordPager'),
		shopPromises : require('./lib/shopPromises'),
		NodeWrap : require('./lib/NodeWrap'),
		serializeHook : require('./lib/serializeHook'),
		session : require('./lib/shopify-ui-session'),
		processHooks : require('./lib/processHooks'),
		instantPromise : instantPromise
	};
})();