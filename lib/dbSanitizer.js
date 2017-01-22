module.exports = function sanitizer(sanitize, stub, spec){

	var update = Object.assign({}, stub, spec);
	var updateable = Object.keys(stub).filter(function(k){ return sanitize.indexOf(k) == -1;});

	var fieldList =[];
	updateable.forEach(function(k, idx){
		if(update[k] !== stub[k]){
			fieldList.push({
				name: k,
				value :update[k]
			});
		}
	});
	return fieldList;

};

