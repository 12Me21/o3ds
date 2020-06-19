function attachResize(element, tab, horiz,cb) {
	var startX,startY,down,startW,startH;
	tab.onmousedown = function(e) {
		startX = e.clientX;
		startY = e.clientY;
		startW = element.offsetWidth;
		startH = element.offsetHeight;
		down = true;
	}
	document.addEventListener('mouseup', function() {
		down = false;
	});
	document.addEventListener('mousemove', function(e) {
		if (!down)
			return;
		var vx = e.clientX - startX;
		var vy = e.clientY - startY;
		if (horiz) {
			element.style.width = startW+vx+"px";
			cb(startW+vx)
		} else {
			element.style.height = startH+vy+"px";
			cb(startH+vy);
		}
		console.log("moved");
	});
}
