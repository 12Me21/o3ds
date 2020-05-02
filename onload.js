window.myself = new Myself();

function showPost() {
	myself.request("Content?ids="+$id.value,"GET",function(resp, code){
		if (code!=200) {
		} else {
			if (resp[0]) {
				console.log(resp);
				$textarea.value = resp[0].content;
			}
		}
	});
}

function run() {
	try {
		eval($textarea.value);
	} catch(e) {
		alert(e);
	}
}

function page() {
	var s = $textarea.value;
	document.open();
	document.write(s);
	document.close();
}
