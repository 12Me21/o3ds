// this file contains code for rendering stuff direclty to the screen
// none of it is "reusable" etc.

// clean up stuff whenever switching pages
function cleanUp(type) {
	flag('myUserPage');
	flag('canEdit');
	flag('page');
	$messageList.innerHTML = "";
	$authorBox.innerHTML = "";
	$sbapiInfo.innerHTML = "";
	$fileBox.innerHTML = "";
	$fileView.src = "";
	var nodes = document.querySelectorAll(".markup-root");
	for (var i=0;i<nodes.length;i++) {
		nodes[i].innerHTML = "";
	}
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

function sendMessage(room, text, params) {
	me.postComment(room, text, params || {}, function(e, resp) {
		if (e=="rate") {
			debugMessage("You are sending messages too fast");
		} else if (e) {
			debugMessage("Failed to send message");
		}
	});
}

function megaAggregate(activity, ca, contents) {
	var contentMap = {};
	contents.forEach(function(x){
		contentMap[x.id] = x;
	})
	var allAct = activity.concat(ca.map(function(x){
		if (x.createDate) {
			return {
				action: "p",
				contentId: x.parentId,
				date: x.createDate,
				id: x.id,
				userId: x.createUserId,
				type: 'content',
				comment: x.content
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
		else if (x.type == "category" && me.categoryTree)
			x.content = me.categoryTree.map[x.contentId];
		else
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
	// also we can optimize merging of 2 sorted arrays here!
	return allAct;
}

function generatePath(path) {
	renderPath($navPane, path);
}
// function generatePagePath - category tree paths

function updateUserlist(listeners, userMap) {
	$chatUserlist.innerHTML = "";
	listeners && forDict(listeners, function(status, user) {
		if (status)
			$chatUserlist.appendChild(renderUserListAvatar(userMap[user]));
	})
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
		var text = decodeComment(c.content);
		document.title = text[0];
		changeFavicon(user.avatarURL);
	}
}

var currentFavicon = null;
function changeFavicon(src) {
	if (src == currentFavicon) {
		return;
	}
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

function displayGap() {
	scroller.insert(null, renderMessageGap());
}

function handlePinned(pinned) {
	$categoryPinned.innerHTML = "";
	pinned.forEach(function(content) {
		$categoryPinned.appendChild(renderCategoryPage(content, users2, true));
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
		console.log("SELECLED");
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
	register: {
		render: function(id, query, callback) {
			$main.className = "registerMode";
			setTitle("Create an account");
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
			lp.onListeners = function(lists, users) {
				updateUserlist(lists[id], users)
			}
			lp.onMessages = function(messages, users, pages) {
				messages.forEach(function(comment) {
					var user = users[comment.createUserId];
					if (comment.parentId == id)
						displayMessage(comment, user);
				})
			}
			lp.onDelete = function(comments) {
				comments.forEach(function(comment) {
					displayMessage({deleted: true, id:comment.id});
				});
			}
			lp.setViewing(id);
			var linked = query["#"];
			if (linked && /^comment-/.test(linked)) {
				linked=+linked.substr(8);
			} else {
				linked = null;
			}
			return me.getPage(id, function(page, users, comments){
				callback(page, users, comments, query);
			});
		},
		render: function(page, users, comments, query) {
			$main.className = "pageMode";
			generateAuthorBox(page, users);
			flag('canEdit', !!page);
			if (page) {
				flag('page', true);
				scroller.switchRoom(page.id);
				generatePagePath(page, users);
				currentPage = page.id;
				currentChatRoom = page.id;
				var icon = "page";
				if (!hasPerm(page.permissions, 0, 'r'))
					icon = "hiddenpage"
				setTitle(page.name, icon);
				$watchCheck.checked = page.about.watching;
				// todo: handle showing/hiding the vote box when logged in/out
				renderPageContents(page, $pageContents)
				handleLoads($pageContents);
				displayGap();
				comments && comments.reverse().forEach(function(comment) {
					if (comment.parentId == page.id)
						displayMessage(comment, users[comment.createUserId]);
				});
				$editButton.href = "#pages/edit/"+page.id;
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
			setTitle("Welcome to smilebnasic source! 2");
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
			fillEditorFields(editingPage);
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

