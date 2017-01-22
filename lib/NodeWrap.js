

function NodeWrap(n, doc){
	this.n = n;
	this.doc = doc || null;
}

NodeWrap.prototype.addChild = function(nsURI, elemName, simpleValue, emitEmpty){
	var doc = this.getDocumentElement();

	var makeSimple = simpleValue !== null && typeof simpleValue !== 'undefined';

	if(makeSimple && !simpleValue && !emitEmpty) return this;

	var child = nsURI ? 
		doc.createElementNS(nsURI, elemName) :
		doc.createElement(elemName);
	this.n.appendChild(child);
	if(makeSimple) {
		child.appendChild(doc.createTextNode(simpleValue));
		return this;
	}
	return new NodeWrap(child);

};

NodeWrap.prototype.replaceChild = function(nsURI, elemName, simpleValue, emitEmpty){
	var doc = this.getDocumentElement();

	var makeSimple = simpleValue !== null && typeof simpleValue !== 'undefined';

	var target = null;
	var testNode = this.n.firstChild;
	while (testNode){
		if(testNode.nodeType == 1 && testNode.tagName == elemName){
			target = testNode;
			break;
		}
		testNode = testNode.nextSibling;
	}

	if(makeSimple && !simpleValue && !emitEmpty) {
		if(target) target.parentNode.removeChild(target);
		return this;
	}

	var child = nsURI ? 
		doc.createElementNS(nsURI, elemName) :
		doc.createElement(elemName);

	if(target) target.parentNode.replaceChild(child, target);
	else this.n.appendChild(child);

	if(makeSimple) {
		child.appendChild(doc.createTextNode(simpleValue));
		return this;
	}
	return new NodeWrap(child);
};

NodeWrap.prototype.getDocumentElement = function(){
	if(!this.doc){
		if(this.n.documentElement) {
			this.doc = this.n.documentElement;
		}else {
			var parent = this.n.parentNode;
			while(parent){
				if(parent.documentElement){
					this.doc = parent;
					break;
				}
				parent = parent.parentNode;
			}
		}
	}
	return this.doc;
};

module.exports = NodeWrap;