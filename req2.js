// #########################
//  REQUEST CALLBACK FORMAT
// #########################
// Generally, request callbacks will be passed 2 values:
// status: String
//  the status of the request (similar to http status codes)
//  possible values:
//  'ok' - request was successful (http 200)
//  'auth' - request failed due to invalid auth token (http 400/401)
//  'timeout' - request timed out (http 204/408)
//  'error' - any other error
// data: String, Object, or undefined
//  the data returned by the response, if any
//  if the text was JSON, it will be parsed, otherwise left as a string
//  this may contain information about errors in the case of an 'error' status


// outcomes:
// - success (200)
// - invalid auth (40x)
// - timeout
// - other failure

// callback(status, response)

// Make a request to the sbs2 api
// endpoint: path
// callback: function, will be passed (status, data)
//           status is "ok", "auth" (invalid auth error), "timeout" (timeout), "error" (other error)
//           data is the data, either an object or a string
// data: data to send (optional)
// auth: auth token (optional)
sbs2Request.SERVER = "https://newdev.smilebasicsource.com/api/";
function sbs2Request(endpoint, method, callback, data, auth, cancel) {
	var x = new XMLHttpRequest();
	if (cancel)
		cancel[0] = function() {
			x.abort();
		}
	x.open(method, sbs2Request.SERVER + endpoint);
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
		if (code==200)
			callback('ok', resp);
		else if (code==408 || code==204)
			// record says server uses 408, testing showed only 204
			// basically this is treated as an error condition,
			// except during long polling, where it's a normal occurance
			callback('timeout', resp);
		else if (code==400 || code==401)
			callback('auth', resp);
		else {
			console.log("REQ FAIL", code);
			callback('error', resp, code);
		}
	}
	x.onerror = function() {
		callback('error');
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
	var str = Object.keys(obj).map(function(key){
		return encodeURIComponent(key)+"="+encodeURIComponent(obj[key]);
	}).join("&");
	return str ? "?"+str : "";
}

// requester thing
function Myself() {
}

// Call to trigger a logout event (TODO)
// called automatically whenever a request has status "auth" (400/401)
Myself.prototype.logOut = function() {
	// todo: it's possible for this to get called when not logged in
	// like, when trying to log in with an incorrect password
	this.auth = undefined;
	localStorage.removeItem('auth');
	console.log("auth error, logging out");
}

// make a request, passing auth automatically
// can trigger .logOut() 
Myself.prototype.request = function(url, method, callback, data, cancel) {
	var $=this;
	sbs2Request(url, method, function(s, resp){
		if (s=='auth') {
			$.logOut();
			callback.call($, s, resp);
		} else {
			callback.call($, s, resp);
		}
	}, data, $.auth, cancel)
}

// internal log in function
Myself.prototype.authenticate = function (username, password, callback) {
	var $=this;
	$.request("User/authenticate", "POST", function(s, resp) {
		if (s=='ok')
			$.auth = resp;
		callback.call($, s, resp);
	}, {username:username, password:password});
}

Myself.prototype.testAuth = function(callback) {
	var $=this;
	$.request("User/me","GET",function(s, resp) {
		callback.call($, s, resp);
	});
};

// better log in function
// uses cached auth when possible
Myself.prototype.logIn = function(username, password, callback) {
	var $=this;
	var cached = localStorage.getItem('auth');
	if (cached) {
		$.auth = cached;
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
		$.testAuth(function(){});
	} else if (username) {
		$.authenticate(username, password, got);
	}

	function got(s, resp) {
		if (s=='ok') {
			localStorage.setItem('auth', resp);
			callback.call($, s, resp);
		} else
			callback.call($, s, resp);	
	}
}

Myself.prototype.listen = function(id, query, callback, cancel) {
	var $=this;
	var url = "Comment/listen/"+id+queryString(query);
	$.request(url, "GET", function(s, resp) {
		callback.call($, s, resp);
	}, undefined, cancel);
}

Myself.prototype.postComment = function(comment, callback) {
	var $=this;
	$.request("Comment", "POST", callback);
}

Myself.prototype.getComments = function(query, callback) {
	var $=this;
	$.request("Comment"+queryString(query), "GET", callback);
}

Myself.prototype.getComment = function(id, callback) {
	var $=this;
	$.request("Comment?ids="+id, "GET", callback);
}
