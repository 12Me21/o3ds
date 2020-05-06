// #########################
//  REQUEST CALLBACK FORMAT
// #########################
// Generally, request callbacks will be passed 2 values:
// status: String
//  the result status of the request (similar to http status codes)
//  possible values:
//  'ok' - request was successful (http 200)
//  'auth' - request failed due to invalid auth token (http 401)
//  'timeout' - request timed out (http 204/408)
//  'error' - any other error
// data: String, Object, or undefined
//  the data returned by the response, if any
//  if the text was JSON, it will be parsed, otherwise left as a string
//  this may contain information about errors in the case of a non-ok status

// Make a request to the sbs2 api
// endpoint: path
// callback: function, will be passed (status, data)
//           status is "ok", "auth" (invalid auth error), "timeout" (timeout), "error" (other error)
//           data is the data, either an object or a string
// data: data to send (optional)
// auth: auth token (optional)
function sbs2Request(url, method, callback, data, auth, cancel) {
	console.info("Making request",url);
	var x = new XMLHttpRequest();
	if (cancel)
		cancel[0] = function() {
			x.abort();
		}
	x.open(method, url);
	var start = Date.now();
	x.onload = function() {
		var code = x.status;
		var type = x.getResponseHeader('Content-Type');
		if (/^application\/json(?!=\w)/.test(type)) {
			try {
				var resp = JSON.parse(x.responseText);
			} catch(e) {
				resp = null;
			}
		} else {
			resp = x.responseText;
		}
		if (code==200) {
			callback('ok', resp);
		} else if (code==408 || code==204) {
			// record says server uses 408, testing showed only 204
			// basically this is treated as an error condition,
			// except during long polling, where it's a normal occurance
			callback('timeout', resp);
		} else if (code==401) {
			console.log(x);
			callback('auth', resp);
		} else {
			alert("Request failed! "+code);
			console.log("sbs2Request: request failed! "+code);
			console.log(x.responseText);
			callback('error', resp, code);
		}
	}
	x.onerror = function() {
		var time = Date.now()-start;
		console.log("xhr onerror after ms:"+time);
		if (time > 18*1000) {
			console.log("detected 3DS timeout");
			callback('timeout');
		} else {
			alert("Request failed!");
			console.log("xhr onerror");
			callback('error');
		}
	}
	if (auth)
		x.setRequestHeader('Authorization', "Bearer "+auth);
	if (data) {
		x.setRequestHeader('Content-Type',"application/json;charset=UTF-8");
		x.send(JSON.stringify(data));
	} else {
		x.send();
	}
}

function queryString(obj) {
	if (!obj)
		return "";
	var items = [];
	for (var key in obj) {
		var val = obj[key];
		if (typeof val != 'undefined'){
			var item = encodeURIComponent(key)+"=";
			// array items are encoded as
			// ids:[1,2,3] -> ids=1&ids=2&ids=3
			
			if (val instanceof Array) {
				for(var i=0;i<val.length;i++){
					items.push(item+encodeURIComponent(val[i]));
				}
			// otherwise, key=value
			} else {
				items.push(item+encodeURIComponent(val));
			}
		}
	}
	
	if (items.length)
		return "?"+items.join("&");
	else
		return "";
}

// requester thing
function Myself(dev) {
	var protocol = "https:";
	if (window.location.protocol=="http:")
		protocol = "http:";
	if (dev) {
		this.server = protocol+"//newdev.smilebasicsource.com/api";
		this.lsKey = "devauth"
	} else {
		this.server = protocol+"//new.smilebasicsource.com/api";
		this.lsKey = "auth"
	}
	this.userCache = {};
	this.userRequests = {};
}
// make a request, passing auth automatically
// can trigger .logOut() 
Myself.prototype.request = function(url, method, callback, data, cancel) {
	var $=this;
	sbs2Request($.server+"/"+url, method, function(s, resp){
		if (s=='auth') {
			$.logOut();
			callback.call($, s, resp);
		} else {
			callback.call($, s, resp);
		}
	}, data, $.auth, cancel)
}

// ######
//  User
// ######

// Call to trigger a logout event (TODO)
// called automatically whenever a request has status "auth" (400/401)
Myself.prototype.logOut = function() {
	// todo: it's possible for this to get called when not logged in
	// like, when trying to log in with an incorrect password
	var $=this;
	$.auth = undefined;
	localStorage.removeItem($.lsKey);
	console.log("auth error, logging out");
}
Myself.prototype.setAuth = function(auth) {
	this.auth = auth;
	var x = JSON.parse(atob(auth.split(".")[1]));
	this.uid = x.uid;
}
Myself.prototype.authenticate = function(username, password, callback) {
	var $=this;
	$.request("User/authenticate", "POST", function(s, resp) {
		if (s=='ok') {
			$.setAuth(resp);
		}
		callback.call($, s, resp);
	}, {username:username, password:password});
}
Myself.prototype.testAuth = function(callback) {
	var $=this;
	$.request("User/me","GET",function(s, resp) {
		callback.call($, s, resp);
	});
};
Myself.prototype.getUsers = function(query, callback) {
	var $=this;
	$.request("User"+queryString(query), "GET", function(s, resp) {
		$.gotUsers(s, resp);
		callback.call($, s, resp);
	});
}

Myself.prototype.gotUsers = function(s, resp) {
	var $=this;
	if (s=='ok') {
		resp.forEach(function(user) {
			user = new User(user, $.server);
			var uid=user.id
			$.userCache[uid] = user;
			if ($.userRequests[uid]) {
				$.userRequests[uid].forEach(function(func) {
					func.call($, s, user);
				});
				$.userRequests[uid] = undefined;
			}
		});
	}
	return resp;
}

Myself.prototype.getUser = function(id, callback) {
	var $=this;
	$.request("User?ids="+id, "GET", function(s, resp) {
		$.gotUsers(s, resp);
		if (s=='ok')
			resp = new User(resp[0], $.server);
		callback.call($, s, resp);
	});
}
Myself.prototype.getUserCached = function(id, callback) {
	var $=this;
	if (this.userCache[id]) {
		callback.call($, 'ok', this.userCache[id]);
	} else {
		if (this.userRequests[id]) {
			this.userRequests[id].push(callback);
		} else {
			$.userRequests[id] = [callback];
			$.request("User?ids="+id, "GET", function(s, resp) {
				$.gotUsers(s, resp);
			});
		}
	}
}
Myself.prototype.preloadUsers = function(uids) {
	var $=this;
	var filtered = [];
	uids.forEach(function(uid) {
		if (!$.userCache[uid] && filtered.indexOf(uid) == -1) {
			filtered.push(uid);
			$.userRequests[uid] = []; //this is kind of a hack
			// the entire user cache system could really use
			// a rewrite
			// I wonder if
			// making a general system would be worth it
			// is there anything else
			// that works like this
			// it's possible, but I can't think of any
			// examples,
			// 
		}
	});
	if (filtered.length) {
		$.getUsers({ids: filtered}, function(){});
	}
}
Myself.prototype.getMe = function(callback) {
	var $=this;
	$.request("User/me", "GET", function(s, resp) {
		resp = $.gotUser(s, resp);
		callback.call($, s, resp);
	});
}
Myself.prototype.putBasic = function(data, callback) {
	var $=this;
	$.request("User/basic", "PUT", callback, data);
}
Myself.prototype.postSensitive = function(data, callback) {
	var $=this;
	$.request("User/sensitive", "POST", callback, data);
}

// simple log in function
Myself.prototype.logIn = function(username, password, callback) {
	console.log("login called");
	var $=this;
	try {
		var cached = localStorage.getItem($.lsKey);
		console.log("read localstorage");
		if (cached) {
			console.log("found cached auth");
			$.setAuth(cached);
			/*$.testAuth(function(s, resp) {
			  if (s=='ok')
			  got('ok', cached);
			  else {
			  $.authenticate(username, password, got);
			  }
			  });*/ // safer
			// less safe version, assumes cached auth is valid if it exists
			// if auth is not valid, will trigger a logout, but not immediately
			callback.call($, 'ok', cached);
			console.log("testing cached auth...");
			$.testAuth(function(){});
		} else if (username) {
			console.log("logging in");
			$.authenticate(username, password, got);
		}
		
		function got(s, resp) {
			console.log("logged in, maybe");
			if (s=='ok') {
				localStorage.setItem($.lsKey, resp);
				callback.call($, s, resp);
			} else
				callback.call($, s, resp);	
		}
	} catch(e) {
		alert("log in func error "+e);
	}
}

// ##########
//  Comments
// ##########
Myself.prototype.postComment = function(comment, callback) {
	var $=this;
	$.request("Comment", "POST", callback, comment);
}
Myself.prototype.putComment = function(comment, callback) {
	var $=this;
	$.request("Comment/"+comment.id, "PUT", callback, comment);
}
Myself.prototype.deleteComment = function(id, callback) {
	var $=this;
	$.request("Comment/"+id, "DELETE", callback);
}
Myself.prototype.getComments = function(query, callback) {
	var $=this;
	$.request("Comment"+queryString(query), "GET", callback);
}
Myself.prototype.getComment = function(id, callback) {
	var $=this;
	$.request("Comment?ids="+id, "GET", function(s, resp){
		if (s=='ok')
			resp = resp[0];
		callback.call($, s, resp);
	});
}
// returns the last `count` comments, lowest ID first
Myself.prototype.getLastComments = function(parent, count, callback) {
	var $=this;
	this.getComments({
		parentids: parent,
		reverse: true,
		limit: count
	}, function(s, resp) {
		if (s=='ok' && resp instanceof Array)
			resp = resp.reverse();
		callback.call($, s, resp);
	});
}
Myself.prototype.listen = function(id, query, callback, cancel) {
	var $=this;
	var url = "Comment/listen/"+id+queryString(query);
	$.request(url, "GET", function(s, resp) {
		callback.call($, s, resp);
	}, undefined, cancel);
}

// 
Myself.prototype.getActivity = function(query, callback) {
	var $=this;
	$.request("Activity"+queryString(query), "GET", callback);
}

function User(data, url) {
	if (data) {
		for (var key in data) {
			this[key] = data[key];
		}
		if (this.avatar && url) {
			this.avatarURL = url+"/File/raw/"+this.avatar;
		}
	}

}
