const events = require('events');

const queues = {};

function QueueStack(shop){
	this.shop = shop;
	this.stack = [];
	this.current = null;
}

QueueStack.prototype.tickNext = function(job){
	// console.log(this.shop + ' ' + this.stack.length + ' check tick with ' + (job? ' job' : ' -- '));
	if(!job && this.current){
		return;
	}
	var top = this.stack.pop();

	if(top){
		this.current = top;
		setImmediate(()=>{
			top.emit('trigger');
		});
	}else this.current = null;
};

QueueStack.prototype.add = function(job){
	var self = this;
	var jobWrap = new events.EventEmitter();

	jobWrap.job = new Promise((resolve, reject)=>{
		
		jobWrap.on('trigger', ()=>{
			job().then(res=>{
				resolve(res);
				self.tickNext(jobWrap);
			}).catch(err=>{
				reject(err);
				self.tickNext(jobWrap);
			});
		});
	});


	this.stack.unshift(jobWrap);
	this.tickNext();

	return jobWrap.job;
};


function serializeHook (db, shop, order, p){
	var token = order.token;
	if(!token){
		var tokening = [shop];
		if(order.gateway) tokening.push('transaction');
		if(order.status) tokening.push(order.status);
		if(order.id) tokening.push(order.id);
		if(tokening.length  < 3) throw new Error('Cannot assume token for serialization control');
		token = tokening.join('.');
	}

	var queue = queues[shop] || new QueueStack(shop);
	queues[shop] = queue;
	return queue.add(p);

	// return db.tx((t)=>{
	// 	console.log('serializing order transaction '+ shop);
	// 	return t.none('select * from order_queue where order_token = $1', [token]).
	// 		then(()=>{
	// 			console.log('no pending order token. proceeding');
	// 			return t.none('insert into order_queue (order_token) values($1)', [token]);
	// 		}).
	// 		then(()=>{
	// 			console.log('made pending order token. processing');
	// 			return p();
	// 		}).
	// 		then((res)=>{
	// 			console.log('finished pending order. releasing token');
	// 			return t.none('delete from order_queue where order_token = $1', [token]).then(()=>(res));
	// 		});
	// }).catch((err)=>{
	// 	console.log('got err on '+shop +' '+ (order.name || token) +'\n'+err.message);
	// 	return null;
	// });
}

module.exports = serializeHook;