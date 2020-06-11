function LongPoller(myself) {
	this.myself = myself;
	this.cancel = [function(){}];
	this.statuses = {};
	this.lastListeners = {};
	this.rooms = [];
	this.lastId = -1;
	this.setState("Not running yet", false);
	this.extraRoom;
	this.realRooms = [];
	// problem:
	// now ideally, we'd have this.rooms be a map of room id to all data for
	// that room (status, listeners, etc)
	// however, this means we wouldn't have the data in the proper format
	// to send in requests
	// options:
	// - keep the data in server format
	// - have data in both formats
	// - keep data in a good format, and convert it when making a request
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

LongPoller.prototype.setStatus = function(id, status) {
	this.statuses[id] = status;
	this.refresh();
}

LongPoller.prototype.addRoom = function(id, status) {
	if (this.rooms.indexOf(id) != -1)
		return;
	console.log("LP: adding room: ", id);
	this.rooms.push(id);
	this.lastListeners[id] = {"0": ""};
	//if (status)
		//this.statuses[id] = status;
	this.refresh();
}

// stop listening to a room
// this will set your status to ""
// so that frontends can see you've left immediately
// the server will remove you from the list entirely after a few seconds
// todo: have a way to add/remove multiple rooms without needing a reload
LongPoller.prototype.removeRoom = function(id) {
	var i = this.rooms.indexOf(id);
	if (i < 0)
		return;
	console.log("LP: removing room: ", id);
	this.rooms.splice(i, 1);
	delete this.lastListeners[id];
	//this.statuses[id] = "";
	this.refresh();
	delete this.statuses[id];
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

// this is the room you are currently viewing
// the `rooms` list is for rooms you're listening to but not actively viewing
// extraroom may or may not be in the rooms list,
// todo: make this actually work
// so there are 2 types of rooms you can be listening to
// first, the real rooms, which are added/removed with one set of functions
// next, the extra room, which is the room you're currently viewing,
// there will only be one of these at a time, and it gets replaced.
// but otherwise is treated normally, I guess
// this is for viewing a page and aaa brb
LongPoller.prototype.setExtraRoom = function(id, status) {
	if (this.extraRoom)
		this.removeRoom(this.extraRoom);
	this.extraRoom = id;
	if (this.extraRoom)
		this.addRoom(this.extraRoom, status);
}

LongPoller.prototype.loop = function() {
	var $=this;
	$.setState("Waiting for response", true);//idle
	var chain = ["comment.0id~messages-"+JSON.stringify({parentIds: $.rooms.concat(0)}), "user.1createUserId"];
	$.myself.doListen($.lastId, $.statuses, $.lastListeners, chain, this.cancel, function(e, resp) {
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
