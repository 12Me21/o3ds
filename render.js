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

function renderPinnedPage(page, onremove) {
	var div = document.createElement('a');
	div.className = "rem1-7 bar ellipsis";
	if (page) {
		var icon = "page";
		if (!hasPerm(page.permissions, 0, 'r'))
			icon = "hiddenpage";
		var name = renderContentName(page.name, icon)
	} else {
		var name = renderContentName("UNKNOWN", icon)
	}
	var bcc = document.createElement("span");
	div.href = "#pages/"+page.id;
	var close = renderButton();
	close[1].textContent = "remove";
	
	close[1].onclick = function(e) {
		div.remove();
		onremove && onremove();
		e.preventDefault();
	}
	bcc.appendChild(close[0]);
	close[0].className += " item";
	div.appendChild(bcc);
	div.appendChild(name);
	return div;
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
	//img.title = user.username;
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
	if (nameFirst == undefined)
		avatar.title = user.username;
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
	element.appendChild(renderHalfBlock("Author:", page.createDate));

	element.appendChild(document.createTextNode(" "));
	element.appendChild(renderUserLink(users[page.createUserId], true));
	// page was edited by other user
	if (page.editUserId != page.createUserId) {
		element.appendChild(document.createTextNode(" "));
		element.appendChild(renderHalfBlock("Edited by:", page.editDate));
		element.appendChild(document.createTextNode(" "));
		element.appendChild(renderUserLink(users[page.editUserId], true));
	} else if (page.createDate != page.editDate) { //edited by same user
		element.appendChild(document.createTextNode(" "));
		element.appendChild(renderHalfBlock("Edited", page.editDate));
	}
}

function renderHalfBlock(label, time) {
	var b = document.createElement("span");
	b.className = "item";
	
	var a = document.createElement("div");
	a.className = "half";
	a.textContent = label;
	b.appendChild(a);

	a = renderTimeAgo(time);
	a.className = "half";
	b.appendChild(a);
	return b;
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

function renderLinkButton(text, url) {
	var div = document.createElement('div');
	div.className = "buttonContainer";
	var a = document.createElement('a');
	a.href = url;
	var btn = document.createElement('button');
	btn.setAttribute('tabindex', -1);
	btn.textContent = text;
	div.appendChild(a);
	a.appendChild(btn);
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
	a.setAttribute('data-uid', user.id);
	return a;
}

// chat message block
function renderUserBlock(user, date) {
	var div = document.createElement('div');
	div.className = 'message';
	div.setAttribute('data-uid', user.id);

	var time = document.createElement('time');
	time.setAttribute("datetime", date+"");
	time.textContent = timeString(date);
	time.className = 'messageTime'
	div.appendChild(time);

	div.appendChild(userAvatar(user,""));

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

function renderPageContents(page, element) {
	if (page.values) {
		var lang = page.values.markupLang;
	}
	var out = Parse.parseLang(page.content, lang, element, true);
	return out;
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

function renderActivityBlock(activity) {
	var page = activity.content;
	var div = document.createElement('div');
	div.className = "rem1-7";
	var a = document.createElement('a');
	a.className = "sidebarPageTitle";
	div.appendChild(a);

	if (activity.type == "content") {
		if (page) {
			var name = renderContentName(page.name, pageIcon(page))
			a.href = "#pages/"+page.id;
		} else
			var name = renderContentName("UNKNOWN", "unknown")
	} else if (activity.type == "user") {
		var name = renderUserLink(page, false);
		a.href = "#user/"+page.id;
	} else if (activity.type == "category") {
		var name = renderContentName(page.name, "category");
		a.href = "#categories/"+page.id;
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

function renderButton() {
	var container = document.createElement("div");
	container.className = "buttonContainer";
	var button = document.createElement("button");
	container.appendChild(button);
	return [container, button];
}

// 
function renderPermissionLine(user, perms) {
	var div = document.createElement("tr");
	div.className = "permissionRow";
	var td = document.createElement('th');
	td.className = "rem1-5";
	div.appendChild(td);
	if (user) {
		td.appendChild(renderUserLink(user, false));
	} else {
		td.appendChild(textItem("everyone"));
	}
	for (var i=0;i<4;i++) {
		var check = document.createElement("input");
		check.type = "checkbox";
		check.checked = perms.indexOf("rcud"[i]) >= 0;
		check.setAttribute("data-crud", "rcud"[i]);
		var td = document.createElement('td');
		td.appendChild(check);
		div.appendChild(td);
	}
	if (user) {
		var td = document.createElement('td');
		td.className = "rem1-5"
		var btn = renderButton();
		btn[0].className += " item";
		btn[1].textContent = "remove";
		btn[1].onclick = function() {
			div.remove();
		}
		td.appendChild(btn[0]);
		div.appendChild(td);
	}
	div.setAttribute("data-uid", user ? user.id : 0);
	return div;
}

function renderActivityLine(activity, users) {
	var div = document.createElement('div');
	div.className = "rem1-5 bar ellipsis";
	var editor = activity.editUserId;
	if (editor > 0 && editor != activity.userId) {
		div.appendChild(renderUserLink(users[editor]));
		div.appendChild(textItem("edited"));
	}
	if (activity.userId > 0) {
		div.appendChild(renderUserLink(users[activity.userId], false));
	}
	if (activity.action == "p") { //comment
		if (activity.deleted) {
			div.appendChild(textItem("Deleted Comment"));
		} else {
			div.appendChild(textItem(": ", "pre"));
			var text = decodeComment(activity.comment)[0];
			div.appendChild(textItem(text.replace(/\n/g," "), "pre"));
			div.title = text;
		}
	} else {
		var text = {
			"c": " Created",
			"u": " Edited",
			"d": " Deleted",
		}[activity.action] || " Unknown Action";
		div.appendChild(textItem(text));
	}
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
	var element = document.createElement('p');
	element = parser(markup)(text, false, element);
	element.className += 'markup-root messagePart';
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

// There are 2 types of messages in the scroller
// blocks, and embeds
// blocks contain message parts and have data-uid, and embeds don't
// if a new message is sent with the same uid as the neighboring block, it will be inserted into that block as a message part
// embeds never merge
// the first embed/messagepart will be removed when the number exceeds the limit
// (if set), and blocks with no message parts left will be removed

// Based on sbs chat autoscroller
function AutoScroller(element, limit) {
	this.element = element;
	this.inner = document.createElement('div');
	element.appendChild(this.inner);
	this.inner.className = "scrollInner";
	this.smoothScroll = true;
	this.nodes = {};
	this.blocks = {};
	this.limit = limit;
	this.count = 0;
	var $=this;
	// handle resizing
	trackResize(element, function(old, ne) {
		if (!$.animationId && $.shouldScroll(old))
			$.autoScroll(true);
	});
	trackResize(this.inner, function(old, ne) {
		if (!$.animationId && $.shouldScroll())
			$.autoScroll(true);
	});
}
// do autoscroll
AutoScroller.prototype.autoScroll = function(instant) {
	var parent = this.element;
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
	return this.scrollDistance(oldHeight) < (oldHeight || this.element.clientHeight)*0.25;
}
// check distance to bottom
AutoScroller.prototype.scrollDistance = function(oldHeight) {
	var parent = this.element;
	return parent.scrollHeight-(oldHeight || parent.clientHeight)-parent.scrollTop;
}

// scrolls down until reaching bottom
// stops if interrupted by user scrolling
AutoScroller.prototype.autoScrollAnimation = function() {
	var $=this;
	var parent = this.element;

	parent.scrollTop += Math.max(Math.ceil(this.scrollDistance()/4), 1);
	
	if (this.scrollDistance() > 0) {
		// save scroll position
		this.expectedTop = parent.scrollTop;
		
		this.animationId = window.requestAnimationFrame(function(time) {
			// only call again if scroll pos has not changed
			// (if it has, that means the user probably scrolled manually)
			if ($.expectedTop == $.element.scrollTop) {
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
	if (id == null) {
		this.inner.appendChild(node);
		this.count++;
	} else {
		var lastUidBlock = this.inner.lastChild;
		if (lastUidBlock) {
			var lastUid = lastUidBlock.getAttribute('data-uid');
			if (!lastUid)
				lastUidBlock = null;
			else
				lastUid = +lastUid;
		}
		
		// replace an existing message (we assume uid doesn't change)
		if (this.nodes[id]) {
			this.nodes[id].parentNode.replaceChild(node, this.nodes[id]);
			this.count--;
			// insert a new line to the last block
		} else if (uid && lastUid == uid && lastUidBlock) {
			lastUidBlock.querySelector('.messageContents, .activityContent').appendChild(node);  // BAD! FIX!
			// create a new block
		} else {
			var b = makeBlock();
			b[1].appendChild(node);
			this.inner.appendChild(b[0]);
		}
		this.nodes[id] = node;
		this.count++;
	}
	this.trimOld();
	if (s)
		this.autoScroll();
}
// this won't update the TIME on user blocks ugh whatever
AutoScroller.prototype.remove = function(id) {
	var node = this.nodes[id]
	if (node) {
		
		var parent = node.parentNode;
		parent.removeChild(node);
		// when removing the last comment in a block
		if (parent.children.length == 0) {// todo: make this less of a hack
			parent.parentNode.remove();
		}
		this.count--;
	}
	delete this.nodes[id];
}
// currently just clears no matter what
// in the future you might, if this is properly connected to a LongPoller,
// cache messages when switching rooms, or something
AutoScroller.prototype.switchRoom = function(id) {
	this.inner.innerHTML = "";
	this.count = 0;
	this.nodes = {};
	// probably needs more cleanup
}

AutoScroller.prototype.embed = function(node) {
	var s = this.shouldScroll();
	this.inner.appendChild(node);
	this.count++;
	this.trimOld();
	if (s)
		this.autoScroll();
}

AutoScroller.prototype.trimOld = function() {
	if (this.limit && this.count > this.limit) {
		if (this.inner.firstChild.getAttribute("data-uid")) {
			// normal user-block
			for (id in this.nodes) {
				this.remove(id);
				break;
			}
		} else {
			// standalone element
			this.inner.firstChild.remove();
			this.count--;
		}
	}
}

function ChatRoom() {
	this.element = document.createElement('div');
	this.element.className = "chatPane";

	this.list = document.createElement('div');
	this.list.className = "rem2-3 bar userlist";
	this.element.appendChild(this.list);

	var scrollerBox = document.createElement('div');
	var scroller = document.createElement('div');
	scroller.className="chatScroller grow";
	scrollerBox.appendChild(scroller);
	this.element.appendChild(scroller);
	
	this.scroller = new AutoScroller(scroller);
	this.pageElement = document.createElement('div');
	this.pageElement.className = "markup-root";
	this.scroller.element.insertBefore(this.pageElement, this.scroller.inner);
	this.hide();
}

ChatRoom.prototype.updatePage = function(page, users) {
	// todo: other fields
	var s = this.scroller.shouldScroll();
	this.page = page;
	Parse.parseLang(page.content, page.values && page.values.markupLang, this.pageElement);
	if (s)
		this.scroller.autoScroll(true);
}

ChatRoom.prototype.hide = function() {
	this.element.style.display = "none";
}

ChatRoom.prototype.show = function() {
	this.element.style.display = "";
}

ChatRoom.prototype.remove = function() {
	this.element.remove();
	this.scroller.switchRoom();
}

ChatRoom.prototype.displayMessage = function(c, user, force) {
	var $=this;
	if (c.deleted) {
		this.scroller.remove(c.id);
	} else {
		var should = this.scroller.shouldScroll();
		var node = renderMessagePart(c, function(){
			if (should) {
				$.scroller.autoScroll();
			}
		});
		this.scroller.insert(c.id, node, c.createUserId, function() {
			var b = renderUserBlock(user, parseDate(c.editDate));
			if (c.createUserId == me.uid)
				b[0].className += " ownMessage";
			return b;
		});
		if (!force) {
			var text = decodeComment(c.content);
			document.title = text[0];
			changeFavicon(user.avatarURL);
		}
	}
	if (force)
		this.scroller.autoScroll(true);
}

ChatRoom.prototype.updateUserlist = function(list, users) {
	var $=this;
	$.list.innerHTML = "";
	list && forDict(list, function(status, user) {
		var status = decodeStatus(status);
		if (status) {
			$.list.appendChild(renderUserListAvatar(users[user]));
		}
	})
}
// idea: show recently active (from activityaggregate) pages somewhere
// maybe an option to switch between activity/recently active/notification? etc.
