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

window.onload = function() {
	if (me.auth) {
		onLogin(me);
	} else {
		onLogout();
	}
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
	/*$fileinput.onchange = function() {
		var file = this.files[0];
		if (file) {
			me.request("File", "POST", console.log, this.files[0]);
		}
		}*/
	
	$editorTextarea.oninput = function() {
		updateEditorPreview();
	}

	$markupSelect.onchange = function() {
		updateEditorPreview();
	}

	$submitEdit.onclick = submitEdit;

	var query = location.hash.substr(1);
	if (query) {
		navigateTo(query);
	}
}

window.onhashchange = function() {
	var query = location.hash.substr(1);
	if (query) {
		navigateTo(query);
	}
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
		visible($pageAuthorBox, id);
		if (id) {
			editingPage = page;
			$pageTitle.textContent = "";
			renderEditor(users[page.createUserId], page.createDate, $pageAuthorAvatar, $pageAuthorName, $pageAuthorDate);
			
			visible($pageEdited, page.editDate);
			if (page.editDate) {
				renderEditor(users[page.editUserId], page.editDate, $pageEditorAvatar, $pageEditorName, $pageEditorDate, page.editUserId == page.createUserId);
			}
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

function navigateTo(path) {
	path = path.split("/");
	var type = path[0];
	var id = +(path[1]);
	var edit = path[2] == "edit";
	if (type == "page") {
		if (edit)
			generateEditorView(id);
		else
			generatePageView(id);
	} else if (type == "category") {
		generateCategoryView(id);
	} else if (type == "user") {
		
	} else if (type == "chat") {
		
	}
}

function generatePageView(id) {
	loadStart();
	me.getPage(id, function(page, users, comments){
		$main.className = "pageMode";
		if (page) {
			show($pageAuthorBox);
			$pageTitle.textContent = page.name;
			renderEditor(users[page.createUserId], page.createDate, $pageAuthorAvatar, $pageAuthorName, $pageAuthorDate);
			
			visible($pageEdited, page.editDate);
			if (page.editDate) {
				renderEditor(users[page.editUserId], page.editDate, $pageEditorAvatar, $pageEditorName, $pageEditorDate, page.editUserId == page.createUserId);
			}
			renderPageContents(page, $pageContents)
			console.log(page, users, comments);
		} else {
			$pageTitle.textContent = "Page not found";
			hide($pageAuthorBox);
			$pageContents.innerHTML = "";
		}
		loadEnd();
	});
}

function generateCategoryView(id) {
	loadStart();
	me.getCategoryContent(id, 50, 0, 'editDate', false, function(category, contentz, users) {
		hide($pageAuthorBox);
		$categoryPages.innerHTML = "";
		$main.className = 'categoryMode';
		if (category) {
			$pageTitle.textContent = category.name;
			$categoryDescription.textContent = category.description;
			$categoryPages.innerHTML = "";
			contentz.forEach(function(content) {
				$categoryPages.appendChild(renderCategoryPage(content, users));
			});
		} else {
			$pageTitle.textContent = "Category not found";
			$categoryDescription.textContent = "";
		}
		loadEnd();
	});
}

function onLogin(me) {
	console.log("ONLOGIN");
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

