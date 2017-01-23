module.exports = (function(){
    var debug = require('debug')('kotn-base');
    var Promise = require("bluebird");
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

	    function processHooks(shopConfig, makeActive, appHookTopics, opts) {
        var hookURL = "https://" + opts.hostName + opts.path + "/hooks";
        return shopPromise.get(shopConfig, '/admin/webhooks.json').
        then(function(data) {
            var currentHooks = data.webhooks;
            debug(JSON.stringify(currentHooks, null, ' '));
            var processed = [];
            if (!makeActive) {
                var removeHooks = currentHooks.filter(function(hk) {
                    return ~appHookTopics.indexOf(hk.topic);
                });
                debug('removing hooks for ' + removeHooks.map(function(hk) {
                    return hk.topic;
                }).join(', '));
                var removeHook = function() {
                    if (!removeHooks.length) return processed;
                    var hook = removeHooks.shift();
                    debug('remove: ' + hook.topic);
                    return shopPromise['delete'](shopConfig, '/admin/webhooks/' + hook.id + '.json').then(function() {
                        processed.push(hook);
                        return removeHook();
                    });
                };
                return removeHook();
            }
            var needHooks = appHookTopics.filter(function(ht) {
                for (var i = 0; i < currentHooks.length; i++) {
                    if (ht == currentHooks[i].topic) return false;
                }
                return true;
            });
            if (!needHooks.length) return null;
            debug('creating webhooks:\n\t' + needHooks.join('\n\t'));
            var makeHooks = function() {
                if (!needHooks.length) return processed;
                var topic = needHooks.shift();
                var hook = {
                    topic: topic,
                    format: "json",
                    address: hookURL + "/" + topic
                };
                return shopPromise.post(shopConfig, '/admin/webhooks.json', {
                    webhook: hook
                }).
                then(function(data) {
                    processed.push(data.webhook);
                    return makeHooks();
                });
            };
            return makeHooks();
        }).then(function(hooks) {
            if(!hooks) hooks = [];
            var action = makeActive ? 'created new' : 'deleted';
            console.log(action + " webhooks:'\n\t'" + hooks.map(function(h) {
                return h.id + ':' + h.topic;
            }).join('\n\t'));
            return hooks;
        });
    }

	return {
		appRouter : require('./lib/appRouter'),
		dbSanitizer : require('./lib/dbSanitizer'),
		shopPromises : require('./lib/shopPromises'),
		NodeWrap : require('./lib/NodeWrap'),
		serializeHook : require('./lib/serializeHook'),
		processHooks : processHooks,
		instantPromise : instantPromise
	};
})();