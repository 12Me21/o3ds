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
		return parse(t);
	} else {
		element = document.createElement("div");
		element.appendChild(document.createTextNode(t));
		return element;
	}
}
