function shopPromises(shopifyAPI){

	var Promise = require('bluebird');

	function checkStatus(headers){
		// console.log('checkStatus\t\n'+JSON.stringify(headers, null, '  '));
		var status = headers.status;
		if(!status) return null;
		var code = status.slice(0,3);
		if(code.indexOf('2') === 0 && code != '200') console.log(status);
		if(code.indexOf('4') === 0 || code.indexOf('5') === 0) return status;
		return null;
	}

	function stdHandler(resolve, reject, op){
		return (err, data, headers)=>{
			if(op) op(headers);

			if(err){
				if(err instanceof Error) {
					reject(err);
					return;
				}
				console.error(JSON.stringify(err));
				var headerErr = checkStatus(headers);
				console.error('error from request '+ (headerErr || '-unknown-'));
				var errObj = headerErr ? new Error(JSON.stringify(headerErr)) : new Error(err);
				errObj.shopify = err;
				reject(errObj);
				return;
			}

			var fail = checkStatus(headers);
			if(fail) {
				console.error(data);
				reject(new Error(fail));
				return;
			}

			resolve(data);
		};
	}
		

	function shopPUT(config, url, data, cb){
		return new Promise((resolve, reject)=>{
			new shopifyAPI(config).put( url, data, stdHandler(resolve,reject, cb));
		});
	}

	function shopPOST(config, url, data, cb){
		return new Promise((resolve, reject)=>{
			new shopifyAPI(config).post(url, data, stdHandler(resolve,reject, cb));
		});
	}

	function shopPATCH(config, url, data, cb){
		return new Promise((resolve, reject)=>{
			new shopifyAPI(config).patch(url, data, stdHandler(resolve,reject, cb));
		});
	}
	function shopGET(config, url, query, cb){
		return new Promise((resolve, reject)=>{
			new shopifyAPI(config).get(url, query, stdHandler(resolve,reject, cb));
		});
	}

	function shopDELETE(config, url){
		return new Promise((resolve, reject)=>{
			new shopifyAPI(config).delete(url, stdHandler(resolve,reject));
		});
	}

	return {
		get:shopGET,
		put:shopPUT,
		post:shopPOST,
		patch:shopPATCH,
		'delete' : shopDELETE
	};
}


module.exports = shopPromises;