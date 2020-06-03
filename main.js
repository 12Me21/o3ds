//bug: when going back from another site, page is loaded from cache, and
// certain things are not reloaded

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
		updateEditorPreview(true);
	}
	$markupSelect.onchange = function() {
		updateEditorPreview(true);
	}
	$markupUpdate.onclick = function() {
		updateEditorPreview(false);
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

	var voteBtns = [$voteButton_b, $voteButton_o, $voteButton_g];
	// todo: this breaks when clicking things INSIDE the button
	//wtf
	// todo: update counts when changing
	$voteBox.addEventListener('click', function(e){
		var btn = e.target;
		if (voteBtns.indexOf(btn) == -1)
			return;
		var selected = e.target.getAttribute('data-selected');
		voteBtns.forEach(function(btn) {
			btn.removeAttribute('data-selected');
		});
		if (selected)
			e.target.removeAttribute('data-selected');
		else
			e.target.setAttribute('data-selected', "true");
		var vote = !selected ? e.target.getAttribute('data-vote') : null;
		me.setVote(currentPage, vote, function(e){
		});
	},true);
	
	$watchCheck.onchange = function() {
		me.setWatch(currentPage, $watchCheck.checked, function(){});
	}
	
	$registerForm.$register.onclick = function(e) {
		e.preventDefault();
		$registerError.textContent = "";
		var email = $registerForm.email.value;
		me.register($registerForm.username.value, $registerForm.password.value, email, function(e, resp) {
			console.log(e, resp, resp.errors);
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

	$settingsAvatarUpload.onchange = function() {
		var reader = new FileReader();
		uploadedAvatar = new FormData();
		uploadedAvatar.append('file', this.files[0]);
	};

	//todo: when avatar changes, update internal cache and whatever
	// need to especially change the avatar in the corner of the screen
	// aaaaaaa eventssss
	$settingsAvatarSubmit.onclick = function() {
		if (uploadedAvatar) {
			me.uploadFile(uploadedAvatar, function(e, resp) {
				if (!e) {
					me.setBasic({avatar:resp.id},console.log);
				}
			});
			uploadedAvatar = null;
		}
	}
	
	scroller = new AutoScroller($messageList);

	hashChange(true);
	//console.log = debugMessage;
	$reload.onclick = function(){
		hashChange();
	}
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

function split1(string, sep) {
	var n = string.indexOf(sep);
	if (n == -1)
		return [string, null];
	else
		return [string.substr(0,n), string.substr(n+sep.length)];
}

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

function navigateTo(path, first, callback) {
	lp.reset();
	path = split1(path, "?");
	var query = path[1];
	var queryVars = {};
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
			generateEditorView(id, queryVars, callback);
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
	} else if (type == 'register') {
		first && ($main.className = 'registerMode');
		generateRegisterView(null, callback);
	} else if (type == 'usersettings') {
		first && ($main.className = 'settingsMode');
		generateSettingsView(null, callback);
	} else if (type == 'activity') {
		first && ($main.className = 'activityMode');
		generateActivityView(null, callback);
	} else {
		$main.className = "errorMode";
		generateAuthorBox();
		$pageTitle.textContent = "[404] I DON'T KNOW WHAT A \""+type+"\" IS";
		renderPath($navPane);
		$pageContents.textContent = "";
		callback();
	}
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
	/*if (window.$titlePane)
		window.$titlePane.style.backgroundColor = "#48F";*/
}
function loadEnd(lp, e) {
	if (!lp) {
		flag('loading');
	}
	/*$titlePane.style.backgroundColor = "";*/
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

function replaceTree(root, tree) {
	var c1 = root.childNodes;
	var c2 = tree.childNodes;
	var cc2=[],cc1=[];
	for (var i=0;i<c2.length;i++)
		cc2[i]=c2[i];
	for (var i=0;i<c1.length;i++)
		cc1[i]=c1[i];
	for (var i=0;i<cc1.length;i++) {
		if (!cc1[i].isEqualNode(cc2[i])) {
			if (cc2[i])
				if (shallowCompare(cc2[i], cc1[i]))
					replaceTree(cc1[i], cc2[i]);
				else
					root.replaceChild(cc2[i], cc1[i]);
			else
				root.removeChild(cc1[i]);
		}
	}
	for (;i<cc2.length;i++) 
		root.appendChild(cc2[i]);
}

function shallowCompare(node1, node2) {
	return node1.cloneNode(false).isEqualNode(node2.cloneNode(false));
}

function updateEditorPreview(preview) {
	replaceTree($editorPreview, renderPageContents({
		values: {
			markupLang: $markupSelect.value
		},
		content: $editorTextarea.value
	}, undefined, true));
}

// "generate" functions operate implicitly on specific html elements, and should be in view.js
// "render" functions often are similar but more general, and are in render.js
// I feel like the names are backwards, sorry...
function generateAuthorBox(page, users) {
	renderAuthorBox(page, users, $authorBox);
}

function updateUserlist(listeners, userMap) {
	$chatUserlist.innerHTML = "";
	listeners && listeners.forEach(function(l) {
		$chatUserlist.appendChild(renderUserListAvatar(userMap[l]));
	})
}

function onLogin(me) {
	me.whenUser(me.uid, function(user) {
		userAvatar(user, $myAvatar);
		$myName.textContent = user.username;
		$myUserLink.href = "#user/"+user.id;
	});
	flag("loggedIn",true);
}

function onLogout() {
	$myAvatar.src = "";
	$myName.textContent = "";
	flag("loggedIn");
}
