const serializeHook = require('../lib/serializeHook');

var shops = ['bob', 'carol', 'ted', 'alice'];

var results = {};

shops.forEach(s=>{
	results[s] = [];
});

var maxTime = 10000;

function addJob(idx){
	var shop = shops[idx % 4];
	return serializeHook(null, shop, {token:'t'+ idx}, ()=>{
		var interval = Math.floor(maxTime * Math.random());
		console.log('triggering '+ shop +' at '+ idx +' in '+ interval);
		return new Promise((resolve, reject)=>{
			setTimeout(()=>{
				// console.error('resolving '+ shop +' at '+ idx);
				resolve(idx);
			}, interval);
		}).then(res=>{
			return results[shop].push(res);
		});
	});
}

var checkSize = 10
for (var i = 0; i< checkSize * shops.length; i++) addJob(i);


var timeoutAt = setTimeout(()=>{
	throw 'Timed out';
}, maxTime * checkSize * shops.length);

var allDone = ()=>shops.reduce((d, s)=>(d && results[s].length == checkSize), true);

var checkIt = ()=>{
	if(allDone()){
		clearInterval(timeoutAt);
		shops.forEach(s=>{
			var lastIdx = -1;
			var r = results[s];
			console.log(s +' ' +r.reduce((ans, res)=>{

				var nxt = ans;

				if(res < lastIdx) nxt = 'fail at '+ res;
				lastIdx = res;
				return nxt;
				
			}, 'ok'));
			console.log(r.join('.'));
		});

	}else setTimeout(checkIt, 2000);
};

checkIt();