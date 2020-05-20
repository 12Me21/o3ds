function renderCategoryPage(page, users) {
	var user = users[page.createUserId];
	var div = document.createElement('a');
	div.href = "#page/"+page.id;
	div.className = "pre categoryPage";
	var title = document.createElement('span');
	title.className = "categoryPageTitle item";
	title.textContent = page.name;
	div.appendChild(title);
	var right = document.createElement('span');
	right.className = "rightAlign";
	var img = document.createElement('img');
	img.className = "item";
	img.src = user.avatarURL;
	right.appendChild(img);
	div.appendChild(right);
	return div;
}

// todo: generate username + avatar & link to user page
function renderUserBlock(user) {
	
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
	return Math.floor(seconds) + " seconds ago";
	//return date.getFullYear()+"/"+(date.getMonth()+1)+"/"+date.getDate()+" "+date.getHours()+":"+date.getMinutes();
}

function renderEditor(user, time, avatarE, nameE, dateE, hideUser) {
	visible(avatarE, !hideUser);
	visible(nameE, !hideUser);
	if (!hideUser) {
		avatarE.src = user.avatarURL;
		nameE.textContent = user.username;
	}
	dateE.textContent = reasonableDateString(time);
}

function renderPageContents(page, element) {
	if (page.values)
		var markup = page.values.markupLang;
	if (markup == "12y") {
		element.innerHTML = "";
		element.appendChild(parse(page.content));
	} else {
		element.textContent = page.content;
	}
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

