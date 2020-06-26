//todo: make href-setting function
// which processes links automatically
// to add trailing # to fragment links
// OR some other way to solve the issue of
// fragment links not working when clicked again

function renderKeyInfo(key, data, element) {
	element = element || document.createElement('span');
	element.innerHTML = "";
	
	var icon = document.createElement('img');
	icon.src = protocol()+"//sbapi.me/get/"+data.path+"/META/icon";
	icon.className = "metaIcon";

	element.appendChild(icon);
	
	element.appendChild(textItem(data.filename, "pre metaTitle"));
	
	element.appendChild(textItem(data.author.name, "pre metaAuthor")); //todo: link with sbs account somehow?
	return element;
}

function renderSidebarItem(page, user, comment) {
	if (!page) {
		page = {};
	}
	var d = document.createElement('a');
	d.href = "#pages/"+page.id+"#comment-"+comment.id;
	d.className = "pre";
	d.textContent = page.name+"\n"+user.username+": "+comment.content;
	return d;
}

function renderContentName(name, icon) {
	var span = document.createElement('span');
	span.className = "textItem pageName";
	if (icon) {
		var img = document.createElement('span');
		img.setAttribute('role', 'img');
		img.setAttribute('aria-label', icon);
		img.className = "item iconBg iconBg-"+icon;
		span.appendChild(img);
	}
	span.appendChild(textItem(name, 'pre'));
	return span;
}

function renderPath(element, list) {
	element.innerHTML = "";
	if (!list)
		return;
	list.forEach(function(item, i, list) {
		if (item) {
			var link = document.createElement('a');
			link.href = item[0];
			link.textContent = item[1];
			link.className = "textItem pre";
			element.appendChild(link);
		}
		
		if (i < list.length-1) {
			var slash = document.createElement('span');
			slash.textContent = "/";
			slash.className = "pathSeparator textItem";
			element.appendChild(slash);
		}
	});
}

function userAvatar(user, cls, big) {
	if (cls.innerHTML != undefined)
		var img = cls
	else {
		img = document.createElement('img');
		img.className = cls+" avatar";
	}
	img.title = user.username;
	if (big)
		img.src = user.bigAvatarURL;
	else
		img.src = user.avatarURL;
	img.alt = "";
	return img;
}

function textItem(text, cls) {
	var s = document.createElement('span');
	s.textContent = text;
	s.className = 'textItem';
	if (cls)
		s.className += " "+cls;
	return s;
}

// todo: this should probably be like
// <a><figure><img><figcaption>
function renderUserLink(user, nameFirst) {
	var a = document.createElement('a');
	a.className = 'textItem userLink ib';
	if (!user) {
		user = {
			username: "MISSINGNO.",
			avatar: "unknown-user.png",
		}
	}
	a.href = "#user/"+user.id;
	/*if (nameFirst)
		var name = user.username + " ";
	else
	var name = " " + user.username;*/
	var name = user.username;
	var name = textItem(name);
	name.className = "username textItem pre"
	var avatar = userAvatar(user, 'item');
	if (nameFirst == true)
		a.appendChild(name)
	a.appendChild(avatar)
	if (nameFirst == false)
		a.appendChild(name)
	
	return a;
}

function renderTimeAgo(date) {
	var time = document.createElement('time');
	var d = parseDate(date)
	time.setAttribute('datetime',date);
	time.setAttribute('title',readableDate(d));
	time.textContent = timeAgo(d);
	time.className = "textItem time";
	return time;
}

function renderTimeStamp(date) {
	var time = document.createElement('time');
	var d = parseDate(date)
	time.setAttribute('datetime',date);
	time.setAttribute('title',timeString(d));
	time.textContent = timeAgo(d);
	time.className = "textItem time";
	return time;
}

function renderAuthorBox(page, users, element) {
	element.innerHTML = "";
	if (!page)
		return;
	element.appendChild(textItem("Author:"));
	element.appendChild(document.createTextNode(" "));
	element.appendChild(renderUserLink(users[page.createUserId], true));
	element.appendChild(document.createTextNode(" "));
	element.appendChild(renderTimeAgo(page.createDate));
	// page was edited by other user
	if (page.editUserId != page.createUserId) {
		element.appendChild(textItem(", edited by: "));
		var editedText = true;
		element.appendChild(renderUserLink(users[page.editUserId], true));
	}
	// page was edited
	if (page.createDate != page.editDate) {
		if (!editedText)
			element.appendChild(textItem(", edited "));
		element.appendChild(renderTimeAgo(page.editDate));
	}
}

// Page in the list displayed on a category view
function renderCategoryPage(page, users, pinned) {
	var div = document.createElement('a');
	div.href = "#pages/"+page.id;
	div.className = "pre categoryPage bar rem2-3";

	var icon = "page";
	if (pinned)
		icon = "pin";
	if (!hasPerm(page.permissions, 0, 'r'))
		icon = "hiddenpage";
	div.appendChild(renderContentName(page.name, icon));

	var user = users[page.createUserId];
	if (user) {
		var right = renderUserLink(user, true);
		right.className += ' rightAlign';
		div.appendChild(right);
	}
	return div;
}

// HH:MM AM/PM
function timeString(date) {
	if (new Date()-date > 1000*60*60*12) {
		var options = {year:'numeric',month:'long',day:'numeric',hour:'2-digit', minute:'2-digit'}
	} else {
		options = {hour:'2-digit', minute:'2-digit'}
	}
	return date.toLocaleString([], options);
}

function renderSystemMessage(text) {
	var node = document.createElement('div');
	node.className = 'message systemMessage';
	node.textContent = text;
	return node;
}

function renderUserListAvatar(user) {
	var a = document.createElement('a');
	a.appendChild(userAvatar(user,""));
	a.title = user.username;
	a.className = "item";
	a.href = "#user/"+user.id;
	return a;
}

// chat message block
function renderUserBlock(user, date) {
	var div = document.createElement('div');
	div.className = 'message';
	div.setAttribute('data-uid', user.id);

	var time = document.createElement('span');
	time.textContent = timeString(date);
	time.className = 'messageTime'
	div.appendChild(time);

	div.appendChild(userAvatar(user, 'avatar'));

	var name = document.createElement('span');
	name.className = 'username';
	name.textContent = user.username+":";
	div.appendChild(name);
	
	var contentBox = document.createElement('div');
	contentBox.className = 'messageContents';
	div.appendChild(contentBox);
	return [div, contentBox];
}

function renderCategory(cat, users) {
	var div = document.createElement('a');
	div.href = "#categories/"+cat.id;
	div.className = "pre categoryPage rem2-3 bar";

	var title = renderContentName(cat.name, "category");
	
	div.appendChild(title);
	return div;
}

function readableDate(date) {
	return date.toLocaleString();
}

function timeAgo(date) {
	var seconds = Math.floor((new Date() - date) / 1000);
	var interval = Math.floor(seconds / 31536000);
	if (interval >= 1) return interval + " years ago";
	interval = Math.round(seconds / 2592000);
	if (interval >= 1) return interval + " months ago";
	interval = Math.round(seconds / 86400);
	if (interval >= 1) return interval + " days ago";
	interval = Math.round(seconds / 3600);
	if (interval >= 1) return interval + " hours ago";
	interval = Math.round(seconds / 60);
	if (interval >= 1) return interval + " minutes ago";
	if (seconds < 0)
		return " IN THE FUTURE?";
	return Math.round(seconds) + " seconds ago";
}

function renderPageContents(page, element, cache) {
	if (page.values) {
		var lang = page.values.markupLang;
	}
	var out = Parse.parseLang(page.content, lang);
	if (element)
		setChild(element, out);
	
	return out
}

// as far as I know, the o3DS doesn't support parsing ISO 8601 timestamps
function parseDate(str) {
	var data = str.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:.\d+)?)/);
	if (data) {
		var sec = Math.floor(+data[6]);
		var ms = +data[6] - sec;
		return new Date(Date.UTC(+data[1], +data[2]-1, +data[3], +data[4], +data[5], sec, ms));
	}
	return new Date(0);
}

function renderActivityItem(activity, page, user, noTime,comment) {
	if (!user)
		user = [];
	else if (!(user instanceof Array))
		user = [user];

	var text = {
		c: "created",
		u: "edited",
		d: "deleted",
		p: "posted on",
		pd: "deleted post on",
	}[activity.action] || "unknown action";
	var div = document.createElement('a');
	div.className = "listItem bar rem1-7";
	var action = document.createElement('span');
	action.className = "textItem noColor";
	action.textContent = text+" ";

	if (activity.type == 'content') {
		if (activity.action == "p")
			div.href = "#pages/"+activity.contentId+"#comment-"+activity.id; //todo: comment link
		else if (activity.contentId)
			div.href = "#pages/"+activity.contentId;

		if (page) {
			var icon = "page";
			if (!hasPerm(page.permissions, 0, 'r'))
				icon = "hiddenpage";
			var name = renderContentName(page.name, icon)
		} else {
			var name = renderContentName("UNKNOWN", icon)
		}
	} else if (activity.type == 'category') {
		div.href = "#categories/"+activity.contentId;
		var name = renderContentName(page.name, 'category')
	}
	
	user.forEach(function(user){
		var usr = renderUserLink(user);
		div.appendChild(usr);
		div.appendChild(document.createTextNode(" "));
	});
	div.appendChild(action);
	div.appendChild(name);
	if (!noTime) {
		var time = renderTimeAgo(activity.date);
		time.className += " rightAlign";
		div.appendChild(time);
	}
	if (comment) {
		var x = document.createElement('div');
		x.className = "activityCommentText";
		x.textContent = decodeComment(comment)[0].replace(/\n/g," ");
		div.appendChild(x);
	}
	return div;
}

function renderActivityBlock(page) {
	var div = document.createElement('div');
	div.className = "rem1-7";
	var a = document.createElement('a');
	a.className = "sidebarPageTitle";
	div.appendChild(a);
	
	if (page) {
		var name = renderContentName(page.name, pageIcon(page))
		a.href = "#pages/"+page.id;
	} else {
		var name = renderContentName("UNKNOWN", "unknown")
	}
	a.appendChild(name);
	var box = document.createElement('div');
	box.className = "activityContent";
	div.appendChild(box);
	if (page) {
		div.setAttribute('data-uid', page.id);
	}
	return [div, box];
}

function renderActivityLine(user, text, comment, edit) {
	var div = document.createElement('div');
	if (edit && edit != user) {
		div.appendChild(renderUserLink(edit));
		div.appendChild(textItem("edited"));
	}
	div.appendChild(renderUserLink(user, false));
	if (comment && user) {
		text = decodeComment(text)[0];
		div.title = text;
	} else if (!user) { //hack
		text = "Deleted comment"
		comment = false;
	} else {
		text = {
			"c": "Created",
			"u": "Edited",
			"d": "Deleted",
		}[text] || "Unknown Action"
	}
	div.appendChild(textItem(comment ? ": " : " ", "pre"));
	div.appendChild(textItem(text.replace(/\n/g," "), "pre"));
	div.className = "rem1-5 bar ellipsis";
	return div;
}

function pageIcon(page) {
	if (!page)
		return "unknown"
	if (!hasPerm(page.permissions, 0, 'r'))
		return "hiddenpage";
	return "page";
}

function renderNotifItem(notif, page, users) {
	var div = document.createElement('a');
	div.className = "listItem bar rem1-7";
	notif.userIds.forEach(function(id) {
		
		div.appendChild(renderUserLink(users[id]));
	});
	div.appendChild(textItem(" ("+notif.count+") "));
	div.appendChild(renderContentName(page && page.name, pageIcon(page)));
	if (page)
		div.href = "#pages/"+page.id;
	var time = renderTimeStamp(notif.lastDate)
	time.className += " rightAlign"
	div.appendChild(time);
	return div;
}

/*function renderActivityItem(action, user, comment) {
	
}*/

function renderMemberListUser(user) {
	var div = renderUserLink(user, false)
	div.className = "member userLink rem2-3";
	return div;
}

function renderMessageGap() {
	var div = document.createElement('div');
	div.className = "messageGap";
	return div;
}

function renderMessagePart(comment, sizedOnload){
	var x = decodeComment(comment.content);
	var text=x[0], markup=x[1];
	element = parser(markup)(text);
	element.className += ' messagePart';
	element.setAttribute('data-id', comment.id);
	element.setAttribute('tabindex', "0");
	var imgs = element.querySelectorAll('img');
	for(var i=0;i<imgs.length;i++) {
		imgs[i].onload = sizedOnload;
	}
	return element;
}

function parser(markup) {
	return Parse.lang[markup] || Parse.fallback;
}

// Based on sbs chat autoscroller
function AutoScroller(element) {
	this.element = element;
	this.smoothScroll = true;
	this.nodes = {};
	this.blocks = {};
	var $=this;
	// handle resizing
	trackResize(element.parentNode, function(old, ne) {
		if ($.shouldScroll(old))
			$.autoScroll(true);
	});
}
// do autoscroll
AutoScroller.prototype.autoScroll = function(instant) {
	var parent = this.element.parentNode;
	if (!window.requestAnimationFrame || !this.smoothScroll || instant) {
		parent.scrollTop = parent.scrollHeight - parent.clientHeight;
	} else {
		// only start a new animation if previous isn't already running
		if (!this.animationId) {
			this.autoScrollAnimation();
		}
	}
}
// check if element is scrolled to near the bottom (within 0.25*height)
// this threshold can probably be decreased...
AutoScroller.prototype.shouldScroll = function(oldHeight) {
	return this.scrollDistance(oldHeight) < (oldHeight || this.element.parentNode.clientHeight)*0.25;
}
// check distance to bottom
AutoScroller.prototype.scrollDistance = function(oldHeight) {
	var parent = this.element.parentNode;
	return parent.scrollHeight-(oldHeight || parent.clientHeight)-parent.scrollTop;
}

// scrolls down until reaching bottom
// stops if interrupted by user scrolling
AutoScroller.prototype.autoScrollAnimation = function() {
	var $=this;
	var parent = this.element.parentNode;

	parent.scrollTop += Math.max(Math.ceil(this.scrollDistance()/4), 1);
	
	if (this.scrollDistance() > 0) {
		// save scroll position
		this.expectedTop = parent.scrollTop;
		this.animationId = window.requestAnimationFrame(function(time) {
			// only call again if scroll pos has not changed
			// (if it has, that means the user probably scrolled manually)
			if ($.expectedTop == $.element.parentNode.scrollTop) {
				$.autoScrollAnimation();
			} else {
				$.animationId = null;
			}
		});
	} else {
		this.animationId = null;
	}
}
AutoScroller.prototype.insert = function(id, node, uid, makeBlock) {
	var s = this.shouldScroll();
	var lastUidBlock = this.element.lastChild;
	if (lastUidBlock) {
		var lastUid = lastUidBlock.getAttribute('data-uid');
		if (!lastUid)
			lastUidBlock = null;
		else
			lastUid = +lastUid;
	}
	
	if (id == null) {
		this.element.appendChild(node);
	} else {
		// replace an existing message (we assume uid doesn't change)
		if (this.nodes[id]) {
			this.nodes[id].parentNode.replaceChild(node, this.nodes[id]);
			// insert a new line to the last block
		} else if (uid && lastUid == uid && lastUidBlock) {
			lastUidBlock.querySelector('.messageContents, .activityContent').appendChild(node);
			// create a new block
		} else {
			var b = makeBlock();
			b[1].appendChild(node);
			this.element.appendChild(b[0]);
		}
		this.nodes[id] = node;
	}
	if (s)
		this.autoScroll();
}
AutoScroller.prototype.remove = function(id) {
	var node = this.nodes[id]
	if (node) {
		
		var parent = node.parentNode;
		parent.removeChild(node);
		// when removing the last comment in a block
		if (parent.children.length == 0) {// todo: make this less of a hack
			parent.parentNode.remove();
		}
	}
	this.nodes[id] = undefined;
}
// currently just clears no matter what
// in the future you might, if this is properly connected to a LongPoller,
// cache messages when switching rooms, or something
AutoScroller.prototype.switchRoom = function(id) {
	this.element.innerHTML = "";
	this.lastUid = undefined;
	this.lastUidBlock = undefined;
	this.nodes = {};
	// probably needs more cleanup
}

AutoScroller.prototype.embed = function(node) {
	var s = this.shouldScroll();
	this.element.appendChild(node);
	this.lastUid = null;
	this.lastUidBlock = null;
	if (s)
		this.autoScroll();
}
