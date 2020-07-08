// this file contains code for rendering stuff direclty to the screen
// none of it is "reusable" etc.

// clean up stuff whenever switching pages
function cleanUp(type) {
	if (type != "pages") {
		lp.setViewing();
	}
	flag('myUserPage');
	flag('canEdit');
	flag('page');
	$authorBox.innerHTML = "";
	$sbapiInfo.innerHTML = "";
	$fileBox.innerHTML = "";
	/*$chatUserlist.innerHTML = "";*/
	$fileView.src = "";
	/*var nodes = document.querySelectorAll(".markup-root");
	for (var i=0;i<nodes.length;i++) {
		nodes[i].innerHTML = "";
	}*/
	cancelEdit();
	onUserPage = null;
}

var currentChatRoom;

function setTitle(text, icon) {
	$pageTitle.textContent = text;
	document.title = text;
	if (icon) {
		$pageTitleIcon.className = "item iconBg iconBg-"+icon;
	} else {
		$pageTitleIcon.className = "";
	}
	changeFavicon("images/icon32.png?a");
}

function submitUserSettings() {
	me.setSensitive({
		oldPassword: $settingsOldPassword.value,
		username: $settingsUsername.value || undefined,
		newPassword: $settingsNewPassword.value || undefined,
		newEmail: $settingsEmail.value || undefined
	}, function(){});
}

var editingPage;
var editorCache = {};

function cleanUpEditor() {
	$editorTextarea.value = "";
}

function newPage(query) {
	return {
		parentId: +query.cid || 0,
		type: query.type || "@page.resource",
		name: query.name || "",
		values: {
			markupLang: "12y"
		},
		permissions: query.permissions || {
			0: "cr"
		},
		keywords: []
	};
}

function generatePagePath(page, users) {
	// user page (at root)
	if (page.type == "@user.page" && !page.parentId) {
		var creator = users[page.createUserId] || me.me; //hack for user page creation
		generatePath([["#users","Users"], ["#user/"+creator.id, creator.username], ["#pages/"+page.id, page.name]]);
	} else if (page.id) {
		generatePath(makeCategoryPath(me.categoryTree, page.parentId, page));
	} else {
		generatePath(makeCategoryPath(me.categoryTree, page.parentId));
	}
}

function decodeComment(content) {
	var newline = content.indexOf("\n");
	try {
		// try to parse the first line as JSON
		var data = JSON.parse(newline>=0 ? content.substr(0, newline) : content);
	} finally {
		if (data && data.constructor == Object) { // new or legacy format
			if (newline >= 0)
				data.t = content.substr(newline+1); // new format
		} else // raw
			data = {t: content};
		return data;
	}
}

function encodeComment(text, metadata) {
	return JSON.stringify(metadata || {})+"\n"+text;
}

function decodeComment(content) {
	var text, markup;
	var i = content.indexOf("\n");
	if (i < 0) {
		if (content[0] == "{") {
			var j = parseJSON(content);
			if (j) {
				text = j.t;
				markup = j.m;
			} else
				text = content;
		} else {
			text = content;
		}
	} else {
		var j = parseJSON(content.substr(0,i));
		if (j) {
			markup = j.m
		}
		text = content.substr(i+1);
	}
	return [text,markup];
}

function sendMessage(room, text, params, editId) {
	if (editId) {
		me.editComment(editId, text, params || {}, function(e, resp) {} );
	} else {
		me.postComment(room, text, params || {}, function(e, resp) {
			if (e=="rate") {
				debugMessage("You are sending messages too fast");
			} else if (e) {
				debugMessage("Failed to send message");
			}
		});
	}
}

function megaAggregate(activity, ca, contents, users, category) {
	var contentMap = {};
	contents.forEach(function(x){
		contentMap[x.id] = x;
	})
	category && category.forEach(function(x){
		contentMap[x.id] = x;
	})
	var allAct = activity.concat(ca.map(function(x){
		if (x.editDate) {
			return {
				action: "p",
				contentId: x.parentId,
				date: x.editDate,
				id: x.id,
				userId: x.createUserId,
				editUserId: x.editUserId,
				type: 'content',
				comment: x.content,
				deleted: x.deleted
			}
		}
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
	allAct = allAct.filter(function(x) {
		if (x.action == 'd')
			x.content = {name: x.extra, id: x.contentId, deleted: true};
		else if (x.type == "content")
			x.content = contentMap[x.contentId];
		else if (x.type == "category") {
			
			x.content = contentMap[x.contentId];
		} else if (x.type == "user" && x.action!="u") {
			x.content = users[x.contentId];
		} else
			return; //some weird activity type
		return x;
	});
	allAct = allAct.sort(function(a, b) {
		if (a.date > b.date)
			return -1;
		if (a.date < b.date)
			return 1;
		return 0;
	});
	//todo: trim all trailing of same type because that's when the other runs out
	return allAct;
}

function generatePath(path) {
	renderPath($navPane, path);
}
// function generatePagePath - category tree paths

function updateUserlist(list, listeners, userMap) {
	list.innerHTML = "";
	listeners && forDict(listeners, function(status, user) {
		status = decodeStatus(status);
		if (status) {
			list.appendChild(renderUserListAvatar(userMap[user]));
		}
	})
}

var currentFavicon = null;
function changeFavicon(src) {
	if (src == currentFavicon)
		return;
	currentFavicon = src;
	var link = document.createElement("link");
	var oldLink = document.getElementById("dynamic-favicon");
	link.id = "dynamic-favicon";
	link.rel = "shortcut icon";
	link.href = src;
	if (oldLink) {
		document.head.removeChild(oldLink);
	}
	document.head.appendChild(link);
}

/*function displayGap() {
	scroller.insert(null, renderMessageGap());
}*/

function handlePinned(pinned) {
	$categoryPinned.innerHTML = "";
	pinned.forEach(function(content) {
		$categoryPinned.appendChild(renderPinnedPage(content, users2, true));
	});
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

function readFileFields(file) {
	file.name = $fileName.value;
	file.permissions = parseJSON($filePermissions.value);
	file.values = parseJSON($fileValues.value);
}

function fillFileFields(file) {
	$fileName.value = file.name;
	$filePermissions.value = JSON.stringify(file.permissions);
	$fileValues.value = JSON.stringify(file.values);
	$fileUser.textContent = me.userCache[file.createUserId].username;
}

function renderFileThumbnail(file) {
	var div = document.createElement('div');
	div.className = "fileThumbnail item";
	div.onclick = function() {
		selectFile(file);
	}
	var img = document.createElement('img');
	img.src = me.thumbnailURL(file.id);
	div.appendChild(img);
	return div;
}

function saveFileSettings() {
}

var selectedFile;
function selectFile(file) {
	selectedFile = null;
	fillFileFields(file);
	$fileView.src = "";
	$fileView.src = me.imageURL(file.id);
	var doSelect = true;
	$fileView.onload = null
	//$fileView.onerror = function() {
		if (!doSelect)
			return;
		doSelect = false
		selectedFile = file;
		flag('fileSelected', true);
		flag('canEdit', /u/.test(file.myPerms));
	//}
	flag('fileUploading');
}

function detectFileType(buffer) {
	var x = new Uint8Array(buffer);
	if (x[0]==137 && x[1]==80 && x[2]==78 && x[3]==71)
		return "image/png";
	if (x[0]==0x42 && x[1]==0x4D)
		return "image/bmp";
	if (x[0]==0x47 && x[1]==0x49 && x[2]==0x46)
		return "image/gif";
	else
		return "image/jpeg"
}

function getImageFile(url, callback) {
	// todo: make this work better.
	// at the very least, handle local urls specially
	try {
		var x = new XMLHttpRequest();
		x.open('GET', url);
		
		x.responseType = "arraybuffer"
		x.onload = function() {
			if (x.status == 200) {
				var type = detectFileType(x.response);
				var file = new Blob([x.response], {type:type});
				file.name="name";
				file.lastModifiedDate = new Date();
				callback(file);
			} else {
				alert("can't get this file!");	
			}
		}
		x.send();
	} catch (e) {
		alert("can't upload this file!");
	}
}

function selectFileURL(url) {
	getImageFile(url, selectUploadedFile);
}

function selectUploadedFile(file) {
	selectedFile = null;
	var url = URL.createObjectURL(file);
	URL.revokeObjectURL($fileView.src); //should probably only do this when it's actually a blob url lol
	$fileView.src = url;
	$fileView.onload = function() {
		selectedFile = file;
		flag('fileUploading', true);
	}
	flag('fileSelected');
}

function handleLoads(element) {
	var imgs = element.querySelectorAll('video, img, iframe');
	for (var i=0; i<imgs.length; i++) {
		imgs[i].onload = function() {
			scrollToAuto();
		}
	}
}

function doView(name, id, query, callback) {
	var view = views[name] || views.error;
	var cancelled;
	if (view.start) {
		var xhr = view.start(id, query, function() {
			if (cancelled)
				return;
			cleanUp(name);
			view.render.apply(null, arguments);
			callback();
		});
	} else {
		cleanUp(name);
		view.render(id, query, name);
		callback();
	}
	return function() {
		if (xhr && xhr.abort) {
			xhr.abort();
			loadEnd();
		}
		cancelled = true;
	}
}

var views = {
	files: {
		start: function(id, query, callback) {
			var page = +query.page || 0;
			selectedFile = null;
			flag('fileSelected');
			flag('fileUploading');
			return me.getFiles({}, page, function(files, users) {
				callback(files, page, users);
			});
		},
		render: function(files, page, users) {
			$main.className = "fileMode";
			setTitle("Files");
			$filePageNumber.textContent = " page "+page;
			$filePrev.href = "#files?page="+(page-1);
			$fileNext.href = "#files?page="+(page+1);
			generatePath([["#files","Files"], undefined]);
			if (files) {
				files.forEach(function(file) {
					$fileBox.appendChild(renderFileThumbnail(file));
				});
			}
		}
	},
	login: {
		render: function(id, query, callback) {
			$main.className = "registerMode";
			setTitle("Log-in or Create an Account");
		}
	},
	activity: {
		start: function(id, query, callback) {
			var page = +query.page || 0;
			return me.getActivity(page, function(activity, ca, pages, users) {
				callback(activity, ca, pages, users, page);
			});
		},
		render: function(activity, ca, pages, users, page) {
			$main.className = 'activityMode';
			$activityPageNumber.textContent = " "+page+" days ago";
			$activityPagePrev.href = "#activity?page="+(page-1);
			$activityPageNext.href = "#activity?page="+(page+1);
			generatePath([["#activity","Activity"], undefined]);
			if (activity) {
				setTitle("Activity");
				var last = {};
				$activity.innerHTML = "";
				
				megaAggregate(activity, ca, pages).forEach(function(activity){
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
		}
	},
	users: {
		start: function(id, query, callback) {
			var page = (+query.page-1) || 0;
			return me.getUsers({reverse: false}, page, function(users) {
				callback(users, page);
			});
		},
		render: function(users, page) {
			$main.className = 'membersMode';
			$memberList.innerHTML = "";
			$membersPrev.href = "#users?page="+Math.max(1,page);
			$membersNext.href = "#users?page="+(page+2);
			// we need better pagination :(
			generatePath([["#users","Users"],undefined]);
			setTitle("Users");
			users.forEach(function(user) {
				$memberList.appendChild(renderMemberListUser(user));
			});
		}
	},
	categories: {
		start: function(id, query, callback) {
			var page = +query.page || 0
			return me.getCategory(id, page, function(category, childs, contentz, users, pinned) {
				callback(category, childs, contentz, users, pinned, page, id);
			}, handlePinned);
		},
		render: function(category, childs, contentz, users, pinned, page, id) {
			//todo: make these only load the pages, not pinned etc. too;
			$categoryPageNumber.textContent = " "+page;
			$categoryPagesPrev.onclick = function() {
				window.location.hash = "#categories/"+id+"?page="+(page-1);
			}
			$categoryPagesNext.onclick = function() {
				window.location.hash = "#categories/"+id+"?page="+(page+1);
			}
			
			users2 = users;
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
				setTitle(category.name, 'category');
				if (category.id && category.description)
					renderPageContents({
						content: category.description,
						values: category.values
					}, $categoryDescription);
				childs.forEach(function(cat) {
					$categoryCategories.appendChild(renderCategory(cat, users));
				});
				$categoryPages.style.display="none";
				contentz.reverse();
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
				$categoryCreatePage.href = ""
				$main.className += "errorMode";
				setTitle("Category not found");
			}
		}
	},
	user: {
		start: function(id, query, render) {
			id = +id;
			return me.getUserPage(id, function(user, page, activity, ca, pages, userMap) {
				render(user, page, activity, ca, pages, userMap, id);
			})
		},
		render: function(user, page, activity, ca, pages, userMap, id) {
			$main.className = 'userMode';
			// todo: change edit box to "Joined: <date>" and "page edited: <date>"
			generateAuthorBox(user && page, userMap);
			
			$userPageAvatar.src = "";
			$userActivity.innerHTML = "";
			if (user) {
				onUserPage = user.id;
				generatePath([["#users","Users"], ["#user/"+id, user.username]]);
				if (user.id == me.uid)
					flag('myUserPage', true);
				setTitle(user.username);
				if (page) {
					renderPageContents(page, $userPageContents)
					$editButton.href = "#pages/edit/"+page.id;
					flag('canEdit', true);
				} else if (user.id == me.uid) {
					$userPageContents.innerHTML = "";
					$userPageContents.appendChild(renderLinkButton("Create User Page", "#pages/edit?type=@user.page&name="+encodeURIComponent(me.me.username+"'s User Page")));
					flag('canEdit', false);
				} else {
					$userPageContents.innerHTML = "";
				}
				userAvatar(user, $userPageAvatar, true);
				$userPageAvatarLink.href = user.rawAvatarURL;
				$userPageStatus.textContent = decodeStatus(lp.getGlobalStatuses[user.id] || "");
				var lastId, lastAction;
				megaAggregate(activity, ca, pages).forEach(function(activity){
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
		}
	},
	pages: {
		start: function(id, query, callback) {
			var room = manager.rooms[id] || manager.add(id, $defaultStatus.value);
			/*if (manager.rooms[id].loaded)
				manager.show(id);*/
			var linked = query["#"];
			if (linked && /^comment-/.test(linked)) {
				linked=+linked.substr(8);
			} else {
				linked = null;
			}
			// (if logged out, never load pages from cache)
			// (because we can't listen to activity so the data might be old)
			// (it would be possible to show the (possibly old) cached data while page is loading, but this is for logged-out users, whatever)
			if (me.auth && manager.rooms[id].page) {
				callback(manager.rooms[id].page, manager.rooms[id].users, [], {});
			} else {
				return me.getPageAndComments(id, function(page, users, comments){
					callback(page, users, comments, query);
				});
			}
		},
		render: function(page, users, comments, query) {
			$main.className = "pageMode";
			generateAuthorBox(page, users);
			flag('canEdit', !!page);
			if (page) {
				room = manager.rooms[page.id]
				flag('page', true);
				/*scroller.switchRoom(page.id);*/
				manager.show(page.id);
				generatePagePath(page, users);
				currentPage = page.id;
				currentChatRoom = page.id;
				var icon = "page";
				if (!hasPerm(page.permissions, 0, 'r'))
					icon = "hiddenpage"
				setTitle(page.name, icon);
				$watchCheck.checked = page.about.watching;

				room.updatePage(page);
				handleLoads(room.pageElement);
				/*renderPageContents(page, $pageContents)*/
				if (!room.loaded) {
					room.page = page;
					room.users = users;
					addPinned(page);
					comments && comments.reverse().forEach(function(comment) {
						room.displayMessage(comment, users[comment.createUserId], true);
					});
					room.loaded = true;
				}
				$editButton.href = "#pages/edit/"+page.id;
				// todo: handle showing/hiding the vote box when logged in/out
				$voteCount_b.textContent = page.about.votes.b.count;
				$voteCount_o.textContent = page.about.votes.o.count;
				$voteCount_g.textContent = page.about.votes.g.count;
				["b","o","g"].forEach(function(vote) {
					window['$voteCount_'+vote].textContent = page.about.votes[vote].count;
					attr(window['$voteButton_'+vote], 'data-selected', page.about.myVote == vote ? "true" : undefined);
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
				if (query["#"]) {
					var comment=document.getElementById("_anchor_"+query["#"])
					if (comment) {
						comment.scrollIntoView()
						comment.setAttribute("data-linked", "");
					}
				}
			} else {
				currentPage = null;
				setTitle("Page not found");
				generatePath();
				$main.className = "errorMode";
			}
		}
	},
	"": {
		render: function(id, query, callback) {
			$main.className = "homeMode";
			generatePath();
			var text = "Welcome to SmileBASIC Source 2!"
			var index = Math.random()*(text.length-1)|0;
			text = text.substring(0,index)+text[index+1]+text[index]+text.substr(index+2);
			setTitle(text);
		}
	},
	'categories/edit': {
		start: function(id, query, callback) {
			return me.getCategoryForEditing(id, function(cat) {
				callback(cat, query);
			})
		},
		render: function(cat, query) {
			$main.className = 'cateditMode';
			if (cat) {
				visible($cateditSubmit, /u/.test(cat.myPerms));
				setTitle("Editing Category:");
				editingCategory = cat;
			} else {
				setTitle("Creating Category:");
				editingCategory = newCategory(query);
			}
			fillCateditFields(editingCategory);
		}
	},
	// idea: when editing, store the parent category/whatever somewhere, to tell where to go back to when deleting/ and also a way to send you to your user page when editing that I guess.

	'pages/edit': {
		start: function(id, query, callback) {
			return me.getPageForEditing(id, function(page, users) {
				callback(page, users, query);
			});
		},
		render: function(page, users, query) {
			$main.className = "editorMode";
			//todo: detect create perm properly (on category)
			// annoying thing is, when logging in to a page,
			// would need to re-request myperms hmm
			// maybe just have proper error handling?
			var canEdit = (!page && me.auth) || /u/.test(page.myPerms)
			visible($deletePage, page && /d/.test(page.myPerms));
			visible($submitEdit, canEdit);
			generateAuthorBox(page, users);
			//todo: set buttons to "disabled" instead maybe
			// and add explanation of permissions?
			//make it more clear when you can't modify page, especially
			
			if (page) {
				setTitle(canEdit ? "Editing:" : "Viewing Source:");
				editingPage = page;
			} else {
				setTitle("Creating:");
				editingPage = newPage(query);
				$titleInput.focus();
			}
			fillEditorFields(editingPage, users);
		}
	},
	usersettings: {
		start: function(id, query, render) {
			if (me.auth) {
				return me.getSettings(function(user, page) {
					render(user, page)
				});
			} else {
				render();
			}
		},
		render: function(user, page) {
			if (user) {
				$main.className = "settingsMode";
				generateAuthorBox();
				generatePath([["#usersettings","Settings"]]);
				setTitle("User Settings: " + user.username);
				me.getVariables(["userCSS", "userJS"], function(vars) {
					console.log(vars);
					if (vars.userCSS != null)
						$settingsUserCSS.value = vars.userCSS;
					if (vars.userJS != null)
						$settingsUserJS.value = vars.userJS;
				});
			} else {
				$main.className = "errorMode";
				setTitle("WHAT IS YOUR NAME?");
			}
		}
	},
	test: {
		render: function(id, query) {
			setTitle("Testing");
			$main.className = "testMode";
		}
	},
	error: {
		render: function(id, query, type) {
			$main.className = "errorMode";
			setTitle("[404] I DON'T KNOW WHAT A \""+type+"\" IS");
		}
	}
}

function addPinned(page) {
	$sidebarPinned.appendChild(renderPinnedPage(page, function() {
		manager.remove(page.id);
	}))
}

function RoomManager(element, poller) {
	this.element = element;
	this.rooms = {};
	this.lp = poller;
}

RoomManager.prototype.updateStatuses = function(id) {
	this.lp.setListening([id]);
	forDict(this.rooms, function(room, rid) {
		if (id != rid)
			if (this.lp.statuses[rid])
				this.lp.statuses[rid] = ""
	});
	this.lp.refresh();
	forDict(this.rooms, function(room, rid) {
		if (id != rid) {
			if (this.lp.statuses[rid] = "")
				delete this.lp.statuses[rid];
			room.hide();
		} else
			room.show();
	});
}

RoomManager.prototype.displayMessage = function(comment, users) {
	var room = this.rooms[comment.parentId]
	if (room)
		room.displayMessage(comment, users[comment.createUserId]);
}

RoomManager.prototype.show = function(id) {
	lp.setListening([id]);
	forDict(this.rooms, function(room, rid) {
		if (id != rid)
			if (lp.statuses[rid])
				lp.statuses[rid] = ""
	});
	lp.statuses[id] = this.rooms[id].status;
	$currentStatus.value = this.rooms[id].status;
	lp.refresh();
	forDict(this.rooms, function(room, rid) {
		if (id != rid) {
			if (lp.statuses[rid] = "")
				delete lp.statuses[rid];
			room.hide();
		} else
			room.show();
	});
}

RoomManager.prototype.logOut = function() {
	/*var $=this;
	forDict($.rooms, function(room, rid) {
		room.remove();
		delete $.rooms[rid];
	});*/
}

RoomManager.prototype.remove = function(id) {
	if (this.rooms[id]) {
		this.rooms[id].remove();
		delete this.rooms[id];
	}
	// todo: this gets called when a room is deleted, but doesn't remove sidebar link
	// need to handle that too
}

RoomManager.prototype.add = function(id, status) {
	var room = new ChatRoom();
	this.element.appendChild(room.element);
	this.rooms[id] = room;
	room.status = status;
	return room;
}

RoomManager.prototype.updateUser = function(user) {
	forDict(this.rooms, function(room, rid) {
		updateListAvatar(room.list, user);
	});
}

//todo:
// - should user pages, categories be cached too?
// - should pages be cached by default, or only when pinned by the user?
// - preload pinned pages when loading the site?
// - save cached pages between tabs with localstorage (when available)?
// - save pinned pages
// - AAA KEEP IT SIMPLE!
// - WE ARE NOT DOING CACHING!
// - the purpose of this system was to eliminate load times when switching
//   between CHAT ROOMS, not to cache CONTENT
// - the pages are not CACHED, they are actively loaded/updated

function fillEditorFields(page, users) {
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
	/*$permissions.value = JSON.stringify(page.permissions);*/
	fillPermissionFields($permissionBox, page.permissions, users);
	$editPageType.value = page.type;
	$editPageCategory.value = page.parentId;
	
	generatePagePath(page, me.userCache); //usercache is hack lol
}

function readEditorFields(page) {
	page.name = $titleInput.value;
	page.values.markupLang = $markupSelect.value;
	page.keywords = $keywords.value.split(" ");
	page.permissions = readPermissionFields($permissionBox);//JSON.parse($permissions.value);
	page.type = $editPageType.value;
	page.content = $editorTextarea.value;
	page.parentId = +$editPageCategory.value;
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
	$cateditLocalSupers.value = JSON.stringify(cat.localSupers);
	generatePath(makeCategoryPath(me.categoryTree, cat.id));
}

function readCateditFields(cat) {
	cat.name = $cateditTitle.value;
	cat.values.pinned = $cateditPinned.value;
	cat.parentId = +$cateditCategory.value;
	cat.permissions = parseJSON($cateditPermissions.value);
	cat.localSupers = parseJSON($cateditLocalSupers.value);
	cat.description = $cateditDescription.value;
}

var editingCategory;

function fillPermissionFields(element, perms, users) {
	element.innerHTML = "";
	if (!perms[0])
		perms[0] = "";
	forDict(perms, function(perm, id) {
		element.appendChild(renderPermissionLine(users[id], perm));
	});
}

function readPermissionFields(element) {
	var perms = {};
	element.querySelectorAll(".permissionRow").forEach(function(row) {
		var uid = +row.getAttribute("data-uid");
		var perm = "";
		row.querySelectorAll('input[data-crud]').forEach(function(elem) {
			if (elem.checked)
				perm += elem.getAttribute("data-crud");
		})
		perms[uid] = perm;
	});
	return perms;
}
