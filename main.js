//bug: when going back from another site, page is loaded from cache, and
// certain things are not reloaded

// idea: 'protected' mode, during page editing
// gives warning before navigation
// or: just save editing page contents lol

var me = new Myself(true);
me.loadCachedAuth(function(){});
var scroller;
var lp = new LongPoller(me, null);
var currentPage;
flag('sidebar', localStorage.getItem('sbs-sidebar') == 'true');

debugMessage = function(text) {
	scroller.embed(renderSystemMessage(String(text)));
}

if (document.readyState == 'loading')
	document.addEventListener('DOMContentLoaded', ready);
else {
	ready();
}

function ready() {
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
			me.postComment(currentChatRoom, $chatTextarea.value, "", function(){});
			$chatTextarea.value = "";
		}
	}

	$chatTextarea.onkeypress = function(e) {
		if (!e.shiftKey && e.keyCode == 13) {
			e.preventDefault();
			$chatSend.onclick();
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
	
	$registerForm.$register.onclick = function(e) {
		e.preventDefault();
		$registerError.textContent = "";
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
				$registerError.textContent = "Sending email...";
				me.sendEmail(email, function(e, resp){
					if (!e) {
						$registerError.textContent = "Confirmation email sent";
					} else {
						$registerError.textContent = "Error sending confirmation email";
					}
				});
			}
		});
	}
	$resendEmail.onclick = function(e) {
		me.sendEmail($registerForm.email.value, function(e, resp){
			if (!e) {
				$registerError.textContent = "Confirmation email sent";
			} else {
				$registerError.textContent = "Error sending confirmation email";
			}
		});
	}
	$registerConfirm.onclick = function() {
		// todo: validate the key client-side maybe
		me.confirmRegister($emailCode.value, function(e, resp) {
			if (!e) {
				$registerError.textContent = "Registration Complete";
				window.location.hash = "#user/"+me.uid;
			} else {
				$registerError.textContent = "Failed to confirm registration";
			}
		});
	}
	
	scroller = new AutoScroller($messageList);

	hashChange(true);
	/*$reload.onclick = function(){
		hashChange();
	}*/

	$openSidebar.onclick = $closeSidebar.onclick = toggleSidebar;
	
	$setAvatarButton.onclick = function() {
		if (selectedFile && selectedFile.id) {
			me.setBasic({avatar: selectedFile.id}, function(e) {
				if (!e) {
					updateAvatar(selectedFile);
				}
			});
		}
	}

	$fileUploadButton.onclick = function() {
		if (selectedFile instanceof File) {
			me.uploadFile(selectedFile, function(e, resp) {
				if (!e) {
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

/*	document.body.onclick = function(e) {
		console.log(e.target)
	}*/
}

function updateAvatar(id) {
	//todo;
}

function toggleSidebar() {
	if (!window.matchMedia || window.matchMedia("(max-width: 700px)").matches) {
		flag('mobileSidebar', !flags.mobileSidebar);
	} else {
		flag('sidebar', !flags.sidebar);
		localStorage.setItem('sbs-sidebar', flags.sidebar);
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
		slientSetFragment(location.hash.slice(0,-1));
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
	console.log("doing scrollTo", name);
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

function split1(string, sep) {
	var n = string.indexOf(sep);
	if (n == -1)
		return [string, null];
	else
		return [string.substr(0,n), string.substr(n+sep.length)];
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
function loadStart(lp) {
	if (!lp)
		flag('loading', true);
}
function loadEnd(lp, e) {
	if (!lp) {
		flag('loading');
	}
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
	console.log("should?",shouldScroll);
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

// "generate" functions operate implicitly on specific html elements, and should be in view.js
// "render" functions often are similar but more general, and are in render.js
// I feel like the names are backwards, sorry...
function generateAuthorBox(page, users) {
	renderAuthorBox(page, users, $authorBox);
}

function onLogin(me) {
	//var me = this;
	me.whenUser(me.uid, function(user) {
		userAvatar(user, $myAvatar);
		$myName.textContent = user.username;
		$myUserLink.href = "#user/"+user.id;
	});
	flag("loggedIn",true);
	/*hashChange(false);*/
	lp.onMessages = function(messages, users, pages) {
		messages.forEach(function(comment) {
			var user = users[comment.createUserId];
			addSidebarItem(pages[comment.parentId],user,comment.content.split("\n").slice(1));
		})
	}
	lp.onActivity = function(activity, users, pages) {
		activity.forEach(function(activity) {
			var user = users[activity.userId];
			if (activity.type == "content") {
				var page = pages[activity.contentId]
				var action = {
					u: "edited",
					c: "created",
					d: "deleted"
				}[activity.action];
				if (!page) {
					page = {
						name: activity.extra,
						id: activity.contentId
					}
				}
				addSidebarItem(page,user,action);
			}
		});
	}
	lp.start();
}

function onLogout() {
	lp.cancel[0]();
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
