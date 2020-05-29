var scriptLoaded = Date.now();

var me = new Myself(true);
me.loadCachedAuth(function(){});
var scroller;
var lp = new DiscussionLongPoller(me, null);
var currentPage;

debugMessage = function(text) {
	scroller.embed(renderSystemMessage(String(text)));
}

if (document.readyState == 'loading')
	document.addEventListener('DOMContentLoaded', ready);
else {
	ready();
}
var loadTime;
function ready() {
	if (me.openRequests) {
		loadStart();
	}
	me.onLoadStart = loadStart;
	me.onLoadEnd = loadEnd;
	console.info("ready");
	loadTime = Date.now() - scriptLoaded;
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
	$deletePage.onclick = deletePage;
	
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

	$vote.voteB.onchange = $vote.voteO.onchange = $vote.voteG.onchange = $vote.voteN.onchange = function() {
		window.setTimeout(function() {
			var vote = getRadio($vote.vote);
			me.setVote(currentPage, vote, function(e){
				//e ? loadError() : loadEnd();
			});
		}, 0);
	}
	
	scroller = new AutoScroller($messageList);

	hashChange(true);
	//console.log = debugMessage;
}

function hashChange(first) {
	var fragment = getPath();
	navigateTo(fragment[0], first, function() {
		if (fragment[1]) {
			var n = document.getElementsByName("_anchor_"+fragment[1]);
			if (n[0])
				n[0].scrollIntoView();
		}
	});
}

window.onhashchange = function() {
	hashChange(false);
}

function getPath() {
	var hash = decodeURIComponent(location.hash.substr(1));
	return hash.split("#");
}

function navigateTo(path, first, callback) {
	lp.reset();
	path = path.split("/").filter(function(x){return x;});
	var type = path[0];
	var id = +(path[1]);
	if (type == "pages") {
		if (path[1] == "edit") {
			first && ($main.className = 'editMode');
			if (path[2]) {
				path[2] = path[2].split(/[&?]/g);
				id = +(path[2][0]);
			} else {
				id = undefined;
			}
			generateEditorView(id, callback);
		} else {
			first && ($main.className = 'pageMode');
			generatePageView(id, callback);
		}
	} else if (type == "categories") {
		first && ($main.className = 'categoryMode');
		generateCategoryView(id, callback);
	} else if (type == "user") {
		first && ($main.className = 'userMode');
		generateUserView(id, callback);
	} else if (type == "users") {
		first && ($main.className = 'membersMode');
		generateMembersView(null, callback);
	} else if (type == "discussions") {
		first && ($main.className = 'chatMode');
		generateChatView(id, callback);
	} else if (typeof type == 'undefined') { //home
		first && ($main.className = 'homeMode');
		generateHomeView(null, callback);
	} else {
		$main.className = "pageMode errorMode";
		generateAuthorBox();
		$pageTitle.textContent = "[404] I DON'T KNOW WHAT A \""+type+"\" IS";
		$pageContents.textContent = "";
		callback();
	}
}

function generateHomeView(idk, callback) {
	$main.className = "homeMode";
	generateAuthorBox();
	generatePath();
	$pageTitle.textContent = "Welcome to smilebnasic soruce! 2";
	callback();
}

function generatePath(cid, page) {
	$navPane.innerHTML = "";
	if (typeof cid != 'undefined') {
		renderPath(me.categoryTree, me.categoryTree.map[cid], $navPane, page);
	}
}

var editingPage;

function generateEditorView(id, callback) {
	if (id)
		me.getPageForEditing(id, go);
	else
		go();
	
	function go(page, users) {
		$main.className = "editorMode";
		generateAuthorBox(page, users);
		if (page) {
			generatePath(page.parentId, page);
			editingPage = page;
			$pageTitle.textContent = "";
			if (page.values)
				var markup = page.values.markupLang;
			$titleInput.value = page.name;
			$markupSelect.value = markup;
			$editorTextarea.value = page.content;
			updateEditorPreview();
		} else {
			generatePath();
			$pageTitle.textContent = "";
			$titleInput.value = "";
			$editorTextarea.value = "";
			editingPage = {}; //todo: fill stuff here
		}
		callback();
	}
}

// These are used to signal to the user when content is loading
function loadStart() {
	console.info("load start");
	if (window.$titlePane)
		window.$titlePane.style.backgroundColor = "#48F";
}
function loadEnd() {
	console.info("load end");
	$titlePane.style.backgroundColor = "";
}
function loadError() {
	$titlePane.style.backgroundColor = "#FCC";
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
				window.location.hash = "#pages/"+editingPage.id;
			}
		});
	}
}

function deletePage() {
	if (editingPage && editingPage.id) {
		var result = confirm("Are you sure you want to delete this page?");
		if (result) {
			// once the page is deleted, it should take you to the category (I guess)
			me.deletePage(editingPage.id, function(e, resp) {
				if (e) {
					alert("ERROR");
				} else {
					alert("OK DELETE");
				}
			});
		}
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

function setRadio(radio, state) {
	if (typeof state != 'undefined') {
		for (var i=0;i<radio.length;i++) {
			if (radio[i].value == state)
				radio[i].checked = true;
		}
	} else {
		radio[0].checked = true;
		radio[0].checked = false;
	}
}

function getRadio(radio) {
	for (var i=0;i<radio.length;i++) {
		if (radio[i].checked)
			return radio[i].value;
	}
	return null;
}

function generatePageView(id, callback) {
	loadStart();
	me.getPage(id, function(page, users, comments){
		$main.className = "pageMode";
		generateAuthorBox(page, users);
		visible($pageEditButton, page);
		if (page) {
			currentPage = page.id;
			generatePath(page.parentId, page);
			$pageTitle.textContent = "\uD83D\uDCC4 " + page.name;
			console.log(page.about.myVote);
			// todo: handle showing/hiding the vote box when logged in/out
			setRadio($vote.vote, page.about.myVote || "");
			renderPageContents(page, $pageContents)
			$pageEditButton.href = "#pages/edit/"+page.id;
		} else {
			currentPage = null;
			generatePath();
			$main.className += "errorMode";
			setRadio($vote.vote);
			$pageTitle.textContent = "Page not found";
			$pageContents.innerHTML = "";
		}
		callback();
	});
}

// todo: change edit box to "Joined: <date>" and "page edited: <date>"
function generateUserView(id, callback) {
	me.getUserPage(id, function(user, page, activity, pages, userMap) {
		console.info(arguments);
		$main.className = 'userMode';
		generateAuthorBox(user && page, userMap);
		renderUserPath($navPane);
		$userPageAvatar.src = "";
		$userActivity.innerHTML = "";
		if (user) {
			$pageTitle.textContent = user.username;
			if (page) {
				renderPageContents(page, $userPageContents)
			} else {
				$userPageContents.innerHTML = "";
			}
			$userPageAvatar.src = user.bigAvatarURL;
			console.log(pages, activity);
			activity.forEach(function(activity){
				var page;
				for (var i=0;i<pages.length;i++) {
					if (pages[i].id == activity.contentId) {
						page = pages[i];
						break;
					}
				}
				$userActivity.appendChild(renderActivityItem(activity, page));
			});
		} else {
			$main.className += " errorMode";
			$pageTitle.textContent = "User Not Found";
		}
		callback();
	});
}

function updateUserlist(listeners, userMap) {
	$chatUserlist.innerHTML = "";
	listeners && listeners.forEach(function(l) {
		$chatUserlist.appendChild(renderUserListAvatar(userMap[l]));
	})
}

function generateChatView(id, callback) {
	lp.callback = function(comments, listeners, userMap, page) {
		if (page && page.id == id) {
			generatePath(page.parentId, page);
			generateAuthorBox(page, userMap);
			$messageList.innerHTML = ""
			$main.className = "chatMode";
			scroller.switchRoom(id);
			$pageTitle.textContent = page.name;
			renderPageContents(page, $chatPageContents);
			callback();
		} else if (page == false) { //1st request, page doesn't exist
			generatePath();
			generateAuthorBox(page, userMap);
			$messageList.innerHTML = ""
			$pageTitle.textContent = "Page not found";
			$chatPageContents.innerHTML = "";
			callback();
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

function generateCategoryView(id, callback) {
	me.getCategory(id, 50, 0, 'editDate', false, function(category, childs, contentz, users) {
		hide($pageAuthorBox);
		$main.className = 'categoryMode';
		
		$categoryPages.innerHTML = "";
		$categoryCategories.innerHTML = "";
		$categoryDescription.textContent = "";
		if (category) {
			generatePath(category.id);
			$pageTitle.textContent = "\uD83D\uDCC1 "+category.name;
			$categoryDescription.textContent = category.description;
			childs.forEach(function(cat) {
				$categoryCategories.appendChild(renderCategory(cat, users));
			});
			$categoryPages.style.display="none";
			contentz.forEach(function(content) {
				$categoryPages.appendChild(renderCategoryPage(content, users));
			});
			$categoryPages.style.display="";
		} else {
			generatePath();
			$main.className += "errorMode";
			$pageTitle.textContent = "Category not found";
		}
		callback();
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

function generateMembersView(idk, callback) {
	me.getUsers({}, function(users) {
		hide($pageAuthorBox);
		$main.className = 'membersMode';
		$memberList.innerHTML = "";
		generatePath();
		$pageTitle.textContent = "Users";
		users.forEach(function(user) {
			$memberList.appendChild(renderMemberListUser(user));
		});
		callback();
	});
	
}
