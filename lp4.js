function LongPoller(myself) {
	this.myself = myself;
	this.cancel = [function(){}];
	this.lastListeners = {};
	this.lastId = -1;
	this.statuses = {};
}

LongPoller.prototype.start = function() {
	this.loop();
}

LongPoller.prototype.setState = function(text, state) {
	this.running = state;
	this.onStatus.call(this, text);
}

LongPoller.prototype.loop = function() {
	var $=this;
	$.setState("Idle (waiting)", true);//idle
	$.myself.doListen($.lastId, $.statuses, $.lastListeners, undefined, this.cancel, function(e, resp) {
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

LongPoller.prototype.refresh = function() {
	if (this.running) {
		this.cancel[0]();
		this.loop();
	}
}

LongPoller.prototype.setViewing = function(id) {
	if (this.viewing) {
		delete this.lastListeners[this.viewing];
		delete this.statuses[this.viewing];
	}
	this.lastListeners[id] = {"0":""};
	this.statuses[id] = "active";
	this.viewing = id;
	this.refresh();
}
