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
			alert("Request failed! "+code+" "+url);
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
			alert("Request failed! "+url);
			console.log("xhr onerror");
			callback('error');
		}
	}
	x.setRequestHeader('Cache-Control', "no-cache, no-store, must-revalidate");
	x.setRequestHeader('Pragma', "no-cache"); // for internet explorer
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
	EventEmitter.call(this);
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
Myself.prototype = Object.create(EventEmitter.prototype);
Object.defineProperty(Myself.prototype, 'constructor', {
	value: Myself,
	enumerable: false,
	writable: true
});

// make a request, passing auth automatically
// can trigger .logOut() 
Myself.prototype.request = function(url, method, callback, data, cancel) {
	var $=this;
	sbs2Request($.server+"/"+url, method, function(s, resp){
		if (s=='auth') {
			if ($.auth)
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
	$.emit('logout');
}
Myself.prototype.setAuth = function(auth) {
	this.auth = auth;
	var x = JSON.parse(atob(auth.split(".")[1]));
	this.uid = x.uid;
}
Myself.prototype.authenticate = function(username, password, callback) {
	var $=this;
	$.request("User/authenticate", "POST", function(s, resp) {
		callback.call($, s, resp);
	}, {username:username, password:password});
}
Myself.prototype.testAuth = function(callback) {
	this.getMe(callback);
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
			var uid = user.id
			if (uid == $.uid)
				$.me = user;
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

// call a function when user info is available
// runs immediately if user info is cached already
Myself.prototype.whenUser = function(id, callback) {
	if (this.userCache[id]) {
		callback.call(this, 'ok', this.userCache[id]);
	} else if (this.userRequests[id]) {
		this.userRequests[id].push(callback);
	} else {
		// oops... you didn't request the user yet
	}
}

// takes a list of user ids
// if any of these users are not currently cached,
// this will request their data
Myself.prototype.preloadUsers = function(uids) {
	var $=this;
	var filtered = [];
	uids.forEach(function(uid) {
		// if user is not in cache
		// and user request has not been made
		if (!$.userCache[uid] && !$.userRequests[uid] && filtered.indexOf(uid) == -1) {
			filtered.push(uid);
			$.userRequests[uid] = [];
		}
	});
	if (filtered.length) {
		$.getUsers({ids: filtered}, function(){});
	}
}

Myself.prototype.getMe = function(callback) {
	var $=this;
	$.request("User/me", "GET", function(s, resp) {
		resp = $.gotUsers(s, [resp]);
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
	var $=this;
	var cached = localStorage.getItem($.lsKey);
	
	if (cached) {
		got(cached);
	} else if (username) {
		$.authenticate(username, password, function(s, resp) {
			if (s=='ok') {
				localStorage.setItem($.lsKey, resp);
				got(resp);
			}
		});
	}

	function got(auth) {
		$.setAuth(auth);
		$.emit('login', false);
		$.getMe(function(){
			$.emit('login', true);
		})
		callback.call($, 'ok', auth);
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
			resp.reverse();
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
Myself.prototype.listenListeners = function(id, query, callback, cancel) {
	var $=this;
	var url = "Comment/listen/"+id+"/listeners"+queryString(query);
	$.request(url, "GET", function(s, resp) {
		callback.call($, s, resp);
	}, undefined, cancel);
}

Myself.prototype.getListeners = function(id, query, callback) {
	var $=this;
	var url = "Comment/listen/"+id+"/listeners"+queryString(query);
	$.request(url, "GET", function(s, resp) {
		callback.call($, s, resp);
	});
}

// 
Myself.prototype.getActivity = function(query, callback) {
	var $=this;
	$.request("Activity"+queryString(query), "GET", callback);
}

Myself.prototype.getCategories = function(callback) {
	var $=this;
	$.request("Category", "GET", function(s, resp){
		if (s=='ok') {
			callback.call($, buildCategoryTree(resp), resp);
		}
	});
}

function buildCategoryTree(categories) {
	var root = {childs: []};
	var orphans = [];
	var map = {
		'0': root
	};
	categories.forEach(function(cat) {
		cat.childs = [];
		map[cat.id] = cat;
	});
	categories.forEach(function(cat) {
		if (cat.parentId < 0)
			cat.parentId = 0;
		var parent = map[cat.parentId];
		if (parent) {
			cat.parent = parent;
			parent.childs.push(cat);
		} else {
			orphans.push(cat);
		}
	});
	return root;
}

function User(data, url) {
	if (data) {
		for (var key in data) {
			this[key] = data[key];
		}
		if (this.avatar && url) {
			this.avatarURL = url+"/File/raw/"+this.avatar+"?size=128&square=true";
		} else  {
			this.avatarURL = "./avatar.png"
		}
	}

}
