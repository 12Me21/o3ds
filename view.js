// this file contains code for rendering stuff direclty to the screen
// none of it is "reusable" etc.

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

// clean up stuff whenever switching pages
function cleanUp() {
	flag('myUserPage');
	flag('canEdit');
	$messageList.innerHTML = "";
	$authorBox.innerHTML = "";
	$sbapiInfo.innerHTML = "";
	var nodes = document.querySelectorAll(".markup-root");
	for (var i=0;i<nodes.length;i++) {
		nodes[i].innerHTML = "";
	}
}

function setTitle(text) {
	$pageTitle.textContent = text;
	document.title = text;
}

function generateSettingsView(n, callback) {
	// maybe merge this with the register page somehow?
	// only one of them really works at a time anyway
	if (me.auth) {
		me.getSettings(function(user, page) {
			cleanUp();
			$main.className = "settingsMode";
			generateAuthorBox();
			generatePath([["#usersettings","Settings"]]);
			if (user) {
				setTitle("User Settings: " + user.username);
				userAvatar(user, $settingsAvatar);
				if (page) {
					$userPageLink.href = "#pages/edit/"+page.id;
				} else {
					$userPageLink.href = "#pages/edit?type=@user.page&name=User Page";
				}
			}
			callback();
		});
	} else {
		cleanUp();
		$main.className = "errorMode";
		setTitle("WHAT IS YOUR NAME?");
	}
}

var editingPage;
var editorCache = {};

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
	$editPageCategory.value = page.parentId;
	
	generatePagePath(page, me.userCache); //usercache is hack lol
}

function readEditorFields(page) {
	page.name = $titleInput.value;
	page.values.markupLang = $markupSelect.value;
	page.keywords = $keywords.value.split(" ");
	page.permissions = JSON.parse($permissions.value);
	page.type = $editPageType.value;
	page.content = $editorTextarea.value;
	page.parentId = +$editPageCategory.value;
}

// call this function with no `id` to create a new page
// remember to set .cid in `query` so it knows what parentId to use

// idea: when editing, store the parent category/whatever somewhere, to tell where to go back to when deleting/ and also a way to send you to your user page when editing that I guess.
function generateEditorView(id, query, callback) {
	me.getPageForEditing(id, go);
	// if there's no ID, getPageForEditing will just
	// get the category tree if it's needed
	
	function go(page, users) {
		cleanUp();
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

function newCategory(query) {
	return {
		parentId: +query.cid || 0,
		name: "untitled",
		values: {},
		permissions: {
			0: "cr"
		},
		description: ""
	};
}

function fillCateditFields(cat) {
	$cateditTitle.value = cat.name;
	var pinned = cat.values.pinned || "";
	$cateditPinned.value = pinned;
	$cateditCategory.value = cat.parentId;
	$cateditPermissions.value = JSON.stringify(cat.permissions);
	$cateditDescription.value = cat.description;
	generatePath(makeCategoryPath(me.categoryTree, cat.id));
}

function readCateditFields(cat) {
	cat.name = $cateditTitle.value;
	cat.values.pinned = $cateditPinned.value;
	cat.parentId = +$cateditCategory.value;
	cat.permissions = parseJSON($cateditPermissions.value);
	cat.description = $cateditDescription.value;
}

var editingCategory;
function generateCateditView(id, query, callback) {
	me.getCategoryForEditing(id, function(cat) {
		cleanUp();
		$main.className = 'cateditMode';
		if (cat) {
			setTitle("Editing Category:");
			editingCategory = cat;
		} else {
			setTitle("Creating Category:");
			editingCategory = newCategory(query);
		}
		fillCateditFields(editingCategory);
		callback();
	});
}

function generateHomeView(idk, callback) {
	cleanUp();
	$main.className = "homeMode";
	generateAuthorBox();
	generatePath();
	setTitle("Welcome to smilebnasic soruce! 2");
	callback();
}

function attr(element, attr, value) {
	if (value == undefined)
		element.removeAttribute(attr)
	else
		element.setAttribute(attr, value);
}

function generatePagePath(page, users) {
	// user page (at root)
	if (page.type == "@user.page" && !page.parentId) {
		var creator = users[page.createUserId];
		generatePath([["#users","Users"], ["#user/"+creator.id, creator.username], ["#pages/"+page.id, page.name]]);
	} else if (page.id) {
		generatePath(makeCategoryPath(me.categoryTree, page.parentId, page));
	} else {
		generatePath(makeCategoryPath(me.categoryTree, page.parentId));
	}
}

function generatePageView(id, callback) {
	loadStart();
	me.getPage(id, function(page, users, comments){
		cleanUp();
		$main.className = "pageMode";
		generateAuthorBox(page, users);
		flag('canEdit', !!page);
		if (page) {
			generatePagePath(page, users);
			currentPage = page.id;
			setTitle("\uD83D\uDCC4 " + page.name);
			$watchCheck.checked = page.about.watching;
			// todo: handle showing/hiding the vote box when logged in/out
			renderPageContents(page, $pageContents)
			$editButton.href = "#pages/edit/"+page.id;
			$voteCount_b.textContent = page.about.votes.b.count;
			$voteCount_o.textContent = page.about.votes.o.count;
			$voteCount_g.textContent = page.about.votes.g.count;
			["b","o","g"].forEach(function(vote) {
				window['$voteCount_'+vote].textContent = page.about.votes[vote].count;
				attr(window['$voteButton_'+vote], 'data-selected', page.about.myVote == vote ? "" : undefined);
			});

			var photos = page.values.photos;
			visible($gallery, photos);
			if (photos) {
				photos = photos.split(",").map(function(x){return +x});
				$galleryImage.src = me.fileUrl(photos[0]);
			}
			var keyinfo = parseJSON(page.values.keyinfo);
			var key = page.values.key;
			var supported = parseJSON(page.values.supported);
			flag('hasKey', !!key);
			
			if (key) {
				$metaKey.textContent = key;
				$metaKey.className = "metaKey textItem";
				
				sbapi(key, function(data) {
					if (!data) {
						$metaKey.className += " invalidKey";
					} else if (!data.available) {
						$metaKey.className += " brokenKey";
					}
					renderKeyInfo(key, data, $sbapiInfo)
				})
			} else {
				$metaKey.textContent = "";
				$sbapiInfo.innerHTML = "";
			}
		} else {
			currentPage = null;
			setTitle("Page not found");
			generatePath();
			$main.className = "errorMode";
		}
		callback();
	});
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

function megaAggregate(activity, ca, contents) {
	var contentMap = {};
	contents.forEach(function(x){
		contentMap[x.id] = x;
	})
	var allAct = activity.concat(ca.map(function(x){
		return {
			action: "p",
			contentId: x.id,
			date: x.lastDate,
			firstDate: x.firstDate,
			id: x.lastId,
			userId: x.userIds,
			type: 'content',
		}
	}));
	allAct.forEach(function(x) {
		if (x.action == 'd')
			x.content = {name: x.extra, id: x.contentId, deleted: true};
		else
			x.content = contentMap[x.contentId];
	});
	allAct.sort(function(a, b) {
		return a.date < b.date;
	});
	//todo: trim all trailing of same type because that's when the other runs out
	// also we can optimize merging of 2 sorted arrays here!
	return allAct;
}

function generatePath(path) {
	renderPath($navPane, path);
}
// function generatePagePath - category tree paths

function generateUserView(id, callback) {
	me.getUserPage(id, function(user, page, activity, ca, pages, userMap) {
		cleanUp();
		$main.className = 'userMode';
		// todo: change edit box to "Joined: <date>" and "page edited: <date>"
		generateAuthorBox(user && page, userMap);
		
		$userPageAvatar.src = "";
		$userActivity.innerHTML = "";
		if (page) {
			$editButton.href = "#pages/edit/"+page.id;
			flag('canEdit', true);
		} else if (id == me.uid) {
			$editButton.href = "#pages/edit?type=@user.page&name=User Page";
			flag('canEdit', true);
		}
		if (user) {
			generatePath([["#users","Users"], ["#user/"+id, user.username]]);
			if (user.id == me.uid)
				flag('myUserPage', true);
			setTitle(user.username);
			if (page) {
				renderPageContents(page, $userPageContents)
			} else {
				$userPageContents.innerHTML = "";
			}
			userAvatar(user, $userPageAvatar, true);
			$userPageAvatarLink.href = user.rawAvatarURL;
			var lastId, lastAction;
			megaAggregate(activity, ca, pages).forEach(function(activity){
				if (activity.type != "content") //idk, category?
					return;
				if (activity.contentId != lastId || activity.action != lastAction) {
					if (activity.content) {
						$userActivity.appendChild(renderActivityItem(activity, activity.content));
						lastId = activity.contentId;
						lastAction = activity.action;
					}
				}
			});
		} else {
			generatePath([["#users","Users"], undefined]);
			$main.className = "errorMode";
			setTitle("User Not Found");
		}
		callback();
	});
}

function generateChatView(id, callback) {
	cleanUp();
	// todo: make this work when logged out
	// use a normal request at first and then switch on the long poller IF logged in
	lp.callback = function(comments, listeners, userMap, page) {
		console.log("got callback", comments, listeners, userMap, page);
		if (page && page.id == id) {
			generatePath(makeCategoryPath(me.categoryTree, page.parentId, page));
			generateAuthorBox(page, userMap);
			$messageList.innerHTML = ""
			$main.className = "chatMode";
			scroller.switchRoom(id);
			setTitle(page.name);
			renderPageContents(page, $pageContents);
			callback();
		} else if (page == false) { //1st request, page doesn't exist
			generatePath();
			generateAuthorBox(page, userMap);
			$messageList.innerHTML = ""
			setTitle("Page not found");
			$pageContents.innerHTML = "";
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
	lp.addRoom(+id);
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

function generateCategoryView(id, query, callback) {
	var users2;
	function handlePinned(pinned) {
		console.log(pinned,"pinned");
		$categoryPinned.innerHTML = "";
		pinned.forEach(function(content) {
			$categoryPinned.appendChild(renderCategoryPage(content, users2, true));
		});
	}

	var page = +query.page || 0
	me.getCategory(id, page, function(category, childs, contentz, users, pinned) {
		//todo: make these only load the pages, not pinned etc. too;
		$categoryPageNumber.textContent = " "+page;
		$categoryPagesPrev.onclick = function() {
			window.location.hash = "#categories/"+id+"?page="+(page-1);
		}
		$categoryPagesNext.onclick = function() {
			window.location.hash = "#categories/"+id+"?page="+(page+1);
		}
		
		users2 = users;
		cleanUp();
		$main.className = 'categoryMode';
		
		$categoryPages.innerHTML = "";
		$categoryCategories.innerHTML = "";
		$categoryDescription.textContent = "";
		$categoryPinned.innerHTML = "";
		flag('canEdit', !!category);
		visible($categoryDescription, category && category.id);
		if (category) {
			$editButton.href = "#categories/edit/"+category.id;
			contentz.reverse();
			generatePath(makeCategoryPath(me.categoryTree, category.id));
			setTitle("\uD83D\uDCC1 "+category.name);
			if (category.id)
				renderPageContents({
					content: category.description,
					values: category.values
				}, $categoryDescription);
			childs.forEach(function(cat) {
				$categoryCategories.appendChild(renderCategory(cat, users));
			});
			$categoryPages.style.display="none";
			contentz.forEach(function(content) {
				$categoryPages.appendChild(renderCategoryPage(content, users));
			});
			$categoryPages.style.display="";
			$categoryCreatePage.href = "#pages/edit?cid="+category.id;
			if (pinned)
				handlePinned(pinned);
			else if (category.values.pinned) {
				category.values.pinned.split(",").forEach(function(x) {
					$categoryPinned.appendChild(renderCategoryPage({
						id: +x,
						name: ""
					}, users, true));
				});
			}
		} else {
			generatePath();
			$categoryCreatePage.href = ""
			$main.className += "errorMode";
			setTitle("Category not found");
		}
		callback();
	}, handlePinned);
}

function generateMembersView(idk, callback) {
	me.getUsers({}, function(users) {
		cleanUp();
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

function generateActivityView(query, callback) {
	var page = +query.page || 0;
	me.getActivity(page, function(activity, ca, pages, users) {
		$activityPageNumber.textContent = " "+page+" days ago";
		$activityPagePrev.href = "#activity?page="+(page-1);
		$activityPageNext.href = "#activity?page="+(page+1);
		cleanUp();
		$main.className = 'activityMode';
		renderActivityPath($navPane);
		if (activity) {
			setTitle("Activity");
			var last = {};
			$activity.innerHTML = "";
			megaAggregate(activity, ca, pages).forEach(function(activity){
				if (activity.type != "content") {//idk, category?
					console.log("non-content", activity);
					return;
				}
				if (activity.contentId != last.contentId || activity.action != last.action || activity.userId != last.userId) {
					if (activity.content) {
						if (activity.userId instanceof Array)
							var user = activity.userId.map(function(x){
								return users[x];
							})
						else
							user = users[activity.userId]
						$activity.appendChild(renderActivityItem(activity, activity.content, user));
						last = activity;
					}
				}
			});
		}
	});
}

function generateRegisterView(idk, callback) {
	cleanUp();
	$main.className = "registerMode";
	generateAuthorBox();
	generatePath();
	setTitle("Create an account");
	callback();
}

function sbapi(key, callback) {
	var x = new XMLHttpRequest();
	x.open('GET', protocol()+"//sbapi.me/get/"+key+"/info?json=1");
	x.onload = function() {
		var code = x.status;
		if (code == 200) {
			var resp = null;
			try {
				resp = JSON.parse(x.responseText);
			} catch(e) {
			}
			callback(resp);
		} else {
			callback(null);
		}
	}
	x.onerror = function() {
		callback(null);
	}
	x.setRequestHeader('Pragma', "no-cache"); // for internet explorer
	x.send();
}
