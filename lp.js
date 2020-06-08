function LongPoller(myself, callback) {
	this.myself = myself;
	
	this.firstId = 0; // minimum id for all rooms
	this.lastId = 0; // max comment id for all rooms

	this.idList = []; // list of discussion ids
	
	this.firstIds = {}; //first id per room
	this.lastIds = {}; //last id per room
	this.listeners = {}; //userlist per room
	this.statuses = {};

	this.cancel = [function(){}];
	this.callback = callback;
}

// ok so what this needs to do is
// 1: get info for the new room (room page contents, listeners, comments)
// 2: cancel the current longpoll
// 3: start a new longpoll with the updated info
LongPoller.prototype.addRoom = function(id) {
	if (this.lastIds[id])
		return;
	var $=this;
	// todo: this doesn't get the listners
	// what we can do is maybe,
	// make 2 requests (one for listeners, the other for page contents)
	// and then when they BOTH finish, reload the long poller
	$.myself.getDiscussion(id, function(page, comments, userMap) {
		if (page) {
			console.log("GOT COMMENTS INITIAL", comments);
			$.callback.call($, comments, null, userMap, page);
			$.cancel[0]();
			$.listeners[id] = {};
			$.listeners[id]['0'] = "";
			
			$.statuses[id] = "active";
			$.updateIdRange(comments);
			$.idList.push(id);
			$.running = true;
			$.loop();
		} else {
			$.callback.call($, null, null, null, false);
		}
	})
}

LongPoller.prototype.updateIdRange = function(comments) {
	var $=this
	if (comments) {
		comments.forEach(function(comment) {
			if (!$.lastIds[comment.parentId] || comment.id > $.lastIds[comment.parentId]) {
				$.lastIds[comment.parentId] = comment.id;
			}
		});
	}
	this.firstId = Infinity;
	this.lastId = -Infinity;
	for (id in this.lastIds) {
		if (this.firstIds[id] < this.firstId)
			this.firstId = this.firstIds[id];
		if (this.lastIds[id] > this.lastId)
			this.lastId = this.lastIds[id];
	}
}

LongPoller.prototype.reset = function() {
	this.stop();
	this.firstId = 0;
	this.lastId = 0;

	this.idList = [];
	
	this.firstIds = {};
	this.lastIds = {};
	this.listeners = {};
	this.statuses = {};
	
	this.cancel = [function(){}];
}

LongPoller.prototype.removeRoom = function(id) {
	if (this.lastIds[id]) {
		// stop long poller
		this.cancel[0]();
		// remove info for current room
		delete this.listeners[id];
		delete this.firstIds[id];
		delete this.lastIds[id];
		delete this.statuses[id];
		var i = this.idList.indexOf(id);
		if (i >= 0)
			this.idList.splice(i, 1);
		// update first and last ids
		this.updateIdRange();
		// start long poller again
		this.loop();
	}
}

LongPoller.prototype.stop = function() {
	this.running = false;
	this.cancel[0]();
}

LongPoller.prototype.loop = function() {
	var $=this;
	$.myself.listenChat($.idList, $.firstId, $.lastId, $.statuses, $.listeners, function(e, comments, lastId, listeners, userMap){
		if (!e) {
			comments = comments || [];

			// if listeners is not set, then we don't have new listeners data
			// so we pass the old listeners list to the next LP req
			// but DON'T pass this old list to the callback
			// since we don't have associated users anymore !
			if (listeners) {
				for (room in listeners) {
					var r = listeners[room]
					var rl = {};
					for (key in r) {
						rl[(key+"").match(/\d+/)[0]] = r[key];
					}
					listeners[room] = rl;
				}

				$.listeners = listeners;
			}

			$.updateIdRange(comments);
			
			$.callback.call($, comments, listeners, userMap, null);
			$.lastId = lastId;
		}
		if (!e || e=='timeout') {
			$.running = true;
			var t = setTimeout(function() {
				$.loop();
			}, 0);
			$.cancel = [function() {
				clearTimeout(t);
			}]
		} else {
			$.running = false;
			alert("LONG POLLER FAILED");
			console.error("LONG POLLER FAILED");
		}
	}, $.cancel);
}

// so lastid, what we have to do is
// normally, just pass the id from the prev. response
// except, when joining a new roo
