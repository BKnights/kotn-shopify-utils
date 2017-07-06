function shopPromises(shopifyAPI){

	var Promise = require("bluebird");

	function checkStatus(headers){
		// console.log('checkStatus\t\n'+JSON.stringify(headers, null, '  '));
		var status = headers.status;
		if(!status) return null;
		var code = status.slice(0,3);
		if(code.indexOf('4') === 0 || code.indexOf('5') === 0) return status;
		return null;
	}

	function stdHandler(resolve, reject, cb){
		return function(err, data, headers){
			if(cb) cb(headers);

			if(err){
				reject(err);
				return;
			}

			var fail = checkStatus(headers);
			if(fail) {
				reject(data);
				return;
			}

			resolve(data);
		};
	}
		

	function shopPUT(config, url, data, cb){
		return new Promise(function(resolve, reject){
			new shopifyAPI(config).put( url, data, stdHandler(resolve,reject, cb));
		});
	}

	function shopPOST(config, url, data, cb){
		return new Promise(function(resolve, reject){
			new shopifyAPI(config).post(url, data, stdHandler(resolve,reject, cb));
		});
	}

	function shopPATCH(config, url, data, cb){
		return new Promise(function(resolve, reject){
			new shopifyAPI(config).patch(url, data, stdHandler(resolve,reject, cb));
		});
	}
	function shopGET(config, url, query, cb){
		return new Promise(function(resolve, reject){
			new shopifyAPI(config).get(url, query, stdHandler(resolve,reject, cb));
		});
	}

	function shopDELETE(config, url){
		return new Promise(function(resolve, reject){
			new shopifyAPI(config)['delete'](url, stdHandler(resolve,reject));
		});
	}

	return {
		get:shopGET,
		put:shopPUT,
		post:shopPOST,
		patch:shopPATCH,
		"delete" : shopDELETE
	};
}


module.exports = shopPromises;