// depends on Myself


// create a new long poller
// myself: Myself
// id: Number
// callback: Function([Comment...])
function LongPoller(myself, id, callback) {
	this.myself = myself;
	this.id = +id;
	this.callback = callback;
	this.cancel = function(){};
}

// stop long poller
// can be resumed later
LongPoller.prototype.stop = function() {
	this.cancel();
}

// start the long poller
// .callback(data) will be called each time data is recieved
// initial: Number - the number of old messages to request. if ommitted, requests entire history (slow! don't do this!)
LongPoller.prototype.start = function(initial) {
	var $=this;
	if (initial) {
		this.myself.getLastComments(this.id, initial, function(s, resp) {
			if (s=='ok') {
				var newest = resp[resp.length-1];
				if (newest)
					$.lastid = newest.id;
				$.callback.call($, resp, true);
				$.start();
			} else {
				console.error("LONG POLLER FAILED INITIAL");
			}
		});
		return;
	}
	var cancel = [];
	$.myself.listen($.id, {lastid: $.lastid}, function(s, resp) {
		if (s=='ok') {
			if (resp) {
				var newest = resp[resp.length-1];
				if (newest) {
					$.lastid = newest.id;
				}
			}
			$.callback.call($,resp);
		}
		if (s=='ok' || s=='timeout') {
			var t = setTimeout(function() {
				$.start();
			}, 0);
			$.cancel = function() {
				clearTimeout(t);
			}
		} else {
			console.error("LONG POLLER FAILED");
		}
	}, cancel);
	$.cancel = cancel[0];
}


// create a new long poller
// myself: Myself
// id: Number
// callback: Function([Comment...])
function ListLongPoller(myself, id, callback) {
	this.myself = myself;
	this.id = +id;
	this.callback = callback;
	this.cancel = function(){};
}

// stop long poller
// can be resumed later
ListLongPoller.prototype.stop = function() {
	this.cancel();
}

ListLongPoller.prototype.start = function(initial) {
	var $=this;
	if (initial) {
		this.myself.getListeners(this.id, undefined, function(s, resp) {
			if (s=='ok') {
				var users = resp.map(function(li){return li.userId});
				$.lastListeners = users;
				$.callback.call($, users, true);
				$.start();
			} else {
				console.error("LONG POLLER FAILED INITIAL");
			}
		});
		return;
	}
	var cancel = [];
	$.myself.listenListeners($.id, {lastListeners: $.lastListeners}, function(s, resp) {
		if (s=='ok') {
			var users = resp.map(function(li){return li.userId});
			$.lastListeners = users;
			$.callback.call($, users);
		}
		if (s=='ok' || s=='timeout') {
			var t = setTimeout(function() {
				$.start();
			}, 0);
			$.cancel = function() {
				clearTimeout(t);
			}
		} else {
			console.error("LONG POLLER FAILED");
		}
	}, cancel);
	$.cancel = cancel[0];
}
