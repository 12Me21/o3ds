function LongPoller(myself) {
	this.myself = myself;
	this.cancel = [function(){}];
	this.lastListeners = {"0":{},"-1":{}};
	this.lastId = -1;
	this.statuses = {"0":"online"};
	this.countDown = 9999999;
}

LongPoller.prototype.start = function() {
	this.loop();
}

LongPoller.prototype.setState = function(text, state) {
	this.running = state;
	if (this.onStatus)
		this.onStatus.call(this, text);
}

LongPoller.prototype.updateAvatar = function() {
	this.setStatus(-1, ""+this.countDown);
	this.countDown--;
	this.refresh();
}

LongPoller.prototype.setStatus = function(id, status) {
	if (status == null)
		delete this.statuses[id];
	//todo: need to remove lastListeners[id] IF the user isn't also viewing that room
	else {
		this.statuses[id] = status;
		if (!this.lastListeners[id])
			this.lastListeners[id] = {"0":""};
		this.lastListeners[id][this.myself.uid] = status;
	}
}

LongPoller.prototype.loop = function() {
	var $=this;
	$.setState("Idle (waiting)", true);//idle
	// todo: we need to make sure that
	// every value in .statuses is also in .lastListeners
	// so we can sync clients and avoid status fighting
	$.myself.doListen($.lastId, $.statuses, $.lastListeners, undefined, this.cancel, function(e, resp) {
		try {
			console.log(resp);
			$.setState("Handling response", false);
			if (!e) {
				$.lastId = resp.lastId;
				if (resp.listeners) {
					$.lastListeners = resp.listeners;
					$.onListeners.call(this, resp.listeners, resp.chains.userMap);
				}
				var pageMap = {};
				if (resp.chains) {
					resp.chains.content && resp.chains.content.forEach(function(page) {
						pageMap[page.id] = page;
					});
					if (resp.chains.comment) {
						$.onMessages.call(this, resp.chains.comment, resp.chains.userMap, pageMap);
					}
					if (resp.chains.activity) {
						$.onActivity.call(this, resp.chains.activity, resp.chains.userMap, pageMap);
				}
					if (resp.chains.commentdelete)
						$.onDelete.call(this, resp.chains.commentdelete);
					$.onBoth.call(this, resp);
				}
			}
		} catch(e) {
			console.error(e);
		}
		if (!e || e=='timeout' || e=='rate') {
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

LongPoller.prototype.stop = function() {
	this.setState("Stopped.", false);
	this.cancel[0]();
}

LongPoller.prototype.refresh = function() {
	if (this.running) {
		this.cancel[0]();
		this.loop();
	}
}

LongPoller.prototype.setViewing = function(id) {
	if (this.viewing) {
		delete this.lastListeners[this.viewing];
		console.log("setting old status to ''");
		this.statuses[this.viewing]="";
	}
	if (id) {
		this.lastListeners[id] = {};
		this.statuses[id] = "active";
	}
	this.refresh();
	if (this.viewing) {
		delete this.statuses[this.viewing];
	}
	this.viewing = id;
}
