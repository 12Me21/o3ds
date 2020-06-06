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
	span.appendChild(textItem(name));
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
	if (big)
		img.src = user.bigAvatarURL;
	else
		img.src = user.avatarURL;
	img.alt = "";//user.username;
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
	if (user) {
		a.href = "#user/"+user.id;
		var name = textItem(user.username);
		name.className = "username textItem pre"
		var avatar = userAvatar(user, 'item');
		if (nameFirst)
			a.appendChild(name)
		a.appendChild(avatar)
		if (!nameFirst)
			a.appendChild(name)
	} else {
		a.textContent = "MISSINGNO. "
	}
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

function renderAuthorBox(page, users, element) {
	element.innerHTML = "";
	if (!page)
		return;
	/*element.appendChild(textItem("Author: "));*/
	element.appendChild(renderUserLink(users[page.createUserId], true));
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

function renderCategoryPage(page, users, pinned) {
	var user = users[page.createUserId];
	var div = document.createElement('a');
	div.href = "#pages/"+page.id;
	div.className = "pre categoryPage bar rem2-3";

	var title = renderContentName(page.name, pinned?'pin':'page');
	/*var title = document.createElement('span');
	title.className = "categoryPageTitle textItem";
	if (pinned)
		title.textContent = "\uE801 " + page.name;
	else
		title.textContent = "\uF04A " + page.name;*/
	div.appendChild(title);
	
	if (user) {
		var right = renderUserLink(user, true);
		right.className += ' rightAlign';
		div.appendChild(right);
	}
	return div;
}

function insertFirst(node, child) {
	if (node.firstChild)
		node.insertBefore(child, node.firstChild);
	else
		node.appendChild(child);
}

function renderUserPath(element, user) {
	element.innerHTML = "";
	var link = document.createElement('a');
	link.href = "#users"
	link.textContent = "Users";
	link.className = "textItem";
	element.appendChild(link);
	
	var slash = document.createElement('span');
	slash.textContent = "/";
	slash.className = "pathSeparator textItem";
	element.appendChild(slash);
	
	if (user) {
		link = document.createElement('a');
		link.href = "#user/"+user.id
		link.textContent = user.username;
		link.className = "textItem";
		element.appendChild(link);	
	}
}

function renderActivityPath(element) {
	element.innerHTML = "";
	var link = document.createElement('a');
	link.href = "#activity"
	link.textContent = "Activity";
	link.className = "textItem";
	element.appendChild(link);
	
	var slash = document.createElement('span');
	slash.textContent = "/";
	slash.className = "pathSeparator textItem";
	element.appendChild(slash);
}

function timeString(date) {
	var hours = date.getHours();
	var minutes = date.getMinutes();
	var twelve = hours % 12 || 12;
	return twelve+":"+("00"+minutes).substr(-2)+" "+["AM","PM"][hours >= 12 |0];
}

function renderSystemMessage(text) {
	var node = document.createElement('div');
	node.className = 'message systemMessage';
	node.textContent = text;
	return node;
}

function renderUserListAvatar(user) {
	var a = userAvatar(user, "userListAvatar");
	a.title = user.username;
	return a;
}

function renderUserBlock(user, date) {
	var div = document.createElement('div');
	div.className = 'message';

	div.appendChild(userAvatar(user, 'avatar'));
	
	var name = document.createElement('span');
	name.className = 'username';
	name.textContent = user.username+":";
	div.appendChild(name);
	
	var time = document.createElement('span');
	time.textContent = timeString(date);
	time.className = 'messageTime'
	div.appendChild(time);
	
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
	//return date.getFullYear()+"/"+(date.getMonth()+1)+"/"+date.getDate()+" "+date.getHours()+":"+date.getMinutes();
}

function renderPageContents(page, element, cache) {
	if (page.values) {
		var parser = Parse.lang[page.values.markupLang];
	}
	parser = parser || Parse.fallback;
	if (element) {
		setChild(element, parser(page.content, false, cache));
	} else {
		return parser(page.content, false, cache);
	}
}

function setChild(element, child) {
	element.innerHTML = "";
	element.appendChild(child);
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

function renderActivityItem(activity, page, user) {
	if (!user)
		user = [];
	else if (!(user instanceof Array))
		user = [user];

	switch(activity.action) {
	case "c":
		var text = "created";
		break;case "u":
		text = "edited";
		break;case "d":
		text = "deleted";
		break;case "p":
		text = "posted on";
		break;default:
		text = "unknown action";
	}
	var div = document.createElement('a');
	div.className = "listItem bar rem1-7";
	var action = document.createElement('span');
	action.className = "textItem noColor";
	action.textContent = text+" ";
	
	if (activity.action =="p") {
		div.href = "#discussions/"+activity.contentId;
		var name = renderContentName(page.name, 'page')
	} else if (activity.type == 'content') {
		div.href = "#pages/"+activity.contentId;
		var name = renderContentName(page.name, 'page')
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
	var time = renderTimeAgo(activity.date);
	time.className += " rightAlign";
	div.appendChild(time);
	return div;
}

function renderMemberListUser(user) {
	var div = renderUserLink(user)
	div.className = "member userLink rem2-3";
	return div;
}

function renderMessagePart(comment, sizedOnload){
	var c = comment.content;
	var t, m;
	try {
		c = JSON.parse(c);
		if (c.t)
			t = c.t;
		else
			t = c;
		m = c.m;
	} catch (e) {
		t = c;
	}
	/*if (m == '12y') {
		//todo: update for parser aaaa
		element = parse(t);
		var x = element.getElementsByTagName('img');
		for (var i=0;i<x.length;i++) {
			x[i].onload = sizedOnload;
		}
	} else {*/
		element = document.createElement('div');
		element.appendChild(document.createTextNode(t));
	//}
	element.className += ' messagePart';
	//document.title=comment.username+":"+t;
	return element;
}

function hide(element) {
	element.style.display = 'none';
}

function show(element) {
	element.style.display = '';
}

function visible(element, state) {
	element.style.display = state ? '' : 'none';
}

// Based on sbs chat autoscroller
function AutoScroller(element) {
	this.element = element;
	this.smoothScroll = true;
	this.nodes = {};
	this.blocks = {};
	var $=this;
	function onresize() {
		//todo: make this only happen when the element was previously scrolled to bottom
		// may need to detect onscroll to keep track
		// I'd like to avoid onscroll for o3ds though (especially since window can't even be resized so it doesn't matter) (also does o3DS EVEN HAVE onscroll lol)
		$.autoScroll(true);
	};
	//window.addEventListener('resize', onresize); //todo: only do this whe nin chat mode!!
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
AutoScroller.prototype.shouldScroll = function() {
	return this.scrollDistance() < this.element.parentNode.clientHeight*0.25;
}
// check distance to bottom
AutoScroller.prototype.scrollDistance = function() {
	var parent = this.element.parentNode;
	return parent.scrollHeight-parent.clientHeight-parent.scrollTop;
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
	// replace an existing message (we assume uid doesn't change)
	if (this.nodes[id]) {
		this.nodes[id].parentNode.replaceChild(node, this.nodes[id]);
	// insert a new line to the last block
	} else if (uid && this.lastUid == uid) {
		this.lastUidBlock.appendChild(node);
	// create a new block
	} else {
		var b = makeBlock();
		b[1].appendChild(node);
		this.element.appendChild(b[0]);
		
		this.lastUidBlock = b[1];
		this.lastUid = uid;
	}
	this.nodes[id] = node;
	if (s)
		this.autoScroll();
}
AutoScroller.prototype.remove = function(id) {
	var node = this.nodes[id]
	// todo: remove block when all messages are gone from it
	// don't forget to update lastUidBlock etc. too
	if (node) {
		node.parentNode.removeChild(node);
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
