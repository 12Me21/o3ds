function DiscussionLongPoller(myself, callback) {
	this.myself = myself;
	
	this.firstId = 0; // minimum id for all rooms
	this.lastId = 0; // max comment id for all rooms

	this.idList = []; // list of discussion ids
	
	this.firstIds = {}; //first id per room
	this.lastIds = {}; //last id per room
	this.listeners = {}; //userlist per room
	
	this.cancel = [function(){}];
	this.callback = callback;
}

// ok so what this needs to do is
// 1: get info for the new room (room page contents, listeners, comments)
// 2: cancel the current longpoll
// 3: start a new longpoll with the updated info
DiscussionLongPoller.prototype.addRoom = function(id) {
	if (this.lastIds[id])
		return;
	var $=this;
	// todo: this doesn't get the listners
	// what we can do is maybe,
	// make 2 requests (one for listeners, the other for page contents)
	// and then when they BOTH finish, reload the long poller
	$.myself.getDiscussion(id, function(page, comments, userMap) {
		if (page) {
			$.callback.call($, comments, null, userMap, page);
			$.cancel[0]();
			$.listeners[id] = [0];
			if (comments.length) {
				$.firstIds[id] = comments[0].id;
				$.lastIds[id] = comments[comments.length-1].id;
			}
			$.updateIdRange();
			$.idList.push(id);
			$.running = true;
			$.loop();
		} else {
			$.callback.call($, null, null, null, false);
		}
	})
}

DiscussionLongPoller.prototype.updateIdRange = function() {
	this.firstId = Infinity;
	this.lastId = -Infinity;
	for (id in this.lastIds) {
		if (this.firstIds[id] < this.firstId)
			this.firstId = this.firstIds[id];
		if (this.lastIds[id] > this.lastId)
			this.lastId = this.lastIds[id];
	}
}

DiscussionLongPoller.prototype.reset = function() {
	this.stop();
	this.firstId = 0;
	this.lastId = 0;

	this.idList = [];
	
	this.firstIds = {};
	this.lastIds = {};
	this.listeners = {};
	
	this.cancel = [function(){}];
}

DiscussionLongPoller.prototype.removeRoom = function(id) {
	if (this.lastIds[id]) {
		// stop long poller
		this.cancel[0]();
		// remove info for current room
		delete this.listeners[id];
		delete this.firstIds[id];
		delete this.lastIds[id];
		var i = this.idList.indexOf(id);
		if (i >= 0)
			this.idList.splice(i, 1);
		// update first and last ids
		this.updateIdRange();
		// start long poller again
		this.loop();
	}
}

DiscussionLongPoller.prototype.stop = function() {
	this.running = false;
	this.cancel[0]();
}

DiscussionLongPoller.prototype.loop = function() {
	var $=this;
	$.myself.listenChat($.idList, $.firstId, $.lastId, $.listeners, function(e, comments, listeners, userMap){
		console.log("GOT COMMENTS", comments);
		if (!e) {
			comments = comments || [];
			comments.forEach(function(comment) {
				if (!$.lastIds[comment.parentId] || comment.id > $.lastIds[comment.parentId]) {
					$.lastIds[comment.parentId] = comment.id;
				}
			});
			$.updateIdRange();
			$.listeners = listeners || {};
			$.callback.call($, comments, listeners, userMap, null);
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
