var scriptLoaded = Date.now();

// to load a page:
// - request info for a page (page, comments, associated users)
// -- start long poller for comments
// --- keep getting user objects for new users that post comments*
// - request listeners list
// -- get user objects for users in listeners list*
// -- start long poller for listeners list
// --- keep getting user objects for new users in listeners list*

//* (problem: these must (well, SHOULD) be cached and so avatars won't update dynamically)

// the difference between pages and chat is that comments are rendered differently, etc.

// for chat:
// [ header bar ]
// [ nav bar ]
// [ user list ]
// [ scroller
//  [ page contents ]
//  [ "load older messages" button]
//  [ chat messages ]
// ]
// [ textarea ]

// (maybe have some buttons for jumping to the top/bottom of the scroller, for mobile)

// for pages:
// [ header bar ]
// [ nav bar ]
// [ user list ]
// [ scroller
//  [ page contents ]
//  [ textarea ]
//  [ comments (reverse order) ]
//  [ "load older comments" button]
// ]

// for the editor:
// [ header bar ]
// [ nav bar ]
// [ page info fields (title etc.) ]
// [ textarea ]
// [ preview ]

// for comments
// I don't want to auto-load older messages because this is awkward
// there should also be a way to jump to a certain date,
// perhaps have a "historic" section of chat, where
// old comments are loaded,
// as in
// ["load older comments"]
// [historic comments]
// ["load newer older comments"]
// [modern comments (deleted after some limit is reached)]
// ugh idk
// 

var me = new Myself(true);
me.loadCachedAuth(function(){});
var scroller;
var lp = new DiscussionLongPoller(me, null);

debugMessage = function(text) {
	scroller.embed(renderSystemMessage(String(text)));
}

if (document.readyState == 'loading')
	document.addEventListener('DOMContentLoaded', ready);
else {
	ready();
}

function ready() {
	var loadTime = Date.now() - scriptLoaded;
	if (me.auth)
		onLogin(me);
	else
		onLogout();
	
	me.on('login', function(gotUser) {
		onLogin(me);
	});
	me.on('logout', function() {
		onLogout(me);
	});
	
	$loggedOut.$login.onclick = function() {
		event.preventDefault();
		me.logOut();
		me.logIn($loggedOut.$username.value, $loggedOut.$password.value, function(){});
	}
	$logout.onclick = function() {
		event.preventDefault();
		me.logOut();
	}
	
	$editorTextarea.oninput = function() {
		updateEditorPreview();
	}
	$markupSelect.onchange = function() {
		updateEditorPreview();
	}

	$submitEdit.onclick = submitEdit;
	
	$chatSend.onclick = function() {
		if ($chatTextarea.value) {
			me.postComment(lp.idList[0], $chatTextarea.value, "plaintext", function(){});
			$chatTextarea.value = "";
		}
	}

	$chatTextarea.onkeypress = function(e) {
		if (!e.shiftKey && e.keyCode == 13) {
			e.preventDefault();
			$chatSend.onclick();
		}
	};
	
	scroller = new AutoScroller($messageList);
	
	console.log = debugMessage;
	
	var query = location.hash.substr(1);
	navigateTo(query);
	
}

window.onhashchange = function() {
	var query = location.hash.substr(1);
	navigateTo(query);
}

function navigateTo(path) {
	lp.reset();
	path = path.split("/").filter(function(x){return x;});
	var type = path[0];
	var id = +(path[1]);
	if (type == "pages") {
		if (path[1] == "edit") {
			if (path[2]) {
				path[2] = path[2].split(/[&?]/g);
				id = +(path[2][0]);
			} else {
				id = undefined;
			}
			generateEditorView(id);
		} else
			generatePageView(id);
	} else if (type == "categories") {
		generateCategoryView(id);
	} else if (type == "user") {
		generateUserView(id);
	} else if (type == "discussions") {
		generateChatView(id);
	} else if (typeof type == 'undefined') { //home
		generateHomeView();
	} else {
		$main.className = "pageMode errorMode";
		generateAuthorBox();
		$pageTitle.textContent = "[404] I DON'T KNOW WHAT A \""+type+"\" IS";
		$pageContents.textContent = "";
	}
}

function generateHomeView() {
	$main.className = "homeMode";
	generateAuthorBox();
	$pageTitle.textContent = "Welcome to smilebnasic soruce! 2";
}

var editingPage;
function generateEditorView(id) {
	loadStart();
	if (id)
		me.getPageForEditing(id, go);
	else
		go();
	
	function go(page, users) {
		$main.className = "editorMode";
		generateAuthorBox(page, users);
		if (page) {
			editingPage = page;
			$pageTitle.textContent = "";
			if (page.values)
				var markup = page.values.markupLang;
			$titleInput.value = page.name;
			$markupSelect.value = markup;
			$editorTextarea.value = page.content;
			updateEditorPreview();
		} else {
			$pageTitle.textContent = "";
			$titleInput.value = "";
			$editorTextarea.value = "";
			editingPage = {}; //todo: fill stuff here
		}
		loadEnd();
	}
}

// These are used to signal to the user when content is loading
function loadStart() {
	$titlePane.style.backgroundColor = "#48F";
}
function loadEnd() {
	$titlePane.style.backgroundColor = "";
}

//maybe turn the title <h1> into an input box
//so you can just edit the page title there
function submitEdit() {
	if (editingPage) {
		editingPage.content = $editorTextarea.value;
		if (!editingPage.values)
			editingPage.values = {};
		editingPage.values.markupLang = $markupSelect.value;
		editingPage.name = $titleInput.value;
		//todo: other fields
		me.postPage(editingPage, function(e, resp) {
			if (e) {
				alert("ERROR");
			} else {
				alert("OK EDIT");
			}
		});
	}
}

function updateEditorPreview() {
	renderPageContents({
		values: {
			markupLang: $markupSelect.value
		},
		content: $editorTextarea.value
	}, $editorPreview);
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

function generateAuthorBox(page, users) {
	if (page) {
		show($pageAuthorBox);
		renderEditor(users[page.createUserId], parseDate(page.createDate), $pageAuthorAvatar, $pageAuthorName, $pageAuthorDate, false, $authorLink);
		visible($pageEdited, page.editDate);
		if (page.editDate) {
			renderEditor(users[page.editUserId], parseDate(page.editDate), $pageEditorAvatar, $pageEditorName, $pageEditorDate, page.editUserId == page.createUserId, $editorLink);
		}
	} else {
		hide($pageAuthorBox);
	}
}

function generatePageView(id) {
	loadStart();
	me.getPage(id, function(page, users, comments){
		$main.className = "pageMode";
		generateAuthorBox(page, users);
		if (page) {
			$pageTitle.textContent = page.name;
			renderPageContents(page, $pageContents)
		} else {
			$main.className += "errorMode";
			$pageTitle.textContent = "Page not found";
			$pageContents.innerHTML = "";
		}
		loadEnd();
	});
}

function generateUserView(id) {
	loadStart();
	me.getUserPage(id, function(user, page, comments, userMap) {
		console.info(arguments);
		$main.className = 'pageMode';
		generateAuthorBox(user && page, userMap);
		if (user) {
			$pageTitle.textContent = user.username;
			if (page) {
				renderPageContents(page, $pageContents)
			} else {
				$pageContents.innerHTML = "";
			}
		} else {
			$main.className += " errorMode";
			$pageTitle.textContent = "User Not Found";
		}
		loadEnd();
	});
}

function updateUserlist(listeners, userMap) {
	$chatUserlist.innerHTML = "";
	listeners && listeners.forEach(function(l) {
		$chatUserlist.appendChild(renderUserListAvatar(userMap[l]));
	})
}

function generateChatView(id) {
	loadStart();
	lp.callback = function(comments, listeners, userMap, page) {
		if (page && page.id == id) {
			generateAuthorBox(page, userMap);
			$messageList.innerHTML = ""
			$main.className = "chatMode";
			scroller.switchRoom(id);
			$pageTitle.textContent = page.name;
			renderPageContents(page, $chatPageContents);
			loadEnd();
		} else if (page == false) { //1st request, page doesn't exist
			generateAuthorBox(page, userMap);
			$messageList.innerHTML = ""
			$pageTitle.textContent = "Page not found";
			$chatPageContents.innerHTML = "";
			loadEnd();
			// TODO: page list passed to callback needs to be PER-ID!!
		}
		if (comments) {
			comments.forEach(function(comment) {
				if (comment.parentId == id)
					displayMessage(comment, userMap[comment.createUserId]);
			});
		}
		if (listeners)
			updateUserlist(listeners[id], userMap);
		if (page) {
			scroller.autoScroll(true);
		}
	}
	lp.addRoom(id);
}

function displayMessage(c, user) {
	if (c.deleted) {
		scroller.remove(c.id);
	} else {
		var node = renderMessagePart(c, function(){
			scroller.autoScroll();
		});
		scroller.insert(c.id, node, c.createUserId, function() {
			var b = renderUserBlock(user, c.createUserId, parseDate(c.createDate));
			if (c.createUserId == me.uid)
				b[0].className += " ownMessage";
			return b;
		});
	}
}

function generateCategoryView(id) {
	loadStart();
	me.getCategory(id, 50, 0, 'editDate', false, function(category, childs, contentz, users) {
		hide($pageAuthorBox);
		$main.className = 'categoryMode';
		
		$categoryPages.innerHTML = "";
		$categoryCategories.innerHTML = "";
		$categoryDescription.textContent = "";
		if (category) {
			$pageTitle.textContent = category.name;
			$categoryDescription.textContent = category.description;
			childs.forEach(function(cat) {
				$categoryCategories.appendChild(renderCategory(cat, users));
			});
			contentz.forEach(function(content) {
				$categoryPages.appendChild(renderCategoryPage(content, users));
			});
		} else {
			$main.className += "errorMode";
			$pageTitle.textContent = "Category not found";
		}
		loadEnd();
	});
}

function onLogin(me) {
	me.whenUser(me.uid, function(user) {
		$myAvatar.src = user.avatarURL;
		$myName.textContent = user.username;
	});
	hide($loggedOut);
	show($loggedIn);
}

function onLogout() {
	$myAvatar.src = "";
	$myName.textContent = "";
	hide($loggedIn);
	show($loggedOut);
}
