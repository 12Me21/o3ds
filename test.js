var me = new Myself(true);
var messagePaneAutoScroller;
var display;

window.onload = function() {
	//alert("ok");
	console.log("v2");
	me.logIn(undefined, undefined, console.log);

	$changeroom.onclick = function() {
		room($room.value);
	}
	
	var lp;
	function room(id) {
		console.log("switching rooms?");
		if (lp)
			lp.stop();
		console.log("ID "+id);
		lp = new LongPoller(me, id, function(ms) {
			for (var i=0;i<ms.length;i++){
				display(ms[i])
			}
		});
		lp.start(30);
	}
	
	messagePaneAutoScroller = new AutoScroller($output);
	
	display = function(c) {
		console.log(c);
		if (c.deleted) {
			messagePaneAutoScroller.remove(c.id);
		} else {
			var node = renderMessagePart(c);
			messagePaneAutoScroller.insert(c.id, node, c.createUserId, function(){
				var b = renderUserBlock(null, c.createUserId);
				me.getUserCached(c.createUserId, function(s, user) {
					if (s=="ok")
						updateUserBlock(b[0], user);
				});
				return b;
			});
			
		}
	}
	$send.onclick = function() {
		if ($input.value) {
			me.postComment({
				parentId: lp.id,
				content: JSON.stringify({
					t: $input.value,
					m: 'plaintext'
				})
			}, function(s, resp) {
				//		if (s=="ok")
				
			});
			$input.value = "";
		}
		
	}

$input.onkeypress = function(e) {
	if (!e.shiftKey && e.keyCode == 13) {
		e.preventDefault();
		$send.onclick();
		return;
	}
}



$login.onclick = function() {
	me.logIn($username.value, $password.value, function(s, resp) {
		if (s=='ok') {
			$logged_out.style.display = "none";
		}
	});
}
}
