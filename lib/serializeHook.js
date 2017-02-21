function serializeHook (db, shop, order, p){
	var token = order.token;
	if(!token){
		var tokening = [shop];
		if(order.gateway) tokening.push('transaction');
		if(order.status) tokening.push(order.status);
		if(order.id) tokening.push(order.id);
		if(tokening.length  < 3) throw "Cannot assume token for serialization control";
		token = tokening.join('.');
	}

	return db.tx(function(t){
		console.log('serializing order transaction '+ shop);
		return t.none("select * from order_queue where order_token = $1", [token]).
		then(function(){
			console.log('no pending order token. proceeding');
			return t.none("insert into order_queue (order_token) values($1)", [token]);
		}).
		then(function(){
			console.log('made pending order token. processing');
			return p();
		}).
		then(function(res){
			console.log('finished pending order. releasing token');
			return t.none("delete from order_queue where order_token = $1", [token]).
			then(function(){
				return res;
			});
		});
	})['catch'](function(err){
		console.log('got err on '+shop +' '+ (order.name || token) +'\n'+err.message);
	});
}

module.exports = serializeHook;