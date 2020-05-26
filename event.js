/******************
 ** EVENT SYSTEM **
 ******************/
// based on nodejs EventEmitter
// ok I like, never even use this...
// should I really keep it even..

function EventEmitter() {
	this.events = {};
}

EventEmitter.prototype.on = function(name, func) {
	if (this.events[name]) {
		return this.events[name].push(func)-1;
	} else {
		this.events[name] = [func];
		return 0;
	}
}

EventEmitter.prototype.removeListener = function(name, item) {
	var events = this.events[name]
	if (!events)
		return false;
	// this takes either an index (returned by .on) or a function reference
	if (item instanceof Function) {
		item = events.indexOf(item);
		if (item==-1)
			return false;
	}
	if (events[item]) {
		events[item] = undefined;
		return true;
	}
	return false;
}

EventEmitter.prototype.emit = function(name) {
	var $=this;
	var events = $.events[name];
	var args = Array.prototype.slice.call(arguments, 1);
	if (events) {
		events.forEach(function(event) {
			if (event) {
				event.apply($, args);
			}
		});
	}
}
