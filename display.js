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
	name.textContent = getUsername(comment.createUserId);
	name.className="sender";
	element.insertBefore(name,element.firstChild);
	document.title=getUsername(comment.createUserId)+":"+t;
	return element;
}
