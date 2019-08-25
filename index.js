module.exports = (function(){
	var Promise = require('bluebird');

	function instantPromise(data, fail){
		return fail ? Promise.reject(fail) : Promise.resolve(data);
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