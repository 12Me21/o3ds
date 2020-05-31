var editingPage;

function newPage(query) {
	return {
		parentId: +query.cid,
		values: {
			markupLang: "12y"
		},
		permissions: {
			0: "cr"
		},
		keywords: [],
	};
}

function fillEditorFields(page) {
	$titleInput.value = page.name || "";
	if (page.values)
		var markup = page.values.markupLang;
	if (!markup)
		markup = "12y";
	$markupSelect.value = markup;
	if (page.content)
		$editorTextarea.value = page.content;
	updateEditorPreview();
	$keywords.value = page.keywords.join(" ");
	$permissions.value = JSON.stringify(page.permissions);
	generatePath(page.parentId, page.name ? page : undefined);
}

function readEditorFields(page) {
	page.name = $titleInput.value;
	page.values.markupLang = $markupSelect.value;
	page.keywords = $keywords.value.split(" ");
	page.permissions = JSON.parse($permissions.value);
	page.content = $editorTextarea.value;
}

// call this function with no `id` to create a new page
// remember to set .cid in `query` so it knows what parentId to use
function generateEditorView(id, query, callback) {
	me.getPageForEditing(id, go);
	// if there's no ID, getPageForEditing will just
	// get the category tree if it's needed
	
	function go(page, users) {
		$main.className = "editorMode";
		generateAuthorBox(page, users);
		visible($deletePage, page);
		$pageTitle.textContent = "Editing:";
		if (page) {
			editingPage = page;
		} else {
			editingPage = newPage(query);
			$titleInput.focus();
		}
		fillEditorFields(editingPage);
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
		renderUserPath($navPane, user);
		$userPageAvatar.src = "";
		$userActivity.innerHTML = "";
		if (user) {
			console.log("activity",activity);
			$pageTitle.textContent = user.username;
			if (page) {
				renderPageContents(page, $userPageContents)
			} else {
				$userPageContents.innerHTML = "";
			}
			$userPageAvatar.src = user.bigAvatarURL;
			var lastId, lastAction;
			activity.forEach(function(activity){
				var page;
				if (activity.contentId != lastId || activity.action != lastAction) {
					for (var i=0;i<pages.length;i++) {
						if (pages[i].id == activity.contentId) {
							page = pages[i];
							break;
						}
					}
					if (activity.action == "d" && !page)
						page = {name: activity.extra, id: activity.contentId};
					
					if (page) {
						$userActivity.appendChild(renderActivityItem(activity, page));
						lastId = activity.contentId;
						lastAction = activity.action;
					}
				}
			});
		} else {
			$main.className += " errorMode";
			$pageTitle.textContent = "User Not Found";
		}
		callback();
	});
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
			$categoryCreatePage.href = "#pages/edit?cid="+category.id;
		} else {
			generatePath();
			$categoryCreatePage.href = ""
			$main.className += "errorMode";
			$pageTitle.textContent = "Category not found";
		}
		callback();
	});
}

function generateMembersView(idk, callback) {
	me.getUsers({}, function(users) {
		hide($pageAuthorBox);
		$main.className = 'membersMode';
		$memberList.innerHTML = "";
		renderUserPath($navPane);
		$pageTitle.textContent = "Users";
		users.forEach(function(user) {
			$memberList.appendChild(renderMemberListUser(user));
		});
		callback();
	});
	
}
