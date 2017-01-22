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


function shopPUT(config, url, data, cb){
	return new Promise(function(resolve, reject){
		new shopifyAPI(config).put( url, data, function(err, data, headers){
			if(cb) cb(headers);

			if(err){
				reject(err);
				return;
			}

			var fail = checkStatus(headers);
			if(fail) {
				reject(fail);
				return;
			}

			resolve(data);
		});
	});
}

function shopPOST(config, url, data, cb){
	return new Promise(function(resolve, reject){
		new shopifyAPI(config).post(url, data, function(err, data, headers){
			if(cb) cb(headers);
			
			if(err){
				console.error(err);
				reject(err);
				return;
			}
			
			var fail = checkStatus(headers);
			if(fail) {
				reject(fail);
				return;
			}

			resolve(data);
		});
	});
}

	function shopGET(config, url, query, cb){
		return new Promise(function(resolve, reject){
			new shopifyAPI(config).get(url, query, function(err, data, headers){
				if(cb) cb(headers);

				if(err){
					reject(err);
					return;
				}
			
			var fail = checkStatus(headers);
			if(fail) {
				reject(fail);
				return;
			}

				resolve(data);
			});
		});
	}

	function shopDELETE(config, url){
		return new Promise(function(resolve, reject){
			new shopifyAPI(config)['delete'](url, function(err, data, headers){
				if(err){
					reject(err);
					return;
				}
			
			var fail = checkStatus(headers);
			if(fail) {
				reject(fail);
				return;
			}

				resolve(data);
			});
		});
	}

	return {
		get:shopGET,
		put:shopPUT,
		post:shopPOST,
		"delete" : shopDELETE
	};
}


module.exports = shopPromises;