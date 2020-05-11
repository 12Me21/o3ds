function makeLongPoller(cls) {
	cls.prototype.stop = function() {
		this.running = false;
		this.cancel();
	};
	cls.prototype.start = function() {
		var $=this;
		$.initRequest.call($, function(s, resp) {
			if (s=='ok') {
				$.running = true;
				$.callback(true, $.initCallback(resp));
				$.loop();
			} else {
				console.error("LONG POLLER FAILED INITIAL");
			}
		});
	};
	cls.prototype.loop = function() {
		var $=this;
		var cancel = [];
		$.loopRequest.call($, function(s, resp) {
			if (s=='ok') {
				$.callback(false, $.loopCallback(resp));
			}
			if (s=='ok' || s=='timeout') {
				$.running = true;
				var t = setTimeout(function() {
					$.loop();
				}, 0);
				$.cancel = function() {
					clearTimeout(t);
				}
			} else {
				$.running = false;
				console.error("LONG POLLER FAILED");
			}
		}, cancel);
		$.cancel = cancel[0];
	};
}
function initLongPoller(myself, id, callback) {
	this.myself = myself;
	this.id = +id;
	this.callback = callback;
	this.cancel = function(){};
	this.running = false;
}

function CommentLongPoller(myself, id, initial, callback) {
	initLongPoller.call(this, myself, id, callback);
	this.initialCommentCount = initial;
}
makeLongPoller(CommentLongPoller);
CommentLongPoller.prototype.initRequest = function(callback) {
	this.myself.getLastComments(this.id, this.initialCommentCount, callback);
}
CommentLongPoller.prototype.loopRequest = function(callback, cancel) {
	this.myself.listen(this.id, {lastid: this.lastid}, callback, cancel);
}
CommentLongPoller.prototype.initCallback =
	CommentLongPoller.prototype.loopCallback =
		function(resp) {
			var newest = resp[resp.length-1];
			if (newest)
				this.lastid = newest.id;
			return resp;
		};

function ListLongPoller(myself, id, callback) {
	initLongPoller.call(this, myself, id, callback);
}
makeLongPoller(ListLongPoller);
ListLongPoller.prototype.initRequest = function(callback) {
	this.myself.listenListeners(this.id, {}, callback);
}
ListLongPoller.prototype.loopRequest = function(callback, cancel) {
	this.myself.listenListeners(this.id, {lastListeners: this.lastListeners}, callback, cancel);
}
ListLongPoller.prototype.initCallback =
	ListLongPoller.prototype.loopCallback =
		function(resp) {
			var users = resp.map(function(li){
				return li.userId;
			});
			this.lastListeners = users;
			return users;
		}
