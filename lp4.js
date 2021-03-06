function LongPoller(myself) {
	this.myself = myself
	this.cancel = [function(){}]
	this.lastListeners = {"-1":{"0":""}}
	this.lastId = -1
	this.statuses = {"-1":"online","0":"online"}
	this.defaultStatus = "active"
	//this.counter = 1
}

LongPoller.prototype.start = function() {
	this.loop()
}

LongPoller.prototype.getGlobalStatuses = function() {
	return this.lastListeners[-1] || {}
}

LongPoller.prototype.setGlobalStatus = function(text) {
	if (text == undefined) {
		this.statuses[0] = ""
		this.statuses[-1] = ""
	} else {
		this.statuses[0] = text
		this.statuses[-1] = text
	}
	this.refresh()
	if (text == undefined) {
		delete this.statuses[0]
		delete this.statuses[-1]
	}
}
	
LongPoller.prototype.setState = function(text, state) {
	this.running = state
	if (this.onStatus)
		this.onStatus.call(this, text)
}

LongPoller.prototype.setStatus = function(id, status) {
	if (status == null)
		delete this.statuses[id]
	//todo: need to remove lastListeners[id] IF the user isn't also viewing that room
	else {
		this.statuses[id] = status
		/*
		if (!this.lastListeners[id])
			this.lastListeners[id] = {"0":""}
		this.lastListeners[id][this.myself.uid] = status*/
	}
}

LongPoller.prototype.blockCancel = function() {
	// todo: prevent request from being cancelled, but
	// make sure .loop() doesn't get called, if something tries
}

LongPoller.prototype.loop = function() {
	var $=this
	$.setState("Idle (waiting)", true)//idle
	// todo: we need to make sure that
	// every value in .statuses is also in .lastListeners
	// so we can sync clients and avoid status fighting
	var cancelled
	var x = $.myself.doListen($.lastId, $.statuses, $.lastListeners, undefined, [], function(e, resp) {
		if (cancelled) {
			console.warn("long poller tried to run after being aborted!")
			return
		}
		try {
			$.setState("Handling response", false)
			if (!e) {
				$.lastId = resp.lastId
				if (resp.listeners) {
					$.lastListeners = resp.listeners
					$.onListeners.call(this, resp.listeners, resp.chains.userMap)
				}
				var pageMap = {}
				if (resp.chains) {
					resp.chains.content && resp.chains.content.forEach(function(page) {
						pageMap[page.id] = page
					})
					if (resp.chains.comment) {
						$.onMessages.call(this, resp.chains.comment, resp.chains.userMap, pageMap)
					}
					if (resp.chains.activity) {
						$.onActivity.call(this, resp.chains.activity, resp.chains.userMap, pageMap, resp.chains)
				}
					if (resp.chains.commentdelete)
						$.onDelete.call(this, resp.chains.commentdelete)
					$.onBoth.call(this, resp)
				}
			}
		} catch(e) {
			console.error(e)
		}
		if (!e || e=='timeout' || e=='rate') {
			$.setState("Queueing next request", true)
			var t = setTimeout(function() {
				$.loop()
			}, 0)
			$.cancel = [function() {
				clearTimeout(t)
			}]
		} else {
			$.setState("Error!", false)
			alert("LONG POLLER FAILED:"+resp)
			console.log("LONG POLLER FAILED", e, resp)
		}
	})
	this.cancel[0] = function() {
		cancelled = true
		x.abort()
	}
}

LongPoller.prototype.stop = function() {
	this.setState("Stopped.", false)
	this.cancel[0]()
}

LongPoller.prototype.refresh = function() {
	if (this.running) {
		this.cancel[0]()
		this.loop()
	}
}

LongPoller.prototype.setListening = function(ids) {
	var $=this
	var newListeners = {"-1":$.lastListeners[-1]}
	ids.forEach(function(id) {
		newListeners[id] = $.lastListeners[id] || {"0":""}
	})
	$.lastListeners = newListeners
}

LongPoller.prototype.setViewing = function(id, status) {
	if (this.viewing) {
		delete this.lastListeners[this.viewing]
		if (this.statuses[this.viewing] != undefined)
			this.statuses[this.viewing]=""
	}
	if (typeof status == "undefined")
		status = this.defaultStatus
	if (id) {
		this.lastListeners[id] = {"0":""}
		this.setStatus(id, status)
	}
	this.refresh()
	if (this.viewing) {
		delete this.statuses[this.viewing]
	}
	this.viewing = id
}
