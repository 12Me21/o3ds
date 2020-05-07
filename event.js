/******************
 ** EVENT SYSTEM **
 ******************/
// based on nodejs EventEmitter

function EventEmitter() {
	this._events = {};
}

EventEmitter.prototype.on = function(name, func) {
	if (this._events[name]) {
		return this._events[name].push(func)-1;
	} else {
		this._events[name] = [func];
		return 0;
	}
}

EventEmitter.prototype.removeListener = function(name, item) {
	var events = this._events[name]
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
	var events = this._events[name];
	var args = Array.prototype.slice.call(arguments, 1);
	if (events) {
		events.forEach(function(event) {
			if (event) {
				event.apply(this, args);
			}
		});
	}
}
