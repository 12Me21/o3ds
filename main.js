//bug: when going back from another site, page is loaded from cache, and
// certain things are not reloaded

// idea: 'protected' mode, during page editing
// gives warning before navigation
// or: just save editing page contents lol

var me = new Myself(true);
me.loadCachedAuth(function(){});
var scroller;
var activityScroller;
var lp = new LongPoller(me, null);
var currentPage;
var manager;
flag('sidebar', localStorage.getItem('sbs-sidebar') != 'false');

debugMessage = function(text) {
	scroller.embed(renderSystemMessage(String(text)));
}

if (document.readyState == 'loading')
	document.addEventListener('DOMContentLoaded', ready);
else {
	ready();
}

function setUserCSS(text) {
	$userCSS.textContent = text;
}
function setUserJS(text) {
	try {
		eval(text);
	} catch(e) {
		alert("error in userJS "+e+"\n"+e.stack);
	}
}

function ready() {
	var userCSS = localStorage.userCSS;
	if (userCSS) {
		setUserCSS(userCSS);
	}
	if (me.openRequests) {
		loadStart();
	}
	me.onLoadStart = loadStart;
	me.onLoadEnd = loadEnd;
	console.info("ready");
	if (me.auth)
		onLogin(me);
	else
		onLogout();

	me.onLogin = onLogin;
	me.onLogout = onLogout;

	me.getVariable("wwww",function(){});
	me.getVariables(["userCSS", "userJS"], function(vars) {
		if (vars.userCSS != null)
			setUserCSS(vars.userCSS);
		if (vars.userJS != null)
			setUserJS(vars.userJS);
	});
	
	addEvents();
	readyFuncs.forEach(function(func){
		func();
	});
	
	activityScroller = new AutoScroller($sidebarActivity, 500);
	manager = new RoomManager($messageList, lp);

	hashChange(true);
	
	var s = optionalStorage.get('globalStatus');
	$globalStatusInput.value = s==undefined ? "online" : s;
	lp.setGlobalStatus($globalStatusInput.value || undefined);

	var s = optionalStorage.get('defaultStatus');
	if (s == undefined) {
		$defaultStatus.value = "active";
	} else {
		$defaultStatus.value = s;
	}
}

function focusLastComment() {
	var parts = $messageList.querySelectorAll(".messagePart");
	if (parts) {
		parts[parts.length-1].focus();
	}
}

// enter edit mode
function editComment(id, element) {
	me.getComment(id, function(comment) {
		if (comment) {
			var c = decodeComment(comment.content);
			$chatTextarea.value = c.t;
			markupBefore = $chatMarkupSelect.value;
			$chatMarkupSelect.value = c.m || "plaintext";
			editingMessage = id;
			flag('editingComment', true);
			editingElement = element;
			element.setAttribute('editing', "");
			$chatTextarea.focus();
		}
	});
}

function cancelEdit() {
	if (editingMessage) {
		editingMessage = null;
		if (editingElement) {
			editingElement.removeAttribute('editing');
			editingElement = null;
		}
		if (markupBefore)
			$chatMarkupSelect.value = markupBefore;
		markupBefore = null;
		flag('editingComment');
		$chatTextarea.focus();
	}
}

var editingMessage, editingElement, markupBefore;

function isFullscreenSidebar() {
	return !window.matchMedia || window.matchMedia("(max-width: 700px)").matches;
}

function deleteComment(id, element) {
	var resp = confirm("Are you sure you want to delete this message?\n"+element.textContent);
	if (resp) {
		me.deleteComment(id, console.log);
		$chatTextarea.focus();
	}
}

function toggleSidebar() {
	var fullscreen = isFullscreenSidebar()
	relocateSidebar(fullscreen);
	if (fullscreen) {
		flag('mobileSidebar', !flags.mobileSidebar);
	} else {
		flag('sidebar', !flags.sidebar);
		localStorage.setItem('sbs-sidebar', !!flags.sidebar);
	}
}

function relocateSidebar(fullscreen) {
	if (fullscreen) {
		document.body.insertBefore($sidebar, document.body.firstChild);
	} else {
		$sidebarContainer.appendChild($sidebar);
	}
}

var currentPath = null;

function silentSetFragment(fragment) {
	cancelhashchange = true;
	location.hash = fragment;
	cancelhashchange = false;
}

// todo: add a "force" flag
function hashChange(first) {
	if (isFullscreenSidebar() && flags.mobileSidebar) {
		toggleSidebar();
	}
	var fragment = getPath();
	// append # to the end of fragment links,
	// and it will be removed, so every time you clikc the link it will scroll
	if (fragment[2] == "") {
		silentSetFragment(location.hash.slice(0,-1));
	}
	if (currentPath == fragment[0]) {
		scrollTo(fragment[1])
	} else {
		currentPath = fragment[0];
		navigateTo(fragment[0], first, function() {
			scrollTo(fragment[1])
		}, fragment[1]);
	}
}

function scrollToAuto() {
	var fragment = getPath();
	if (fragment[1])
		scrollTo(fragment[1]);
}

function scrollTo(name) {
	//todo: this needs to happen after all images load etc. somehow...
	if (name) {
		var n = document.getElementsByName("_anchor_"+name)[0] || document.getElementById("_anchor_"+name);
		if (n)
			n.scrollIntoView();
	}
}

var cancelhashchange
window.onhashchange = function() {
	if (cancelhashchange) {
		cancelhashchange = false;
		return;
	}
	
	// todo: when a link which has the same path but a different fragment is clicked,
	// page should not reload, instead just scroll to fragment
	hashChange(false);
}

function getPath() {
	var hash = decodeURIComponent(location.hash.substr(1));
	return hash.split("#");
}

var cancel;
function navigateTo(path, first, callback, hash) {
	if (cancel)
		cancel();
	path = split1(path, "?");
	var query = path[1];
	var queryVars = {"#":hash};
	if (query) {
		query.split("&").forEach(function(item) {
			item = split1(item, "=");
			if (item[1] == null) {
				queryVars[item[0]] = true;
			} else {
				queryVars[item[0]] = item[1];
			}
		});
	}
	path = path[0].split("/").filter(function(x){return x;});

	var type = path[0] || "";
	var id = +(path[1]) || 0;
	var name;	
	if (path[1] == 'edit') {
		id = path[2]!=undefined && +path[2];
		type = type + "/" + path[1];
	}
	cancel = doView(type, id, queryVars, callback);
}

function doPage(mode, func, id, query, callback, first) {
	func(id, query, callback);
}

function makeCategoryPath(tree, id, leaf) {
	var node = tree.map[id];
	var path = [];
	while (node) {
		path.unshift(["#categories/"+node.id, node.name])
		node = node.parent;
	}
	if (leaf) {
		path.push(["#pages/"+leaf.id, leaf.name]);
	} else {
		path.push(null);
	}
	return path;
}

// These are used to signal to the user when content is loading
var loadCount=0;
function loadStart(lp) {
	if (!lp)
		flag('loading', true);
}
function loadEnd(lp, e) {
	if (!lp)
		flag('loading'); //fix this when multiple requests
}

//maybe turn the title <h1> into an input box
//so you can just edit the page title there
function submitEdit() {
	readEditorFields(editingPage);
	me.postPage(editingPage, function(e, resp) {
		if (e) {
			alert("ERROR");
		} else {
			window.location.hash = "#pages/"+resp.id;
			cleanUpEditor();
		}
	});
}

function cateditSubmit() {
	readCateditFields(editingCategory);
	me.postCategory(editingCategory, function(e, resp) {
		if (e) {
			alert("ERROR");
		} else {
			window.location.hash = "#categories/"+resp.id;
		}
	});
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
					window.location.hash = "#categories/"+editingPage.parentId;
				}
			});
		}
	}
}

function updateEditorPreview(preview) {
	var parent = $editorPreview;
	var shouldScroll = parent.scrollHeight-parent.clientHeight-parent.scrollTop < 10
	setChild($editorPreview, Parse.parseLang($editorTextarea.value, $markupSelect.value));
	// auto scroll down when adding new lines to the end (presumably)
	if (shouldScroll) {
		parent.scrollTop = parent.scrollHeight-parent.clientHeight;
	}
}

var onUserPage;

function decodeStatus(status) {
	if (!status)
		return status;
	var i = status.indexOf("\n");
	if (i>=0)
		return status.substr(i+1);
	return status;
}

function onLogin(me) {
	console.log("logged in");
	//var me = this;
	me.whenUser(me.uid, function(user) {
		$myAvatar.src = user.avatarURL;
		$myName.textContent = user.username;
		$myUserLink.href = "#user/"+user.id;
	});
	flag("loggedIn",true);
	/*hashChange(false);*/
	lp.onActivity = function(activity, users, pages, chains) {
		//check for updated users
		activity.forEach(function(act) {
			var id = act.contentId;
			if (act.type=="user") {
				userUpdated(users[act.contentId]);
			}
			if (act.type=="content" && manager.rooms[id]) {
				if (act.action=="d") {
					manager.remove(id);
				} else {
					me.getPage(id, function(page, users) {
						manager.rooms[id].updatePage(page, users);
					});
				}
			}
		});
	}
	lp.onBoth = function(resp) {
		sbm(resp.chains);
	}
	lp.onStatus = function(text) {
		$longPollStatus.textContent = text;
	}
	lp.onListeners = function(lists, users) {
		forDict(lists, function(list, id) {
			if (manager.rooms[id]) {
				manager.rooms[id].updateUserlist(list, users);
			}
		});
		var global = lp.getGlobalStatuses();
		updateUserlist($sidebarUserlist, global, users);
		if (onUserPage) {
			$userPageStatus.textContent = decodeStatus(global[onUserPage]) || ""; //um why is this .. error     hhhh
		}
	}
	lp.onMessages = function(messages, users, pages) {
		messages.forEach(function(comment) {
			manager.displayMessage(comment, users);
		})
	}
	lp.onDelete = function(comments) {
		comments.forEach(function(comment) {
			if (manager.rooms[comment.parentId]) {
				manager.rooms.displayMessage({deleted: true, id:comment.id});
			}
		})
	}
	if (localStorage.globalStatus != null)
		lp.statuses[0] = localStorage.globalStatus;
	me.doListenInitial(function(e, resp){
		if (!e) {
			resp.systemaggregate.forEach(function(item) {
				if (item.type == "actionMax")
					lp.lastId = item.id;
			});
			lp.start();
			sbm(resp, true);
			//todo:
			// keep an updated list of recently active pages
			//
		}
	})
	me.getNotifications(function(e, resp){
		if (!e) {
			resp.activityaggregate.forEach(function(aa) {
				var page = {id: aa.id};
				for (i=0; i<resp.content.length; i++) {
					if (resp.content[i].id == aa.id) {
						page = resp.content[i];
						break;
					}
				}
				/*pushActivity(renderNotifItem(aa, page, resp.userMap), true);*/
			});
		}
	});
}

function updateListAvatar(list, user) {
	var e = list.querySelector('[data-uid="'+user.id+'"]');
	if (e)
		list.replaceChild(renderUserListAvatar(user), e);
}

function userUpdated(user) {
	updateListAvatar($sidebarUserlist, user);
	manager.updateUser(user);
	if (user.id == me.uid) {
		$myAvatar.src = user.avatarURL;
	}
}

// display activity data in sidebar
function sbm(resp, scroll) {
	if (!(resp.comment && resp.content && resp.activity))
		return;
	var users = resp.userMap;
	var last = {};
	var all = megaAggregate(resp.activity, resp.comment, resp.content, users, resp.category);
	all.reverse().forEach(function(activity){
		displayActivity(activity, users, scroll);
	});
	if (scroll)
		activityScroller.autoScroll(true);
}

function displayActivity(activity, users, scroll) {
	if (activity.userId instanceof Array)
		var user = activity.userId.map(function(x){
			return users[x];
		})
	else if (activity.userId)
		user = users[activity.userId];
	else
		user = null;

	var line = renderActivityLine(activity, users);
	activityScroller.insert(activity.id, line, activity.contentId, function() {
		return renderActivityBlock(activity);
	});
}

function onLogout() {
	lp.stop();
	if (manager)
		manager.logOut();
	$myAvatar.src = "";
	$myName.textContent = "";
	flag("loggedIn");
}

// also still need to deal with
// old message deletion and old room clearing
// ugh
