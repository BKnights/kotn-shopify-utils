
/**
 * cleans client supplied JSON data to only allow updates to valid fields
 * @param  {string[]} sanitize fields to restrict from update
 * @param  {object} stub     current object to be updated or default object
 * @param  {object} spec     supplied update
 * @return {string[]}        fields from spec to apply
 */
module.exports = function sanitizer(sanitize, stub, spec){


	var updateable = Object.keys(stub).filter((k)=>(sanitize.indexOf(k) == -1)); //keys not in sanitize
	var update = Object.assign({}, stub, spec);
	
	var fieldList =[];
	updateable.forEach((k)=>{
		if(update[k] !== stub[k]){
			fieldList.push({
				name: k,
				value :update[k]
			});
		}
	});
	return fieldList;

};