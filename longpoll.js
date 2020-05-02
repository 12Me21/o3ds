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
LongPoller.prototype.start = function() {
	var $=this;
	var cancel = [];
	$.myself.listen($.id, {lastid: $.lastid}, function(s, resp) {
		if (s=='ok') {
			if (resp) {
				var newest = resp[resp.length-1];
				if (newest) {
					$.lastid = newest.id;
				}
			}
			$.callback(resp);
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
