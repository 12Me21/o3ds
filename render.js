function renderCategoryPage(page, users) {
	var user = users[page.createUserId];
	var div = document.createElement('a');
	div.href = "#pages/"+page.id;
	div.className = "pre categoryPage bar";
	var title = document.createElement('span');
	title.className = "categoryPageTitle textItem";
	title.textContent = "\uD83D\uDCC4 " + page.name;
	div.appendChild(title);
	if (user) {
		var right = document.createElement('a');
		right.href = "#user/"+user.id;
		right.className = "rightAlign textItem pageCreate";
		var name = document.createElement('span');
		name.textContent = user.username;
		name.className = "textItem pageAuthorName";
		right.appendChild(name);
		var img = document.createElement('img');
		img.className = "item";
		img.src = user.avatarURL;
		right.appendChild(img);
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

function renderPath(tree, node, element, last) {
	element.innerHTML = "";
	while (node) {
		var link = document.createElement('a');
		link.href = "#categories/"+node.id;
		link.textContent = node.name;
		link.className = "textItem";
		var slash = document.createElement('span');
		slash.textContent = "/";
		slash.className = "pathSeparator textItem";
		insertFirst(element, slash);
		insertFirst(element, link);
		node = node.parent;
	}
	if (last) {
		var link = document.createElement('a');
		link.href = "#pages/"+last.id;
		link.textContent = last.name;
		link.className = "textItem";
		element.appendChild(link);
	}
}

function renderUserPath(element, user) {
	element.innerHTML = "";
	var link = document.createElement('a');
	link.href = "#users/"
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
	var img = document.createElement('img');
	img.src = user.avatarURL;
	img.title = user.username;
	img.className = "userListAvatar";
	return img;
}

function renderUserBlock(user, uid, date) {
	var div = document.createElement('div');
	div.className = 'message';
	
	var img = document.createElement('img');
	if (user)
		img.src = user.avatarURL;
	img.className = 'messageAvatar';
	div.appendChild(img);
	
	var name = document.createElement('span');
	name.className = 'messageUsername';
	if (user)
		name.textContent = user.username+":";
	else
		name.textContent = "["+uid+"]"+":";
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
	div.className = "pre categoryPage bar";
	var title = document.createElement('span');
	title.className = "categoryPageTitle item";
	title.textContent = "\uD83D\uDCC1 "+cat.name;
	div.appendChild(title);
	return div;
}

function reasonableDateString(date) {
	var seconds = Math.floor((new Date() - date) / 1000);
	var interval = Math.floor(seconds / 31536000);
	if (interval >= 1) return interval + " years ago";
	interval = Math.floor(seconds / 2592000);
	if (interval >= 1) return interval + " months ago";
	interval = Math.floor(seconds / 86400);
	if (interval >= 1) return interval + " days ago";
	interval = Math.floor(seconds / 3600);
	if (interval >= 1) return interval + " hours ago";
	interval = Math.floor(seconds / 60);
	if (interval >= 1) return interval + " minutes ago";
	if (seconds < 0)
		return " IN THE FUTURE?";
	return Math.floor(seconds) + " seconds ago";
	//return date.getFullYear()+"/"+(date.getMonth()+1)+"/"+date.getDate()+" "+date.getHours()+":"+date.getMinutes();
}

function renderEditor(user, time, avatarE, nameE, dateE, hideUser, link) {
	visible(avatarE, !hideUser);
	visible(nameE, !hideUser);
	if (user) {
		if (!hideUser && user) {
			avatarE.src = user.avatarURL;
			nameE.textContent = user.username;
		}
		
		link.href = "#user/"+user.id;
	}
	dateE.textContent = reasonableDateString(time);
}

function renderPageContents(page, element) {
	if (page.values) {
		var parser = Parse.lang[page.values.markupLang];
	}
	parser = parser || Parse.fallback;
	setChild(element, parser(page.content));
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

function renderActivityItem(activity, page) {
	var date = parseDate(activity.date);
	switch(activity.action) {
	case "c":
		var text = "Created";
		break;case "u":
		text = "Edited";
		break;case "d":
		text = "Deleted";
		break;default:
		text = "Unknown action";
	}
	var div = document.createElement('a');
	div.className = "listItem bar";
	var action = document.createElement('span');
	action.textContent = text;
	var link = document.createElement('b');
	div.href = "#pages/"+activity.contentId;
	link.textContent = page.name;
	var time = document.createElement('span');
	time.textContent = reasonableDateString(date);
	div.appendChild(action);
	div.appendChild(link);
	div.appendChild(time);
	return div;
}

function renderMemberListUser(user) {
	var div = document.createElement('a');
	div.className = "member";
	var avatar = document.createElement('img');
	avatar.src = user.avatarURL;
	div.appendChild(avatar);
	var name = document.createElement('span');
	name.className = "textItem memberName";
	avatar.className = "item";
	name.textContent = user.username;
	div.href = "#user/"+user.id;
	div.appendChild(name);
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
	if (m == '12y') {
		element = parse(t);
		var x = element.getElementsByTagName('img');
		for (var i=0;i<x.length;i++) {
			x[i].onload = sizedOnload;
		}
	} else {
		element = document.createElement('div');
		element.appendChild(document.createTextNode(t));
	}
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
