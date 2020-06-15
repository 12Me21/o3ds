function LongPoller(myself) {
	this.myself = myself;
	this.cancel = [function(){}];
	this.lastListeners = {};
	this.lastId = -1;
	this.setState("Not running yet", false);

	this.rooms = {};
	this.leaving = {};
	this.visiting = null;
	// problem:
	// now ideally, we'd have this.rooms be a map of room id to all data for
	// that room (status, listeners, etc)
	// however, this means we wouldn't have the data in the proper format
	// to send in requests
	// options:
	// - keep the data in server format
	// - have data in both formats
	// - keep data in a good format, and convert it when making a request
	var $=this;
}

LongPoller.prototype.leaveAll = function() {
	console.log("leaving all");
	for (id in this.rooms) {
		this.leaving[id] = true;
	}
	this.rooms = {};
	this.lastListeners = {};
	this.refresh();
}

LongPoller.prototype.getStatuses = function() {
	var statuses = {};
	for (var id in this.rooms) {
		var room = this.rooms[id];
		if (room.status != null)
			statuses[id] = room.status;
	}
	//for (var id in this.leaving)
	//	statuses[id] = "";
	this.leaving = {};
	return statuses;
}

LongPoller.prototype.getRoomIds = function() {
	var ids = [];
	for (var id in this.rooms) {
		ids.push(+id);
	}
	return ids;
}

LongPoller.prototype.setState = function(text, state) {
	this.running = state;
}

LongPoller.prototype.stop = function() {
	this.cancel[0]();
	this.setState("Stopped", false);
}

LongPoller.prototype.start = function() {
	if (this.myself.auth) {
		console.log("LP: starting long poller");
		this.loop();
	}
}

// change your status in a room
LongPoller.prototype.setStatus = function(id, status) {
	if (status != null)
		this.rooms[id].status = status;
	else
		delete this.rooms[id].status;
	this.refresh();
}

// join a room
LongPoller.prototype.joinRoom = function(id, status) {
	if (this.rooms[id])
		return;
	this.lastListeners[id] = {"0": ""};
	this.rooms[id] = {};
	if (status != null)
		this.rooms[id].status = status;
	console.log("joining room", id);
	return true;
}

// stop listening to a room
// this will set your status to ""
// so that frontends can see you've left immediately
// the server will remove you from the list entirely after a few seconds
LongPoller.prototype.leaveRoom = function(id) {
	if (!this.rooms[id])
		return;
	delete this.lastListeners[id];
	delete this.rooms[id];
	this.leaving[id] = true;
	console.log("leaving room", id);
	return true;
}

// cancel the current request and start a new one
// this is used when you want to update the request parameters
// to avoid having to wait for the next response
LongPoller.prototype.refresh = function() {
	//	this.setState("Refreshing", false);
	if (this.running) {
		console.log("LP: refreshing");
		this.cancel[0]();
		this.loop();
	}
}

LongPoller.prototype.setVisiting = function(id, status) {
	var change
	if (this.visiting) {
		// leave old visiting room
		change = this.leaveRoom(this.visiting);
		this.visiting = null;
	}
	if (id) {
		// joining a new room
		if (!this.rooms[id]) {
			this.visiting = id;
			this.joinRoom(this.visiting, status);
			change = true;
		}
	}
	change && this.refresh();
}

LongPoller.prototype.addRoom = function(id, status) {
	if (this.rooms[id]) {
		// if adding the visiting room, remove the visiting status
		if (this.visiting == id)
			this.visiting = null;
	} else {
		this.joinRoom(id, status);
		this.refresh();
	}
}

LongPoller.prototype.removeRoom = function(id) {
	if (!this.rooms[id])
		return;
	// don't leave if the room is also being visited
	if (this.visiting != id)
		this.leaveRoom(id);
}

LongPoller.prototype.loop = function() {
	var $=this;
	$.setState("Waiting for response", true);//idle
	var chain = ["comment.0id~messages-"+JSON.stringify({parentIds: $.getRoomIds().concat(0)}), "user.1createUserId"];
	$.myself.doListen($.lastId, $.getStatuses(), $.lastListeners, chain, this.cancel, function(e, resp) {
		$.setState("Handling response", false);
		if (!e) {
			$.lastId = resp.lastId;
			if (resp.listeners) {
				$.lastListeners = resp.listeners;
				$.onListeners.call(this, resp.listeners, resp.chains.userMap);
			}
			if (resp.chains && resp.chains.messages)
				$.onMessages.call(this, resp.chains.messages, resp.chains.userMap);
		}
		if (!e || e=='timeout') {
			$.setState("Queueing next request", true);
			var t = setTimeout(function() {
				$.loop();
			}, 0);
			$.cancel = [function() {
				clearTimeout(t);
			}]
		} else {
			$.setState("Error!", false);
			alert("LONG POLLER FAILED:"+resp);
			console.log("LONG POLLED FAILED", e, resp);
		}
	});
}

