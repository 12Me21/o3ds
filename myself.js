// ok so
// logging in/out
// the big important things are
// - content permissions (when logged in, you can view hidden content, and edit/delete permissions apply)
// - long polling (must be logged in)
// so, when logging in, need to re-request permissions

// long poller plans:
// when viewing a page, you temporarily join that room
// you can then add that room to your list of currrent rooms in the sidebar (or just watch it, for notifications only)
//
// need to handle logging in/out though
// on login (or page load + logged in already),
// start long poller,
// on log out, stop long poller
// but keep list of joined rooms uh, somewhere I guess.
// user variable I suppose

function sbs2Request(url, method, callback, data, auth, cancel, ignore400) {
	var x = new XMLHttpRequest();
	if (cancel)
		cancel[0] = function() {x.abort();console.log("aborted")};
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
		} else if (code==408 || code==204 || code==524) {
			// record says server uses 408, testing showed only 204
			// basically this is treated as an error condition,
			// except during long polling, where it's a normal occurance
			callback('timeout', resp);
		} else if (code == 429) { // rate limit
			window.setTimeout(function() {
				callback('rate', resp);
			}, 1000);
		} else if (code==401) {
			console.log(x);
			callback('auth', resp);
		} else if (code==404) {
			console.warn("got 404");
			callback('404', resp);
		} else if (ignore400 && code==400) {
			try {
				resp = JSON.parse(resp);
			} catch(e) {
			}
			callback('error', resp);
		} else {
			alert("Request failed! "+code+" "+url);
			//console.log("sbs2Request: request failed! "+code);
			//console.log(x.responseText);
			console.log("REQUEST FAILED", x);
			try {
				resp = JSON.parse(resp);
			} catch(e) {
			}
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
			callback('fail');
		}
	}
	x.setRequestHeader('Cache-Control', "no-cache, no-store, must-revalidate");
	x.setRequestHeader('Pragma', "no-cache"); // for internet explorer
	if (auth)
		x.setRequestHeader('Authorization', "Bearer "+auth);
	
	if (data) {
		if (data && data.constructor == Object) { //plain object
			x.setRequestHeader('Content-Type',"application/json;charset=UTF-8");
			x.send(JSON.stringify(data));
		} else { //string, formdata, arraybuffer, etc.
			x.send(data);
		}
	} else {
		x.send();
	}
	return x;
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
	this.userCache={};
	this.userRequests={};
	this.selectServer(isDev);
	this.openRequests = 0;
}

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

Myself.prototype.request = function(url, method, callback, data, cancel, ignore400) {
	var $=this;
	$.openRequests++;
	$.loadStart(!!cancel);
	return sbs2Request($.server+"/"+url, method, function(e, resp) {
		$.openRequests--;
		$.loadEnd(!!cancel, e);
		/*if (e=='auth') {
			$.logOut();
		}*/
		$.cb(callback, e, resp);
	}, data, $.auth, cancel, ignore400);
}

Myself.prototype.loadStart = function(lp) {
	if (this.onLoadStart)
		this.cb(this.onLoadStart, lp);
}

Myself.prototype.loadEnd = function(lp, e) {
	if (this.onLoadEnd)
		this.cb(this.onLoadEnd, lp, e);
}

Myself.prototype.getUsers = function(query, page, callback) {
	var $=this;
	query.limit = 20;
	query.skip = page * query.limit;
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
	return $.request(url, 'GET', function(e, resp) {
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
	var needCategorys = !$.categoryTree && query.requests.length<10;
	if (needCategorys) {
		query.requests.push('category~tree');
	}
	
	return $.request("Read/chain"+queryString(query), 'GET', function(e, resp) {
		if (needCategorys) {
			$.categoryTree = buildCategoryTree(resp.tree);
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
	
	return $.request("Read/listen"+queryString(query), 'GET', function(e, resp) {
		if (!e)
			$.handle(e, resp.chains);
		$.cb(callback, e, resp);
	}, undefined, cancel);
};

Myself.prototype.getUser = function(id, callback) {
	var $=this;
	return $.readSimple("User"+queryString({ids:id}), 'user', function(e, resp) {
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
			user.avatarURL = $.server+"/File/raw/"+user.avatar+"?size=120&crop=true";
			user.bigAvatarURL = $.server+"/File/raw/"+user.avatar+"?size=400&crop=true";
			user.rawAvatarURL = $.server+"/File/raw/"+user.avatar;
		} else {
			user.avatarURL = user.bigAvatarURL = user.rawAvatarURL = "./avatar.png";
		}
		/*if (user.id == 483) {
			user.avatarURL = user.bigAvatarURL = user.rawAvatarURL = "./idiot.png";
		}*/
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
		if (this.onLogout)
			this.onLogout(this);
		this.auth = 'undefined'
		if (!soft) {
			localStorage.removeItem(this.lsKey);
		}
	}
}

// handle auth token once recieved
// also calculates your own UID (thank you random â¥)
Myself.prototype.setAuth = function(auth) {
	this.auth = auth;
	var x = JSON.parse(atob(auth.split(".")[1]));
	this.uid = +x.uid;
	if (this.onLogin)
		this.onLogin(this);
}

// run callback function
// this.cb(func, args...) is the same as
// if (func) func.call(this, args...)
Myself.prototype.cb = function(func) {
	if (func)
		func.apply(this, Array.prototype.slice.call(arguments, 1));
	else
		console.warn("Unbound callback", arguments);
}

// request auth token from username+password
Myself.prototype.logIn = function(username, password, callback) {
	var $=this;
	return $.request("User/authenticate", 'POST', function(e, resp) {
		if (!e) {
			$.setAuth(resp);
			localStorage.setItem($.lsKey, resp);
			$.readSimple("User/me", 'user', callback);
		}
		$.cb(callback, e, resp);
	}, {username: username, password: password}, undefined, true);
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
			if (e == 'auth' || e == 'error') {
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
	return $.read([
		{content: {ids: [id]}},
		{comment: {parentIds: [id], limit: 50, reverse: true}},
		"user.0createUserId.0editUserId.1createUserId.1editUserId",
	], {
		user: "id,username,avatar",
		comment: "content,createuserid,deleted,editdate,edituserid,id,parentid"
	}, function(e, resp) {
		if (!e) {
			var page = resp.content[0];
			if (page)
				$.cb(callback, page, resp.userMap, resp.comment, resp.old);
			else
				$.cb(callback, null, {}, [], []);
		}
	});
}

Myself.prototype.getDiscussion = function(id, callback) {
	var $=this;
	id = +id;
	return $.read([
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
	return $.read([
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
	values: {},
}

// get the pages in a category
Myself.prototype.getCategory = function(id, page, callback, pinnedCallback) {
	id=+id;
	var $=this;
	var search = {
		parentIds: [id],
		limit: 10,
		skip: page*10,
		sort: 'editDate',
		reverse: true
	}
	return $.read([
		{'category~main': {ids: [id]}},
		{content: search},
		{category: {parentIds: [id]}},
		"content.0values_pinned~pinned",
		"user.1createUserId.3createUserId"
	], {
		content: "id,name,parentId,createUserId,editDate,permissions",
		/*category: "id,name,description,parentId,values",*/
		user: "id,username,avatar"
	}, function(e, resp) {
		if (!e) {
			if (id == 0)
				var category = rootCategory;
			else
				category = resp.main[0];
			$.cb(callback, category, resp.category, resp.content, resp.userMap, resp.pinned);
		} else {
			$.cb(callback, null, [], [], {}, []);
		}
	});
}

Myself.prototype.getNotifications = function(callback) {
	var $=this;
	return $.read([
		{activityaggregate: {contentLimit: {watches: true}}},
		{commentaggregate: {contentLimit: {watches: true}}},
		"watch",
		"content.0id.1id.2contentId",
		"user.0userIds.1userIds.3createUserId.2userId"
	],{
		content: "id,name,parentId,createUserId,permissions",
		watch: "contentId,lastNotificationId,id",
		user: "id,avatar,super,special,username"
	}, function(e, resp) {
		$.cb(callback, e, resp);
	});
}

Myself.prototype.getPageForEditing = function(id, callback) {
	var $=this;
	if (id) {
		id = +id;
		return $.read([
			{content: {ids: [id]}},
			"user.0createUserId.0editUserId.0permissions",
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
	} else {
		if ($.categoryTree) {
			$.cb(callback, null, {});
		} else {
			return $.readSimple("Category", 'category', function(e, resp) {
				$.categoryTree = buildCategoryTree(resp);
				$.cb(callback, null, {});
			});
		}
	}
}

Myself.prototype.getCategoryForEditing = function(id, callback) {
	var $=this;
	if (id) {
		id = +id;
		return $.read([
			{category: {ids: [id]}},
		], {
		}, function(e, resp) {
			if (!e) {
				var cat = resp.category[0];
				if (cat)
					$.cb(callback, cat);
				else
					$.cb(callback, null);
			}
		});
	} else {
		if ($.categoryTree) {
			$.cb(callback, null, {});
		} else {
			return $.readSimple("Category", 'category', function(e, resp) {
				$.categoryTree = buildCategoryTree(resp);
				$.cb(callback, null, {});
			});
		}
	}
}

Myself.prototype.setVariable = function(name, value, callback) {
	var s = new String(value);
	s.constructor = Object;
	return this.request("Variable/"+name, 'POST', callback, s);
}

Myself.prototype.getVariable = function(name, callback) {
	var $=this;
	return this.request("Variable/"+name, 'GET', function(e, resp){
		if (!e) {
			$.cb(callback, resp);
		} else
			$.cb(callback, null);
	});
}

Myself.prototype.doListenInitial = function(callback) {
	var $=this;
	return $.read([
		{comment:{reverse:true,limit:20}},
		{activity:{reverse:true,limit:20}},
		"content.0parentId.1contentId", //pages
		"user.0createUserId.1userId" //users for comment and activity
	],{content:"id,createUserId,name,permissions"},callback);
}

Myself.prototype.doListen = function(lastId, statuses, lastListeners, clearNotifs, cancel, callback) {
	var $=this;
	var actions = {
		lastId: lastId,
		statuses: statuses,
		chains: [
			"comment.0id",'activity.0id-{"includeAnonymous":true}',"watch.0id", //new stuff //changed
			"content.1parentId.2contentId.3contentId", //pages
			"user.1createUserId.2userId.1editUserId" //users for comment and activity
		]
	}
	if (clearNotifs)
		actions.clearNotifictions = clearNotifs;
	var req = [
		{actions: actions}
	];
	if (Object.keys(lastListeners).length) {
		req.push({listeners: {
			lastListeners: lastListeners,
			chains: ["user.0listeners"]
		}});
	}
	return $.listen(req, {
		content: "id,createUserId,name,permissions"
	}, callback, cancel);
}
// todo:
// when logging in on a page, re-request the page data (along with your own user data)
// make a function for this
// it needs to handle all page types, hmm


Myself.prototype.postPage = function(page, callback) {
	if (page.id) {
		this.request("Content/"+page.id, 'PUT', callback, page);
	} else {
		this.request("Content", 'POST', callback, page);
	}
}

Myself.prototype.postCategory = function(cat, callback) {
	if (cat.id) {
		this.request("Category/"+cat.id, 'PUT', callback, cat);
	} else {
		this.request("Category", 'POST', callback, cat);
	}
}

Myself.prototype.deletePage = function(id, callback) {
	this.request("Content/"+id+"/delete", 'POST', callback);
}

Myself.prototype.postComment = function(id, message, f, callback) {
	if (f)
		message = JSON.stringify(f)+"\n"+message;
	return this.request("Comment", 'POST', callback, {
		parentId: id,
		content: message
	});
};
Myself.prototype.editComment = function(id, message, f, callback) {
	if (f)
		message = JSON.stringify(f)+"\n"+message;
	return this.request("Comment/"+id, 'PUT', callback, {
		content: message,
	});
};
Myself.prototype.deleteComment = function(id, callback) {
	return this.request("Comment/"+id, 'DELETE', callback);
}
Myself.prototype.getComment = function(id, callback) {
	var $=this;
	return $.readSimple("Comment?ids="+id, 'comment', function(e, resp) {
		if (!e && resp[0])
			$.cb(callback,resp[0]);
		else
			$.cb(callback, null);
	});
}

Myself.prototype.setWatch = function(id, state, callback) {
	if (state)
		this.request("Watch/"+id, 'POST', callback);
	else
		this.request("Watch/"+id+"/delete", 'POST', callback);
};

Myself.prototype.getWatch = function(query, callback) {
	return this.request("Watch"+queryString(query), 'GET', callback);
}

Myself.prototype.setVote = function(id, state, callback) {
	return this.request("Vote/"+id+"/"+(state||"delete"), 'POST', callback);
}

Myself.prototype.getVote = function(query, callback) {
	return this.request("Vote"+queryString(query), 'GET', callback);
}

Myself.prototype.register = function(username, password, email, callback) {
	this.request("User/register", 'POST', callback, {
		username: username,
		password: password,
		email: email
	},undefined,true);
}

Myself.prototype.setSensitive = function(data, callback) {
	this.request("User/sensitive", 'POST', callback, data);
}

Myself.prototype.sendEmail = function(email, callback) {
	this.request("User/register/sendemail", 'POST', callback, {
		email: email
	},undefined,true);
}

Myself.prototype.confirmRegister = function(key, callback) {
	var $=this;
	return $.request("User/register/confirm", 'POST', function(e, resp) {
		if (!e) {
			$.setAuth(resp);
			localStorage.setItem($.lsKey, resp);
			$.readSimple("User/me", 'user', function(){});
		}
		$.cb(callback, e, resp);
	}, {confirmationKey: key}, undefined, true);
}

Myself.prototype.getSettings = function(callback) {
	var $=this;
	if (me.auth) {
		return $.read([
			{user: {ids: [$.uid]}},
			{content: {createUserIds: [$.uid], type: '@user.page', limit: 1}},
		], {
			content: "id"
		}, function(e, resp) {
			if (!e && resp.user && resp.user[0]) {
				$.cb(callback, resp.user[0], resp.content[0]);
			} else {
				$.cb(callback, null, null);
			}
		});
	} else {
		$.cb(callback, null);
	}
}

Myself.prototype.fileUrl = function(id) {
	return this.server+"/File/raw/"+id;
}

Myself.prototype.uploadFile = function(file, callback) {
	var form = new FormData();
	form.append('file', file);
	this.request("File", 'POST', callback, form);
}

Myself.prototype.setBasic = function(data, callback) {
	this.request("User/basic", 'PUT', callback, data);
}

Myself.prototype.getActivity = function(page, callback) {
	var $=this;
	var day = 1000*60*60*24
	var start = new Date(Date.now() - day*(page+1)).toISOString();
	// "except no that won't work if site dies lol"
	var end = new Date(Date.now() - day*page).toISOString();
	var reading = [
		{activity: {createStart: start, createEnd: end}},
		{commentaggregate: {createStart: start, createEnd: end}},
		"content.0contentId.1id",
		"user.0userId.1userIds"
	]
	/*if ($.categoryTree)
		reading.push("category.0contentId");*/
	return $.read(reading, {
		content: "name,id,permissions"
	},function(e, resp) {
		if (!e) {
			$.cb(callback, resp.activity, resp.commentaggregate, resp.content, resp.userMap)
		} else {
			$.cb(callback, null, null, null, {});
		}
	});
}

Myself.prototype.getFiles = function(query, page, callback) {
	var $=this;
	query.limit = 20;
	query.skip = page*query.limit;
	query.reverse = true;
	return $.read([
		{file: query},
		"user.0createUserId"
	],{},function(e, resp) {
		if (!e) {
			$.cb(callback, resp.file, resp.userMap);
		} else {
			$.cb(callback, null, {});
		}
	});
}

// load next 10 comments older than `start`
Myself.prototype.loadCommentsBefore = function(id, start, callback) {
	var $=this;
	return $.read([
		{comment: {parentIds: [id], maxId: id-1, reverse: true, limit: 10}},
		"user.0createUserId"
	], {}, function(e, resp) {
		if (!e) {
			$.cb(callback, resp.comment, resp.userMap);
		}
	})
}

// load next 10 comments newer than `start`
Myself.prototype.loadCommentsAfter = function(id, start, callback) {
	var $=this;
	return $.read([
		{comment: {parentIds: [id], minId: id+1, limit: 10}},
		"user.0createUserId"
	], {}, function(e, resp) {
		if (!e) {
			$.cb(callback, resp.comment, resp.userMap);
		}
	})
}

// load comments between min and max, and 10 on either side
Myself.prototype.loadCommentsNear = function(id, min, max, callback) {
	var $=this;
	var query;
	if (max != min) {
		query = [
			{comment: {parentIds: [id], minId: min, maxId: max}},
			{comment: {parentIds: [id], maxId: min-1, reverse: true, limit: 10}},
			{comment: {parentIds: [id], minId: max+1, limit: 10}},
			"user.0createUserId.1createUserId.2createUserId"
		]
	} else  {
		query = [
			{comment: {parentIds: [id], maxId: min-1, reverse: true, limit: 10}},
			{comment: {parentIds: [id], minId: max, limit: 11}},
			"user.0createUserId.1createUserId"
		]
	}
	return $.read(query, {}, function(e, resp) {
		if (!e) {
			$.cb(callback, resp.comment, resp.userMap);
		}
	})
}

Myself.prototype.thumbnailURL = function(id) {
	return this.server+"/File/raw/"+id+"?size=50";
}

Myself.prototype.avatarURL = function(id) {
	return this.server+"/File/raw/"+id+"?size=120";
}

Myself.prototype.imageURL = function(id) {
	return this.server+"/File/raw/"+id;
}

Myself.prototype.putFile = function(file, callback) {
	return this.request("File/"+file.id, 'PUT', callback, file);
}

Myself.prototype.getUserPage = function(id, callback) {
	var $=this;
	id = +id;
	return $.read([
		{user: {userIds: [id]}},
		{"content~userpage": {createUserIds: [id], type: '@user.page', limit: 1}}, //page
		{activity: {userIds: [id], limit: 20, reverse: true}},
		{commentaggregate: {userIds: [id], limit: 100, reverse: true}},
		"content.2contentId.3id"
	], {
	}, function(e, resp) {
		if (!e) {
			var user = resp.userMap[id];
			// ugh need to make
			// content map now
			// to map Content to Activity
			// you know, maybe this could be done automatically.... somehow
			if (user) {
				var page = resp.userpage[0];
				$.cb(callback, user, page, resp.activity, resp.commentaggregate, resp.content, resp.userMap);
			} else
				$.cb(callback, null, {}, [], [], [], {});
		}
	});
	// what we need:
	// user object
	// user page
	// recent activity + assoc contentz
	// recent comment aggregate + assoc contentz
}

function buildCategoryTree(categories) {
	var root = {childs: [], id: 0, name: "[root]", values: {}};
	var orphans = [];
	var map = {
		'0': root
	};
	root.map = map;
	categories = categories.map(function(cat) {
		var n = Object.assign({}, cat); //copy
		n.childs = [];
		map[n.id] = n;
		return n
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

// so if I was a Good Programmer I would
// make Classes for every data type
// and either
// - have functions to convert to/from the native format
// - or store the raw data separately from extra data (better)
// but none of this will ever really work because
// field filtering, etc.
// nothing   is real





