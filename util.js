function hide(element) {
	element.style.display = 'none';
}

function show(element) {
	element.style.display = '';
}

function visible(element, state) {
	element.style.display = state ? '' : 'none';
}

function setChild(element, child) {
	element.innerHTML = "";
	if (child)
		element.appendChild(child);
}

function protocol() {
	if (window.location.protocol == "http:")
		return "http:";
	return "https:";
}

function parseJSON(json) {
	if (!json)
		return undefined;
	try {
		return JSON.parse(json);
	} catch (e) {
		return null;
	}
}

function trackResize(element, callback) {
	var t = trackResize.tracking;
	if (callback) {
		var n = {
			element: element,
			callback: callback,
			height: element.getBoundingClientRect().height,
			width: element.getBoundingClientRect().width
		}
		t.push(n);
		if (trackResize.observer)
			trackResize.observer.observe(element);
	} else {
		if (trackResize.observer)
			trackResize.observer.unobserve(element);
		for (var i=0;i<n.length;i++) {
			if (n[i].element == element) {
				n.splice(i, 1);
				break;
			}
		}
	}
}

trackResize.tracking = [];
if (window.ResizeObserver) {
	trackResize.observer = new window.ResizeObserver(function(events) {
		events.forEach(function(event) {
			for (var i=0;i<trackResize.tracking.length;i++) {
				var item = trackResize.tracking[i];
				if (item.element == event.target) {
					item.callback(item.height, event.contentRect.height);
					item.height = event.contentRect.height;
					break;
				}
			}
		});
	});
} else {
	trackResize.interval = window.setInterval(function() {
		trackResize.tracking.forEach(function(item) {
			var size = item.element.getBoundingClientRect();
			if (size.height != item.height || size.width!=item.width) {
				item.callback(item.height, size.height);
				item.height = size.height;
				item.width = size.width;
			}
		});
	}, 200);
}
// need to fix: when width decreases, the content inside may wrap and increase in height
// this throws off the autoscroller calculations which assume only the parent height changes

var flags = {};
function flag(flag, state) {
	if (!flags[flag] != !state) {
		if (state)
			flags[flag] = true;
		else
			delete flags[flag];
		var cls = "";
		for (flag in flags) {
			cls += " f-"+flag;
		}
		document.documentElement.className = cls;
	}
}

function forDict(dict, func) {
	for (key in dict)
		func(dict[key], key, dict);
}

function hasPerm(perms, id, perm) {
	return perms && perms[id] && perms[id].indexOf(perm) != -1
}

Object.assign = function(a, b) {
	for (key in b) {
		a[key] = b[key]
	}
	return a;
}

//Should be run once, when the page loads or when the element is created.
function attachPaste(element, callback) {
	"use strict";
	element.addEventListener("load", function (event) {
		var pastedImage = event.target;
		if (pastedImage instanceof HTMLImageElement) {
			console.log("Found image element", pastedImage);
			var src = pastedImage.src;
			try {
				element.removeChild(pastedImage);
			} catch (ignore) {}
			callback(src);
		}
	}, true);
}

// FILL
if (!HTMLElement.prototype.remove) {
	HTMLElement.prototype.remove = function() {
		if (this.parentElement) {
			this.parentElement.removeChild(this);
		}
	}
}

function attachResize(element, tab, horiz,cb) {
	var startX,startY,down,startW,startH;
	function getPos(e) {
		if (e.touches)
			return {x:e.touches[0].pageX,y:e.touches[0].pageY};
		else
			return {x:e.clientX,y:e.clientY};
	}
	function down(e) {
		tab.setAttribute('dragging',"");
		var pos = getPos(e);
		startX = pos.x;
		startY = pos.y;
		startW = element.offsetWidth;
		startH = element.offsetHeight;
		down = true;
	}
	function up() {
		down = false;
		tab.removeAttribute('dragging');
	}
	function move(e) {
		if (!down)
			return;
		var pos = getPos(e);
		var vx = pos.x - startX;
		var vy = pos.y - startY;
		if (horiz) {
			element.style.width = startW+vx+"px";
			cb(startW+vx)
		} else {
			element.style.height = startH+vy+"px";
			cb(startH+vy);
		}
	}	
	tab.addEventListener('mousedown', down);
	document.addEventListener('mouseup', up);
	document.addEventListener('mousemove', move);
	
	tab.addEventListener('touchstart', down);
	document.addEventListener('touchend', up);
	document.addEventListener('touchmove', move);
}


