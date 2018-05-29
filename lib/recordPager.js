var shopifyAPI = require('shopify-node-api');
var shopPromise = require('./shopPromises')(shopifyAPI);
var Promise = require('bluebird');


module.exports = function(shopConfig){

	var recordUrl = '/admin/'+ (shopConfig.path || shopConfig.table) +'.json';


	function errInfo(err) {
		return (typeof err.message == 'undefined') ? JSON.stringify(err) : err.message;
	}

	function toParams(obj){
		var params = [];
		var shopEncode = (v)=>(encodeURIComponent(v).replace(/%20/g, '+'));
		for(var p in obj) params.push(shopEncode(p)+'='+ shopEncode(obj[p]));
		return params.join('&');
	}

	return function checkRecords(filterParams, fields, op){
		var reachedEnd = false;
		function processPage(page){
			if(reachedEnd) return Promise.resolve(null);
			
			var queryUrl = recordUrl;

			var urlParams = Object.assign({},{
				page: page,
				limit:250
			},filterParams || {});

			if(fields && fields.length) urlParams.fields = fields.join(',')+',';

			queryUrl += '?'+ toParams(urlParams);
			console.log('Getting '+ shopConfig.table +' from ' + queryUrl);
			return shopPromise.get(shopConfig, queryUrl).
			then(function (data){
				if(!data[shopConfig.table] || !data[shopConfig.table].length){
					console.log('no '+ shopConfig.table +' to check');
					return Promise.resolve(null);
				}
				var records = data[shopConfig.table];
				console.log('extracting '+ records.length);
				if(records.length <= urlParams.limit){
					console.log('less than '+ urlParams.limit +' '+shopConfig.table +' to process');
					reachedEnd = true;
				}
				//data[shopConfig.table] = data[shopConfig.table].slice(0,10); //TEST

				function processRecord(){
					if(!records.length) return null;
					var record = records.shift();
					try{
						var opVal = op(record);
						if(typeof opVal == 'undefined') opVal = null;
						return Promise.resolve(opVal).then(function(){
							return processRecord();
						});
					}catch(e){
						console.error('error for: '+ record.title +' with id: '+ record.id + errInfo(e));
						//return processRecord();
						throw e;
					}
				}
				return processRecord().
				then(function(){
					return processPage(page+1);
				});
			});
		}
		return processPage(1);
	};
};

