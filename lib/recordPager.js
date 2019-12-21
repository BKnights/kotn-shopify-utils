var shopifyAPI = require('shopify-node-api');
var shopPromise = require('./shopPromises')(shopifyAPI);
var Promise = require('bluebird');

/**
 * gets the link returned by Shopify's paginated rest api 
 * @param  {object} lnk headers.link
 * @param  {string} rel previous|next
 * @return {string}     link to next or previous page of the results.
 */
function getPagerLink(lnk, rel){
	if(!lnk) return null;
	var relTo = 'rel="'+rel +'"';
	return lnk.split(',').
		filter(lnk=>(lnk.indexOf(relTo) != -1)).
		reduce((nxt, lnk)=>(nxt || lnk.match(/<(.*)>/u)[1]), null);
}

var myModule = module.exports = function(shopConfig){
	const API_TARGET = shopConfig.API_TARGET || '/admin/api/2019-10';
	var recordUrl = null;
	if(shopConfig.path && shopConfig.path.indexOf('/admin') == 0){ // expects /admin/api/<API_DATE>/table
		recordUrl = shopConfig.path;
	}else{
		recordUrl = API_TARGET +'/'+ (shopConfig.path || shopConfig.table) +'.json';
	}

	var limit = shopConfig.limit || 250;

	function errInfo(err) {
		return (typeof err.message == 'undefined') ? JSON.stringify(err) : err.message;
	}

	function toParams(obj){
		var params = [];
		var shopEncode = (v)=>(encodeURIComponent(v).replace(/%20/gu, '+'));
		const hop = Object.prototype.hasOwnProperty;
		for(var p in obj){
			if(hop.call(obj, p)){
				params.push(shopEncode(p)+'='+ shopEncode(obj[p]));
			}
		}
		return params.join('&');
	}

	return function checkRecords(filterParams, fields, op){
		var reachedEnd = false;
		var recordCount = 0;
		var nextLink = null;

		function processPage(page){
			if(reachedEnd) return Promise.resolve(null);
			
			var queryUrl = nextLink || (()=>{
				var url = recordUrl;
				var stdFilters = {
					limit:limit
				};

				if(page> 1 && !nextLink) stdFilters.page = page;

				var urlParams = Object.assign({}, stdFilters, filterParams || {});

				if(fields && fields.length) urlParams.fields = fields.join(',')+',';

				url += '?'+ toParams(urlParams);
				return url;
			})();


			console.log('Getting '+ shopConfig.table +' from ' + queryUrl);
			return shopPromise.get(shopConfig, queryUrl, null, (headers)=>{
				if(headers.link) {
					nextLink = getPagerLink(headers.link, 'next');
				}

			}).then((data)=>{
				if(!data[shopConfig.table] || !data[shopConfig.table].length){
					console.log('no '+ shopConfig.table +' to check');
					return Promise.resolve(null);
				}
				var records = data[shopConfig.table];
				console.log('extracting '+ records.length);
				if(records.length < limit){
					console.log('less than '+ limit +' '+shopConfig.table +' to process');
					reachedEnd = true;
				}
				//data[shopConfig.table] = data[shopConfig.table].slice(0,10); //TEST

				function processRecord(){
					if(!records.length) return null;
					var record = records.shift();
					try{
						var opVal = op(record, recordCount++);
						if(typeof opVal == 'undefined') opVal = null;
						return Promise.resolve(opVal).then(()=>{
							return processRecord();
						});
					}catch(e){
						console.error('error for: '+ record.title +' with id: '+ record.id + errInfo(e));
						//return processRecord();
						throw e;
					}
				}
				return processRecord().
				then(()=>{
					return processPage(page+1);
				});
			});
		}
		return processPage(1);
	};
};

myModule.getPagerLink = getPagerLink;