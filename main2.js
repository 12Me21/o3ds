// to load a page:
// - request info for a page (page, comments, associated users)
// -- start long poller for comments
// --- keep getting user objects for new users that post comments*
// - request listeners list
// -- get user objects for users in listeners list*
// -- start long poller for listeners list
// --- keep getting user objects for new users in listeners list*

//* (problem: these must (well, SHOULD) be cached and so avatars won't update dynamically)

// the difference between pages and chat is that comments are rendered differently, etc.

// for chat:
// [ header bar ]
// [ nav bar ]
// [ user list ]
// [ scroller
//  [ page contents ]
//  [ "load older messages" button]
//  [ chat messages ]
// ]
// [ textarea ]

// (maybe have some buttons for jumping to the top/bottom of the scroller, for mobile)

// for pages:
// [ header bar ]
// [ nav bar ]
// [ user list ]
// [ scroller
//  [ page contents ]
//  [ textarea ]
//  [ comments (reverse order) ]
//  [ "load older comments" button]
// ]

// for the editor:
// [ header bar ]
// [ nav bar ]
// [ page info fields (title etc.) ]
// [ textarea ]
// [ preview ]

// for comments
// I don't want to auto-load older messages because this is awkward
// there should also be a way to jump to a certain date,
// perhaps have a "historic" section of chat, where
// old comments are loaded,
// as in
// ["load older comments"]
// [historic comments]
// ["load newer older comments"]
// [modern comments (deleted after some limit is reached)]
// ugh idk
// 

var me = new Myself(true);
me.logIn(undefined, undefined, function(){});

window.onload = function() {
	if (me.auth) {
		me.whenUser(me.id, function() {
			onLogin(me);
		});
	}
	me.on('login', function() {
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
	/*$fileinput.onchange = function() {
		var file = this.files[0];
		if (file) {
			me.request("File", "POST", console.log, this.files[0]);
		}
	}*/
}

function onLogin(me) {
	$myAvatar.src = me.me.avatarURL;
	$myName.textContent = me.me.username;
	$loggedOut.style.display = 'none';
	$loggedIn.style.display = '';
}

function onLogout() {
	$myAvatar.src = "";
	$myName.textContent = "";
	$loggedIn.style.display = 'none';
	$loggedOut.style.display = "";
}
