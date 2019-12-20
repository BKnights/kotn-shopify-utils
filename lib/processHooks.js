const shopifyAPI = require('shopify-node-api');
const shopPromise = require('./shopPromises')(shopifyAPI);
const debug = require('debug')('kotn-utils');

module.exports = function processHooks(shopConfig, makeActive, appHookTopics, opts) {
	var hookURL = 'https://' + opts.hostName + opts.path + '/hooks';
	const API_TARGET = opts.API_TARGET || '/admin/api/2019-10';
	return shopPromise.get(shopConfig, API_TARGET +'/webhooks.json').
		then((data)=> {
			const currentHooks = data.webhooks;
			debug('current hooks: '+ JSON.stringify(currentHooks, null, ' '));
			const processed = [];
			if (!makeActive) {
				const removeHooks = currentHooks.filter((hk)=>(appHookTopics.indexOf(hk.topic) != -1)); // leave the uninstall hook alone.
				console.log('removing hooks ' + removeHooks.map((hk)=>(hk.topic)).join(', '));
				const removeHook = ()=> {
					if (!removeHooks.length) return processed;
					const hook = removeHooks.shift();
					debug('remove: ' + hook.topic);
					return shopPromise.delete(shopConfig, API_TARGET +'/webhooks/' + hook.id + '.json').then(()=> {
						processed.push(hook);
						return removeHook();
					});
				};
				return removeHook();
			}

			// if makeActive
			const needHooks = appHookTopics.filter((ht)=> (!currentHooks.find(ct=>(ct.topic == ht))));

			if (!needHooks.length) return [];
			console.log('creating webhooks:\n\t' + needHooks.join('\n\t'));
			const makeHooks = ()=> {
				if (!needHooks.length) return processed;
				const topic = needHooks.shift();
				const hook = {
					topic: topic,
					format: 'json',
					address: hookURL + '/' + topic
				};
				return shopPromise.post(shopConfig, API_TARGET +'/webhooks.json', {
					webhook: hook
				}).then((data)=> {
					processed.push(data.webhook);
					return makeHooks();
				});
			};
			return makeHooks();
		}).then((hooks)=> {
			const action = makeActive ? 'created new' : 'deleted';
			debug(action + ' webhooks:\n\t' + hooks.map((h)=>(h.id + ':' + h.topic)).join('\n\t'));
			return hooks;
		});
};