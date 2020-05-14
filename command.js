var chatCommands = {
	eval: function(code) {
		debugMessage("Running: "+code);
		try {
			var x = eval(code);
			debugMessage(x);
		} catch (e) {
			debugMessage("/eval error: "+e);
		}
	},
	m: function(text) {
		return {
			t: text,
			m: '12y'
		};
	}
};

function onSubmitMessage(text) {
	if (text[0] == "/") {
		var sp = text.indexOf(" ");
		if (sp < 0)
			sp = text.length;

		var command = text.substring(1, sp);
		console.log(command, chatCommands[command]);
		if (chatCommands[command]) {
			return chatCommands[command](text.substr(sp+1));
		} else {
			return undefined;
		}
	} else {
		return true;
	}
}
