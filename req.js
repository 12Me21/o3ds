var SERVER = "http://new.smilebasicsource.com/api/";
if (location.protocol == "https:")
	var SERVER = "https://new.smilebasicsource.com/api/";

if (!window.localStorage) {
	window.localStorage = {
		getItem: function (sKey) {
			if (!sKey || !this.hasOwnProperty(sKey)) { return null; }
			return unescape(document.cookie.replace(new RegExp("(?:^|.*;\\s*)" + escape(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=\\s*((?:[^;](?!;))*[^;]?).*"), "$1"));
		},
		key: function (nKeyId) {
			return unescape(document.cookie.replace(/\s*\=(?:.(?!;))*$/, "").split(/\s*\=(?:[^;](?!;))*[^;]?;\s*/)[nKeyId]);
		},
		setItem: function (sKey, sValue) {
			if(!sKey) { return; }
			document.cookie = escape(sKey) + "=" + escape(sValue) + "; expires=Tue, 19 Jan 2038 03:14:07 GMT; path=/";
			this.length = document.cookie.match(/\=/g).length;
		},
		length: 0,
		removeItem: function (sKey) {
			if (!sKey || !this.hasOwnProperty(sKey)) { return; }
			document.cookie = escape(sKey) + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
			this.length--;
		},
		hasOwnProperty: function (sKey) {
			return (new RegExp("(?:^|;\\s*)" + escape(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=")).test(document.cookie);
		}
	};
	window.localStorage.length = (document.cookie.match(/\=/g) || window.localStorage).length;
}

function request(endpoint, method, callback, data, auth) {
	var x = new XMLHttpRequest();
	x.open(method, SERVER+endpoint);
	x.onload = function() {
		var code = x.status;
		var type = x.getResponseHeader("Content-Type");
		if (/^application\/json(?!=\w)/.test(type)) {
			try {
				var resp = JSON.parse(x.responseText);
			} catch(e) {
				resp = null;
			}
		} else {
			resp = x.responseText;
		}
		callback(resp, code);
	}
	if (auth)
		x.setRequestHeader("Authorization", "Bearer "+auth);
	if (data) {
		x.setRequestHeader("Content-Type","application/json;charset=UTF-8");
		x.send(JSON.stringify(data));
	} else {
		x.send();
	}
}

// event handler system
// maybe make this a nice class later
function callAll(list, args, th) {
	if (list)
		for(var i=0;i<list.length;i++){
			list[i].apply(th, args);
		}
}
function eventify(cls) {
	cls.prototype.on = function(name, callback) {
		console.log(this);
		if (this.events[name]) {
			this.events[name].push(callback);
		} else {
			this.events[name] = [callback];
		}
	}
}
function initEvents(obj) {
	obj.events = {};
}

function Myself() {
	initEvents(this);
}
eventify(Myself);

Myself.prototype.logOut = function() {
	callAll(this.events.logOut, [], this);
	this.auth = null;
}

Myself.prototype.setAuth = function(auth) {
	var old = this.auth;
	this.auth = auth;
	if (!old)
		callAll(this.events.auth, [], this);
}

Myself.prototype.logIn = function(username, password, callback) {
	var $ = this
	if (window.localStorage.getItem('auth')) {
		console.log("using cached auth");
		$.auth = window.localStorage.getItem('auth');
		callback.call($);
	} else {
		console.log("requesting auth");
		request("User/authenticate", "POST", function(auth, code){
			if (code == 200) {
				console.log("got auth");
				$.auth = window.localStorage.setItem('auth', auth);
				callback.call($);
				callAll($.events.auth, [], this);
			} else {
				console.log("auth request failed: "+auth);
				$.auth = null;
				callback.call($, auth); //error
			}
		}, {username:username,password:password});
	}
}

// make a request with your auth code,
// if response is 401/400, triggers a logOut
Myself.prototype.request = function(url, method, callback, data) {
	var $=this;
	request(url, method, function(resp, code){
		// 401: invalid auth
		// 400: invalid UID (when database is reset)
		if (code == 401 || code == 400) {
			$.logOut();
			callback.call($,resp, code);
		} else {
			callback.call($,resp, code);
		}
	}, data, this.auth);
}

// test whether auth code is valid
// causes a logOut event if invalid
Myself.prototype.testAuth = function() {
	this.request("User/me","GET",function(resp, code){console.log(resp,code)});
};

Myself.prototype.register1 = function(username, password, email, callback) {
	var $ = this;
	$.request("User/register", "POST", function(resp, code){
		if (code==200) {
			callback.call($);
		} else {
			callback.call($, resp);
		}
	}, {username:username, password:password, email:email});
}

Myself.prototype.sendEmail = function(email, callback) {
	var $ = this;
	this.request("User/register/sendemail", "POST", function(resp, code){
		if (code == 200) {
			callback.call($); //success
		} else {
			callback.call($, resp);
		}
	}, {email: email});
}

Myself.prototype.confirm = function(key, callback) {
	var $=this;
	$.request("User/register/confirm", "POST", function(resp, code) {
		if (code==200) {
			callback.call($);
		} else {
			callback.call($, resp);
		}
	}, {confirmationKey: key});
}

Myself.prototype.register = function(username, password, email, callback) {
	var $=this;
	$.register1(username, password, email, function(e) {
		if (e) {
			callback.call($, e);
		} else {
			$.sendEmail(email, function(e) {
				if (e) {
					callback.call($, e);
				} else {
					callback.call($);
				}
			})
		}
	});
}

Myself.prototype.getContentz = function(ids, callback) {
	var $=this;
	myself.request("Content?ids="+ids.join(","), "GET", function(resp, code) {
		callback.call($, resp, code);
	});
}

Myself.prototype.getUsers = function(ids, callback) {
	var $=this;
	myself.request("User?ids="+ids.join(","), "GET", function(resp, code) {
		callback.call($, resp, code);
	});
}

//
function Content(obj, callback) {
	this.name = obj.name;
	this.content = obj.content;
	this.type = obj.type;
	this.values = obj.values;
	this.keywords = obj.keywords;
	this.parentId = obj.parentId;
	this.permissions = obj.permissions;
	this.editDate = new Date(obj.editDate);
	this.createUserId = obj.createUserId;
	this.editUserId = obj.editUserId;
	this.id = obj.id;
	this.createDate = new Date(obj.editDate);
}

