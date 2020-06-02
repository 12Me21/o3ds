var uploadedAvatar;

function setTitle(text) {
	$pageTitle.textContent = text;
}

function generateSettingsView(n, callback) {
	// todo: check for logged in status
	me.getSettings(function(user, page) {
		$main.className = "settingsMode";
		generateAuthorBox();
		generatePath();
		if (user) {
			setTitle("User Settings: " + user.username);
			$settingsAvatar.src = user.avatarURL;
			if (page) {
				$userPageLink.href = "#pages/edit/"+page.id;
			} else {
				$userPageLink.href = "#pages/edit?type=@user.page&name=User Page";
			}
		}
		callback();
	});
}

var editingPage;

function newPage(query) {
	return {
		parentId: +query.cid || 0,
		type: query.type || "@page.resource",
		name: query.name || "",
		values: {
			markupLang: "12y"
		},
		permissions: {
			0: "cr"
		},
		keywords: []
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
	$editPageType.value = page.type;
	generatePath(page.parentId, page.name ? page : undefined);
}

function readEditorFields(page) {
	page.name = $titleInput.value;
	page.values.markupLang = $markupSelect.value;
	page.keywords = $keywords.value.split(" ");
	page.permissions = JSON.parse($permissions.value);
	page.type = $editPageType.value;
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
		visible($deletePage, page && /d/.test(page.myPerms));
		visible($submitEdit, !page || /u/.test(page.myPerms));
		//todo: set buttons to "disabled" instead maybe
		// and add explanation of permissions?
		//make it more clear when you can't modify page, especially
		
		if (page) {
			setTitle("Editing:");
			editingPage = page;
		} else {
			setTitle("Creating:");
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
	setTitle("Welcome to smilebnasic soruce! 2");
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
			setTitle("\uD83D\uDCC4 " + page.name);
			console.log(page.about);
			$watchCheck.checked = page.about.watching;
			// todo: handle showing/hiding the vote box when logged in/out
			renderPageContents(page, $pageContents)
			$pageEditButton.href = "#pages/edit/"+page.id;
			$voteCount_b.textContent = page.about.votes.b.count;
			$voteCount_o.textContent = page.about.votes.o.count;
			$voteCount_g.textContent = page.about.votes.g.count;
			["b","o","g"].forEach(function(vote) {
				window['$voteCount_'+vote].textContent = page.about.votes[vote].count;
				if (page.about.myVote == vote)
					window['$voteButton_'+vote].setAttribute('data-selected', "");
				else
					window['$voteButton_'+vote].removeAttribute('data-selected');
			});
		} else {
			currentPage = null;
			generatePath();
			$main.className += " errorMode";
			setTitle("Page not found");
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
			setTitle(user.username);
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
			setTitle("User Not Found");
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
			setTitle(page.name);
			renderPageContents(page, $chatPageContents);
			callback();
		} else if (page == false) { //1st request, page doesn't exist
			generatePath();
			generateAuthorBox(page, userMap);
			$messageList.innerHTML = ""
			setTitle("Page not found");
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
			var b = renderUserBlock(user, parseDate(c.createDate));
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
			contentz.reverse();
			generatePath(category.id);
			setTitle("\uD83D\uDCC1 "+category.name);
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
			setTitle("Category not found");
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
		setTitle("Users");
		users.forEach(function(user) {
			$memberList.appendChild(renderMemberListUser(user));
		});
		callback();
	});
}

function generateActivityView(idk, callback) {
	me.getActivity(function(activity, pages, users) {
		$main.className = 'activityMode';
		if (activity) {
			setTitle("Activity");
			var last = {};
			$activity.innerHTML = "";
			activity.forEach(function(activity){
				var page;
				if (activity.contentId != last.contentId || activity.action != last.action || activity.userId != last.userId) {
					for (var i=0;i<pages.length;i++) {
						if (pages[i].id == activity.contentId) {
							page = pages[i];
							break;
						}
					}
					if (activity.action == "d" && !page)
						page = {name: activity.extra, id: activity.contentId};
					
					if (page) {
						$activity.appendChild(renderActivityItem(activity, page, users[activity.userId]));
						last = activity;
					}
				}
			});
		}
		console.log(activity, pages, users);
	});
}
