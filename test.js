var me = new Myself();
me.logIn(undefined, undefined, console.log);

var lp;
function room(id) {
	if (lp)
		lp.stop();
	console.log("ID",id);
	lp = new LongPoller(me, id, function(ms) {
		for (i=0;i<ms.length;i++){
			display(ms[i].content)
		}
	});
	lp.start();
}

function display(c) {
	var d;
	try {
		d = JSON.parse(c)
	} catch(e) {
		d = c;
	}
	console.log(d.t);
}
