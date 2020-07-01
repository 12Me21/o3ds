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

	me.getVariable("userCSS", function(css) {
		if (css != null)
			setUserCSS(css);
	});
	
	me.getVariable("userJS", function(css) {
		if (css != null)
			setUserJS(css);
	});
	
	$loginForm.$login.onclick = function(e) {
		e.preventDefault();
		$loginError.textContent = "logging in...";
		me.logOut();
		me.logIn($loginForm.$username.value, $loginForm.$password.value, function(e, resp){
			if (!e) {
				$loginError.textContent = "";
			} else if (e == 'error' && resp) {
				var errors = ["Login failed:"];
				if (resp.errors) {
					for (var key in resp.errors) {
						errors.push(resp.errors[key].join(" "));
					}
				} else
					errors.push(resp);
				$loginError.textContent = errors.join("\n").replace(" or email", "");//sorry
			}
		});
	}
	$logout.onclick = function(e) {
		me.logOut();
		e.preventDefault();
	}

	$editorTextarea.oninput = function() {
		updateEditorPreview(true);
	}
	$markupSelect.onchange = function() {
		updateEditorPreview(true);
	}
	$markupUpdate.onclick = function() {
		updateEditorPreview(false);
	}

	$submitEdit.onclick = submitEdit;
	$cateditSubmit.onclick = cateditSubmit;
	$deletePage.onclick = deletePage;
	
	$chatSend.onclick = function() {
		if ($chatTextarea.value && currentChatRoom) {
			if (editingMessage) {
				sendMessage(currentChatRoom, $chatTextarea.value, {m:$chatMarkupSelect.value}, editingMessage)
				cancelEdit();
			} else {
				sendMessage(currentChatRoom, $chatTextarea.value, {m:$chatMarkupSelect.value});
			}
			$chatTextarea.value = "";
		}
	}

	$chatTextarea.onkeypress = function(e) {
		if (!e.shiftKey && e.keyCode == 13) {
			$chatSend.onclick();
			e.preventDefault();
		}
	};

	var voteBtns = [$voteButton_b, $voteButton_o, $voteButton_g];
	var voteCounts = [$voteCount_b, $voteCount_o, $voteCount_g];
	// todo: update counts when changing
	var voteBlock;
	voteBtns.forEach(function(button, buttoni) {
		button.onclick = function(e) {
			if (voteBlock || !me.auth)
				return;
			var selected = button.getAttribute('data-selected');
			var vote = !selected ? button.getAttribute('data-vote') : null;
			voteBlock = true;
			me.setVote(currentPage, vote, function(e, resp){
				voteBlock = false;
				if (!e) {
					voteBtns.forEach(function(btn, i) {
						if (btn != button || selected) {
							if (btn.getAttribute('data-selected') != null) {
								voteCounts[i].textContent = +voteCounts[i].textContent - 1;
							}
							btn.removeAttribute('data-selected');
						}
					});
					//todo: update vote counts here;
					if (!selected) {
						button.setAttribute('data-selected', "true");
						voteCounts[buttoni].textContent = +voteCounts[buttoni].textContent + 1;
						//increment
					}
				}
			});
		}
	})

	var blockWatch
	$watchCheck.onchange = function() {
		if (blockWatch)
			return;
		blockWatch = true;
		me.setWatch(currentPage, $watchCheck.checked, function(){
			blockWatch = false;
		});
	}
	
	$registerForm.$registerButton.onclick = function(e) {
		e.preventDefault();
		$registerError.textContent = " ";
		if ($registerForm.email.value != $registerForm.email2.value) {
			$registerError.textContent = "Emails don't match";
			return;
		}
		if ($registerForm.password.value != $registerForm.password2.value) {
			$registerError.textContent = "Passwords don't match";
			return;
		}
		var email = $registerForm.email.value;
		me.register($registerForm.username.value, $registerForm.password.value, email, function(e, resp) {
			if (e == 'error' && resp) {
				var errors = ["Registration failed:"];
				if (resp.errors) {
					for (var key in resp.errors) {
						errors.push(resp.errors[key].join(" "));
					}
				} else
					errors.push(resp);
				$registerError.textContent = errors.join("\n");
			} else if (!e) {
				sendConfirmationEmail();
			}
		});
	}
	function sendConfirmationEmail() {
		var email = $registerForm.email.value;
		if (!email) {
			$registerError.textContent = "No email";
		} else {
			$registerError.textContent = "Sending email...";
			me.sendEmail(email, function(e, resp){
				if (!e) {
					$registerError.textContent = "Confirmation email sent";
				} else {
					$registerError.textContent = "Error sending confirmation email:\n"+resp;
				}
			});
		}
	}
	$resendEmail.onclick = function(e) {
		e.preventDefault();
		sendConfirmationEmail();
	}
	$registerConfirm.onclick = function(e) {
		e.preventDefault();
		$registerError.textContent = "Confirming...";
		// todo: validate the key client-side maybe
		me.confirmRegister($emailCode.value, function(e, resp) {
			if (!e) {
				$registerError.textContent = "Registration Complete";
				window.location.hash = "#user/"+me.uid;
			} else {
				$registerError.textContent = "Failed to confirm registration:\n"+resp;
			}
		});
	}
	
	/*scroller = new AutoScroller($messageList, 1000);*/
	activityScroller = new AutoScroller($sidebarActivity, 500);
	manager = new RoomManager($messageList);

	hashChange(true);
	/*$reload.onclick = function(){
		hashChange();
	}*/

	$openSidebar.onclick = $closeSidebar.onclick = toggleSidebar;
	
	$setAvatarButton.onclick = function() {
		if (selectedFile && selectedFile.id) {
			me.setBasic({avatar: selectedFile.id}, function(e) {
				if (!e) {
					/*updateAvatar(selectedFile);*/
					/*lp.updateAvatar();*/
				}
			});
		}
	}

	$fileUploadButton.onclick = function() {
		if (selectedFile instanceof File || selectedFile instanceof Blob) {
			me.uploadFile(selectedFile, function(e, resp) {
				if (!e) {
					$fileBox.insertBefore(renderFileThumbnail(resp),$fileBox.firstChild);
					selectFile(resp);
				}
			});
		}
	}
	
	$fileUpload.onchange = function(e) {
		var file = this.files[0]
		if (file) {
			selectUploadedFile(file);
		}
	}

	attachPaste($filePaste, function(url) {
		selectFileURL(url);
	});


	$fileUpdateButton.onclick = function() {
		if (selectedFile && selectedFile.id) {
			readFileFields(selectedFile);
			me.putFile(selectedFile, function(e, resp) {
			});
		}
	}

	$submitUserSettings.onclick = submitUserSettings;

	$testButton.onclick = function() {
		var c = $testTextarea.value;
		$testOut.textContent="Starting..."
		try {
			var res = eval(c);
			$testOut.textContent="Finished:\n"+res;
		} catch(e) {
			$testOut.textContent="Error:\n"+res;
		}
	}

	$saveUserCSS.onclick = function() {
		var css = $settingsUserCSS.value;
		localStorage.userCSS = css;
		me.setVariable("userCSS", css, function(){});
		setUserCSS(css);
	}

	$saveUserJS.onclick = function() {
		var css = $settingsUserJS.value;
		localStorage.userJS = css;
		me.setVariable("userJS", css, function(){});
		setUserJS(css);
	}

	attachResize($sidebar, $sidebarPinnedResize, true, -1, function(w) {
		localStorage.sidebarWidth = w;
	});
	if (localStorage.sidebarWidth)
		$sidebar.style.width = localStorage.sidebarWidth+"px";

	attachResize($sidebarActivity, $sidebarPinnedResize, false, 1, function(w) {
		localStorage.sidebarPinnedHeight = w;
	});
	if (localStorage.sidebarPinnedHeight)
		$sidebarActivity.style.height = localStorage.sidebarPinnedHeight+"px";

	
/*	document.body.onclick = function(e) {
		console.log(e.target)
		}*/

	document.onclick = function(e) {
		var element = e.target;
		if (flags.editComment || flags.deleteComment) {
			while (element && element instanceof HTMLElement) {
				var id = element.getAttribute('data-id')
				if (id) {
					if (flags.editComment) {
						editComment(+id, element);
						break;
					} else {
						deleteComment(+id, element);
						break;
					}
				}
				element = element.parentNode;
			}
			flag('editComment');
			flag('deleteComment');
		}
	}
	$chatDelete.onclick = function() {
		cancelEdit();
		window.setTimeout(function() {
			flag('deleteComment', true);
			focusLastComment();
		}, 10);
	}
	$chatEdit.onclick = function() {
		cancelEdit();
		window.setTimeout(function() {
			flag('editComment', true);
			focusLastComment();
		}, 10);
	}
	$cancelEdit.onclick = function() {
		cancelEdit();
		$chatTextArea.focus();
	}
	document.addEventListener('keydown', function(e) {
		if (e.keyCode == 32 || e.keyCode == 13) {
			var active = document.activeElement;
			if (active && active.getAttribute('data-id')) {
				active.click();
				e.preventDefault();
			}
		}
		if (e.keyCode == 27) {
			cancelEdit();
			flag('editComment');
			flag('deleteComment');
		}
	});
	
	$sidebar.onclick = function(e) {
		if (e.target == $sidebarPinnedResize)
			return
		if (isFullscreenSidebar() && flags.mobileSidebar) {
			toggleSidebar();
		}
	}

	$permissionAddButton.onclick = function() {
		var uid = +$permissionUserInput.value;
		if (!uid || uid == editingPage.createUserId || $permissionBox.querySelector('tr[data-uid="'+uid+'"]')) {
			return;
		}
		me.getUser(uid, function(resp) {
			if (resp) {
				$permissionBox.appendChild(renderPermissionLine(resp, "cr"));
			}
		});
	}

	$globalStatusInput.value = localStorage.globalStatus || lp.statuses[0];
	$globalStatusButton.onclick = function() {
		var status = $globalStatusInput.value || undefined;
		lp.setGlobalStatus(status);
		localStorage.globalStatus = status || "";
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
			$chatTextarea.value = c[0];
			markupBefore = $chatMarkupSelect.value;
			$chatMarkupSelect.value = c[1] || "plaintext";
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

var editorCache = {video:{},audio:{},youtube:{}};
function updateEditorPreview(preview) {
	var parent = $editorPreview;
	var shouldScroll = parent.scrollHeight-parent.clientHeight-parent.scrollTop < 10
	renderPageContents({
		values: {
			markupLang: $markupSelect.value
		},
		content: $editorTextarea.value
	}, $editorPreview, editorCache);
	// auto scroll down when adding new lines to the end (presumably)
	if (shouldScroll) {
		parent.scrollTop = parent.scrollHeight-parent.clientHeight;
	}
}

var onUserPage;

// "generate" functions operate implicitly on specific html elements, and should be in view.js
// "render" functions often are similar but more general, and are in render.js
// I feel like the names are backwards, sorry...
function generateAuthorBox(page, users) {
	renderAuthorBox(page, users, $authorBox);
}

function decodeStatus(status) {
	var i = status.indexOf("\n");
	if (i>=0)
		return status.substr(i+1);
	return status;
}

function onLogin(me) {
	console.log("logged in");
	//var me = this;
	me.whenUser(me.uid, function(user) {
		userAvatar(user, $myAvatar);
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
				me.getPage(id, function(page, users) {
					manager.rooms[id].updatePage(page, users);
				});
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
		updateUserlist($sidebarUserlist, lists[0], users);
		if (onUserPage) {
			$userPageStatus.textContent = decodeStatus(lists[0][onUserPage]) || "";
		}
	}
	lp.onMessages = function(messages, users, pages) {
		messages.forEach(function(comment) {
			if (manager.rooms[comment.parentId]) {
				manager.rooms[comment.parentId].displayMessage(comment, users[comment.createUserId]);
			}
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

//todo: commentdelete
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

// maybe at bottom of sidebar (or top?)
// put list of active pages
//
// also still need to deal with
// old message deletion and old room clearing
// ugh
