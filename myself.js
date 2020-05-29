function sbs2Request(url, method, callback, data, auth, cancel) {
	var x = new XMLHttpRequest();
	if (cancel)
		cancel[0] = function() {x.abort();};
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
			callback(null, resp);
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
			console.log(x);
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
		if (typeof data == 'string') { //todo: allow formdata, file, blob, etc.
			x.send(data);
		} else { //plain object
			x.setRequestHeader('Content-Type',"application/json;charset=UTF-8");
			x.send(JSON.stringify(data));
		}
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

function Myself(isDev) {
	EventEmitter.call(this);
	this.userCache={};
	this.userRequests={};
	this.selectServer(isDev);
	this.openRequests = 0;
}
Myself.prototype = Object.create(EventEmitter.prototype);
Object.defineProperty(Myself.prototype, 'constructor', {
	value: Myself,
	enumerable: false,
	writable: true
});

function https() {
	if (window.location.protocol=="http:")
		return "http:";
	return "https:";
}

// Select/switch which server to use (dev or normal)
// this should clear internal cache etc.
// todo: maybe allow switching signed in accounts
Myself.prototype.selectServer = function(isDev) {
	this.logOut(true);
	if (isDev) {
		this.server = https() + "//newdev.smilebasicsource.com/api";
		this.lsKey = "devauth"
	} else {
		this.server = https() + "//new.smilebasicsource.com/api";
		this.lsKey = "auth"
	}
}

Myself.prototype.request = function(url, method, callback, data, cancel) {
	var $=this;
	$.openRequests++;
	$.loadStart();
	sbs2Request($.server+"/"+url, method, function(e, resp) {
		$.openRequests--;
		$.loadEnd(e);
		/*if (e=='auth') {
			$.logOut();
		}*/
		$.cb(callback, e, resp);
	}, data, $.auth, cancel);
}

Myself.prototype.loadStart = function() {
	if (this.onLoadStart)
		this.cb(this.onLoadStart);
}

Myself.prototype.loadEnd = function(e) {
	if (this.onLoadEnd)
		this.cb(this.onLoadEnd, e);
}

Myself.prototype.getUsers = function(query, callback) {
	var $=this;
	$.readSimple("User"+queryString(query), 'user', function(e, resp){
		if (!e){
			$.cb(callback, resp);
		}
	});
}

// Most requests will be done through the chain endpoint with Myself.read
// However, if you want to use another endpoint (or if the request can't be chained (ex: /user/me)
// you can use this function, as long as
// the response is always an array of objects of the specified type
Myself.prototype.readSimple = function(url, type, callback) {
	var $=this;
	$.request(url, 'GET', function(e, resp) {
		if (!e) {
			var obj = {};
			resp instanceof Array || (resp = [resp]);
			obj[type] = resp;
			$.handle(e, obj);
			$.cb(callback, e, resp);
		} else {
			$.cb(callback, e, resp);
		}
	});
}

Myself.prototype.read = function(requests, filters, callback, cancel) {
	var $=this;
	var query = {};
	query.requests = requests.map(function(req) {
		if (typeof req == 'string') {
			return req;
		} else {
			var type = Object.keys(req)[0];
			return type+"-"+JSON.stringify(req[type]);
		}
	});
	for (var filter in filters)
		query[filter] = filters[filter];
	var needCategorys = !$.categoryTree;
	if (needCategorys) {
		query.requests.push('category');
	}
	
	$.request("Read/chain"+queryString(query), 'GET', function(e, resp) {
		if (needCategorys) {
			$.categoryTree = buildCategoryTree(resp.category);
		}
		$.handle(e, resp);
		$.cb(callback, e, resp);
	}, undefined, cancel);
};

Myself.prototype.listen = function(requests, filters, callback, cancel) {
	var $=this;
	var query = {};
	
	requests.forEach(function(req) {
		var type = Object.keys(req)[0];
		query[type]=JSON.stringify(req[type]);
	});
	for (var filter in filters)
		query[filter] = filters[filter];
	
	$.request("Read/listen"+queryString(query), 'GET', function(e, resp) {
		if (!e)
			$.handle(e, resp.chain);
		$.cb(callback, e, resp);
	}, undefined, cancel);
};

Myself.prototype.getUser = function(id, callback) {
	var $=this;
	$.readSimple("User"+queryString(id), 'user', function(e, resp) {
		if (!e) {
			$.cb(callback, resp[0]);
		} else {
			$.cb(callback, null);
		}
	});
}

Myself.prototype.handle = function(e, resp) {
	var $=this;
	if (e)
		return;
	// form user id map and generate user avatar urls
	var userMap = {};
	resp.user && resp.user.forEach(function(user) {
		if (user.avatar && user.avatar != 125) {
			user.avatarURL = $.server+"/File/raw/"+user.avatar+"?size=128&square=true"
			user.bigAvatarURL = $.server+"/File/raw/"+user.avatar+"?size=420&square=true"
		} else {
			user.avatarURL = user.bigAvatarURL = "./avatar.png";
		}
		var uid = user.id;
		if (uid) {
			if (uid == $.uid)
				$.me = user;
			userMap[uid] = user;
			$.userCache[uid] = user;
			
			if ($.userRequests[uid]) {
				$.userRequests[uid].forEach(function(func) {
					$.cb(func, user);
				});
				$.userRequests[uid] = undefined;
			}
		}
	});
	resp.userMap = userMap;
	// parse dates
	// (TODO)
}

////////////////////

Myself.prototype.logOut = function(soft) {
	if (this.auth) {
		this.auth = 'undefined'
		if (!soft) {
			localStorage.removeItem(this.lsKey);
		}
		this.emit('logout');
	}
}

// handle auth token once recieved
// also calculates your own UID (thank you random â¥)
Myself.prototype.setAuth = function(auth) {
	this.auth = auth;
	var x = JSON.parse(atob(auth.split(".")[1]));
	this.uid = +x.uid;
	this.emit('login');
}

// run callback function
// this.cb(func, args...) is the same as
// if (func) func.call(this, args...)
Myself.prototype.cb = function(func) {
	if (func)
		func.apply(this, Array.prototype.slice.call(arguments, 1));
}

// request auth token from username+password
Myself.prototype.logIn = function(username, password, callback) {
	var $=this;
	$.request("User/authenticate", 'POST', function(e, resp) {
		if (!e) {
			$.setAuth(resp);
			localStorage.setItem($.lsKey, resp);
			$.readSimple("User/me", 'user', callback);
		}
		$.cb(callback, e, resp);
	}, {username: username, password: password});
}

// try to log in with cached auth token
// if cached token is found,
//  the function returns true and tests the token by requesting api/User/me
//  and `callback` will be called once this test is finished
// if there's no cached token, it returns false and DOES NOT CALL `callback`
Myself.prototype.loadCachedAuth = function(callback) {
	var $=this;
	var cached = localStorage.getItem($.lsKey);
	if (cached) {
		$.setAuth(cached);
		$.readSimple("User/me", 'user', function(e, resp){
			if (e == 'auth') {
				$.logOut(); //auth was invalid
			}
			$.cb(callback, e, resp);
		}); //this is used to test the auth
		return true;
	}
	return false;
}

Myself.prototype.getPage = function(id, callback) {
	var $=this;
	id = +id;
	$.read([
		{content: {ids: [id]}},
		{comment: {parentIds: [id], limit: 50}},
		"user.0createUserId.0editUserId.1createUserId.1editUserId",
	], {
		user: "id,username,avatar"
	}, function(e, resp) {
		if (!e) {
			var page = resp.content[0];
			if (page)
				$.cb(callback, page, resp.userMap, resp.comment);
			else
				$.cb(callback, null, {}, []);
		}
	});
}

Myself.prototype.getDiscussion = function(id, callback) {
	var $=this;
	id = +id;
	$.read([
		{content: {ids: [id]}},
		{comment: {parentIds: [id], limit: 30, reverse: true}},
		"user.0createUserId.0editUserId.1createUserId.1editUserId",
	], {
		user: "id,username,avatar"
	}, function(e, resp) {
		if (!e) {
			var page = resp.content[0];
			if (page)
				$.cb(callback, page, resp.comment.reverse(), resp.userMap);
			else
				$.cb(callback, null, [], {});
		}
	});
}

// This runs a callback when a user object is available
// it doesn't do any requests itself, so you need to do that separately before or after
Myself.prototype.whenUser = function(id, callback) {
	if (this.userCache[id]) {
		this.cb(callback, this.userCache[id]);
	} else if (this.userRequests[id]) {
		this.userRequests[id].push(callback);
	} else {
		this.userRequests[id] = [callback];
	}
}

Myself.prototype.getCategories = function(callback) {
	var $=this;
	$.read([
		'category'
	], {
		category: "id,name,description,parentId"
	}, function(e, resp) {
		if (!e) {
			var tree = buildCategoryTree(resp.category);
			$.cb(callback, tree);
		}
	});
}

var rootCategory = {
	name: "[root]",
	id: 0,
}

// get the pages in a category
Myself.prototype.getCategory = function(id, count, start, sort, reverse, callback) {
	id=+id;
	var $=this;
	var search = {
		parentIds: [id],
		limit: +count,
	}
	if (start)
		search.skip = +start;
	if (sort)
		search.sort = sort;
	if (reverse)
		search.reverse = reverse;
	if (id)
		var childCategorysFilter = {parentIds: [id]};
	else
		childCategorysFilter = {};
	$.read([
		{content: search},
		{category: {ids: [id]}},
		{category: childCategorysFilter},
		"user.0createUserId"
	], {
		content: "id,name,parentId,createUserId,editDate",
		category: "id,name,description,parentId",
		user: "id,username,avatar"
	}, function(e, resp) {
		if (!e) {
			var category;
			var childs = [];
			resp.category.forEach(function(cat) {
				if (cat.parentId == id)
					childs.push(cat);
				if (cat.id == id)
					category = cat;
			});
			if (id==0) {
				$.cb(callback, rootCategory, childs, resp.content, resp.userMap);
			} else if (category)
				$.cb(callback, category, childs, resp.content, resp.userMap);
			else
				$.cb(callback, null, childs, resp.content, resp.userMap);
		}
	});
}

Myself.prototype.getPageForEditing = function(id, callback) {
	var $=this;
	id = +id;
	$.read([
		{content: {ids: [id]}},
		"user.0createUserId.0editUserId",
	], {
		user: "id,username,avatar"
	}, function(e, resp) {
		if (!e) {
			var page = resp.content[0];
			if (page)
				$.cb(callback, page, resp.userMap);
			else
				$.cb(callback, null, {});
		}
	});
}

Myself.prototype.listenChat = function(ids, firstId, lastId, listeners, callback, cancel) {
	var $=this;
	$.listen([
		{comment: {
			parentIds: ids,
			lastId: lastId,
			chain: ["user.0createUserId"]
		}},
		{listener: {
			parentIdsLast: listeners,
			chain: ["user.0listeners"]
		}}
	], {
		user: "id,username,avatar"
	}, function(e, resp) {
		if (e)
			$.cb(callback, e, resp);
		else
			$.cb(callback, e, resp.comments, resp.listeners, resp.chain.userMap);
	}, cancel);
}

Myself.prototype.postPage = function(page, callback) {
	if (page.id) {
		this.request("Content/"+page.id, 'PUT', callback, page);
	} else {
		this.request("Content", 'POST', callback, page);
	}
}

Myself.prototype.deletePage = function(id, callback) {
	this.request("Content/"+id+"/delete", 'POST', callback);
}

Myself.prototype.postComment = function(id, message, markup, callback) {
	this.request("Comment", 'POST', callback, {
		parentId: id,
		content: JSON.stringify({t: message, m: markup})
	});
};

Myself.prototype.setWatch = function(id, state, callback) {
	if (state)
		this.request("Watch/"+id, 'POST', callback);
	else
		this.request("Watch/"+id+"/delete", 'POST', callback);
};

Myself.prototype.getWatch = function(query, callback) {
	this.request("Watch"+queryString(query), 'GET', callback);
}

Myself.prototype.setVote = function(id, state, callback) {
	this.request("Vote/"+id+"/"+(state||"delete"), 'POST', callback);
}

Myself.prototype.getVote = function(query, callback) {
	this.request("Vote"+queryString(query), 'GET', callback);
}

Myself.prototype.getUserPage = function(id, callback) {
	var $=this;
	id = +id;
	$.read([
		{content: {parentIds: [id], type: '@user.page', limit: 1}},
		{activity: {userIds: [id], limit: 20, reverse: true}},
		"user.0createUserId.0editUserId.1userId",
		"content.1contentId",
	], {
	}, function(e, resp) {
		if (!e) {
			var user = resp.userMap[id];
			// ugh need to make
			// content map now
			// to map Content to Activity
			// you know, maybe this could be done automatically.... somehow
			if (user) {
				var page = resp.content[0];
				if (page.type != "@user.page")
					page = undefined;
				$.cb(callback, user, page, resp.activity, resp.content, resp.userMap);
			} else
				$.cb(callback, null, {}, [], {});
		}
	});
}

function buildCategoryTree(categories) {
	var root = {childs: [], id: 0, name: "[root]"};
	var orphans = [];
	var map = {
		'0': root
	};
	root.map = map;
	categories.forEach(function(cat) {
		cat.childs = [];
		map[cat.id] = cat;
	});
	categories.forEach(function(cat) {
		//cat = Object.assign({}, cat); //copy
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
