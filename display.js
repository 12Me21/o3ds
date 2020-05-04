function getUsername(id) {
	return {
		"6": "snail",
		"9": "yttria",
		"10": "12",
		"12": "answer",
		"26": "nicole"
	}[id] || "["+id+"]";
}

function renderComment(comment){
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
		element = document.createElement("div");
		element.appendChild(document.createTextNode(t));
	}
	var name = document.createElement("div");
	name.textContent = comment.username
	name.className="sender";
	element.insertBefore(name,element.firstChild);
	document.title=comment.username+":"+t;
	return element;
}

// Based on sbs chat autoscroller
function AutoScroller(element) {
	this.element = element;
	this.smoothScroll = true;
	this.nodes = {};
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
// todo: handle merging somehow
// so, merging isn't so bad, really all we have to do is
// messages are sort of grouped into blocks,
// and so to this function we should pass, um
// node, id, and block id (which is just user id)
// the only other thing is...
// this function needs to know how to create a block, as well as how to insert/remove/replace items in one.
// perhaps pass functions to this one which handle that
AutoScroller.prototype.insert = function(id, node) {
	var s = this.shouldScroll();
	var next = null;
	// this search can be optimized
	for (var i in this.nodes) {
		if (i == id) {
			this.element.replaceChild(node, this.nodes[i]);
			this.nodes[i] = node;
			break;
		}
		if (i > id) {
			next = this.nodes[i];
			break;
		}
	}
	if (i != id) {
		this.element.insertBefore(node, next);
		this.nodes[id] = node;
	}
	if (s)
		this.autoScroll();
}
AutoScroller.prototype.remove = function(id) {
	if (this.nodes[id]) {
		this.element.removeChild(this.nodes[id]);
	}
}
// currently just clears no matter what
// in the future you might, if this is properly connected to a LongPoller,
// cache messages when switching rooms, or something
AutoScroller.prototype.switchRoom = function(id) {
	this.element.innerHTML = "";
}
