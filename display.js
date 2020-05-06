function renderUserBlock(user, uid) {
	var outer = document.createElement('div');
	outer.className = 'message';
	outer.setAttribute('data-uid', uid);
	
	var div = document.createElement('div');
	div.className = 'messageInner';
	outer.appendChild(div);
	
	var img = document.createElement('img');
	if (user)
		img.src = user.avatarURL; //todo: handle default avatar
	img.className = 'messageAvatar';
	div.appendChild(img);

	var contentBox = document.createElement('div');
	contentBox.className = 'messageContents';
	div.appendChild(contentBox);
	
	var name = document.createElement('span');
	name.className = 'messageUsername';
	if (user)
		name.textContent = user.username+":";
	else
		name.textContent = "["+uid+"]"+":";
	contentBox.appendChild(name);

	var time = document.createElement('span');
	time.textContent = "4:20 AM";
	time.className = 'messageTime'
	name.appendChild(time);
	
	return [outer, contentBox];
}

function updateUserBlock(node, user) {
	node.querySelector(".messageAvatar").src = user.avatarURL;
	node.querySelector(".messageUsername").firstChild.textContent = user.username+":";
}

function renderMessagePart(comment){
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
	} else {
		element = document.createElement('div');
		element.appendChild(document.createTextNode(t));
	}
	element.className = 'messagePart';
	//document.title=comment.username+":"+t;
	return element;
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
	window.addEventListener('resize', onresize);
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
