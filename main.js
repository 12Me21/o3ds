var me = new Myself(true);
var messagePaneAutoScroller;
var display;
var lp;
var lp2;
var debugMessage;

window.onload = function() {
	//alert("ok");
	console.log("v2");

	me.on('login', function(checked) {
		if (checked) {
			$myName.textContent = this.me.username;
			$myAvatar.src = this.me.avatarURL;
		} else {
			$myName.textContent = "...";
		}
		$loginPane.className = "loginPane logged_in";
		
		if (checked) {
			/*
			try {
				$nav.innerHTML = "";
				$navcss.innerHTML = "";
				function makeSelector(path, id) {
					$navcss.innerHTML += '.nav:not([data-path*=",'+id+',"]) > select[data-id="'+id+'"] {display: none;}';
				}
				
				me.getCategories(function(root, all){
					var selectors = all.map(function(cat) {
						return renderCategorySelector(cat, makeSelector);
					});
					var sel = renderCategorySelector(root, function(){});
					$nav.appendChild(sel);
					selectors.forEach(function(sel) {
						$nav.appendChild(sel);
					});
				});
			} catch(e) {
				alert("CAT: "+e);
			}*/
		}
	});
	
	me.on('logout', function() {
		$loginPane.className = "loginPane";
		if (lp)
			lp.stop();
		if (lp2)
			lp2.stop();
	});

	
	me.logIn(undefined, undefined, function(){});
	
	$changeroom.onclick = function() {
		room($room.value);
	}
	
	messagePaneAutoScroller = new AutoScroller($messageList);

	debugMessage = function(text) {
		messagePaneAutoScroller.embed(renderSystemMessage(String(text)));
	}
		
	function room(id) {
		load_page(id);
		console.log("Switching to room id:"+id);
		
		if (lp)
			lp.stop();
		if (lp2)
			lp2.stop();

		messagePaneAutoScroller.switchRoom(id);
		lp = new CommentLongPoller(me, id, 30, function(first, ms) {
			var users = ms.map(function(comment) {
				return comment.createUserId;
			})
			me.preloadUsers(users);
			for (var i=0;i<ms.length;i++){
				display(ms[i]);
			}
		});
		lp.start();
		
		lp2 = new ListLongPoller(me, id, function(first, users) {
			me.preloadUsers(users);
			$userList.innerHTML = "";
			users.forEach(function(id) {
				//oops this won't preserve order
				//change to separate create+update like messages
				me.whenUser(id, function(s, user) {
					if (s=="ok")
						$userList.appendChild(renderUserListAvatar(user));
				});
			});
		});
		lp2.start();
	}
	
	display = function(c) {
		//console.log(c);
		if (c.deleted) {
			messagePaneAutoScroller.remove(c.id);
		} else {
			var node = renderMessagePart(c);
			messagePaneAutoScroller.insert(c.id, node, c.createUserId, function(){
				var user = me.userCache[c.createUserId];
				var b = renderUserBlock(user, c.createUserId, new Date(c.createDate));
				if (c.createUserId == me.uid)
					b[0].className += " ownMessage";
				// if user was not in the cache, update the message block
				// later
				if (!user) {
					me.whenUser(c.createUserId, function(s, user) {
						if (s=="ok")
							updateUserBlock(b[0], user);
					});
				}
				return b;
			});
			
		}
	}
	
	$send.onclick = function() {
		var text = $input.value;
		if (text) {
			var m = onSubmitMessage(text);
			if (typeof m != 'undefined') {
				if (m == true) {
					var content = {t: text, m: 'plaintext'};
				} else {
					content = m;
				}
				if (lp && lp.running) {
					me.postComment({
						parentId: lp.id,
						content: JSON.stringify(content)
					}, function(s, resp) {
						//		if (s=="ok")
					});
					$input.value = "";
				}
			} else {
				$input.value = "";
			}
		}
	};
	
	$input.onkeypress = function(e) {
		if (!e.shiftKey && e.keyCode == 13) {
			e.preventDefault();
			$send.onclick();
			return;
		}
	};

	$form.$login.onclick = function() {
		event.preventDefault();
		me.logOut();
		me.logIn($form.$username.value, $form.$password.value, function(s, resp) {});
	};
	
	$logout.onclick = function() {
		me.logOut();
	};
}

function load_page(id) {
	//mode_page($stack);
	me.getPage(id, function(page, users, comments) {
		$pageTitle.textContent = page.name;
		$contents.innerHTML = "";
		$contents.appendChild(parse(page.content));
	});
}

var lp2;
function startListenerListener(id) {
	
}

function reset_page() {
	
}

function mode_category(stack) {
	stack.className = "stack mode-category";
}

function mode_chat(stack) {
	stack.className = "stack mode-chat";
}

function mode_page(stack) {
	stack.className = "stack mode-page";
}

function mode_editor(stack) {
	stack.className = "stack mode-editor";
}
