function bbcodeParse(code, options) {
	options = options || bbcodeParse.options;
	var output = options.root();
	var curr = output;
	var allowedTags = {
		b:true,i:true,u:true,s:true,sup:true,sub:true,h1:true,h2:true,h3:true,align:true,anchor:true,img:true,list:true,code:true,spoiler:true,youtube:true,quote:true,table:true,tr:true,th:true,td:true,url:true
	};
	var displayBlock = {
		h1:true,h2:true,h3:true,align:true,list:true,spoiler:true,youtube:true,quote:true,table:true,tr:true,img:true
	};

	var skipNextLineBreak;
	var lastLineBreak;
	
	var stack = [{node:curr, type:'root'}];
	stack.top = function() {
		return stack[stack.length-1];
	};
	var textBuffer = "";
	var point = 0;
	var i = -1;
	var c;
	scan();
	
	while (c) {
		//===========
		// [... tag?
		if (eatChar("[")) {
			point = i-1;
			if(eatChar("/")) {
				var name = readTagName();
				if (!eatChar("]") && !name || stack.top().type != name) {
					cancel();
				} else {
					endBlock(point);
				}
			} else {
				var name = readTagName();
				if (!name || !allowedTags[name]) {
					cancel();
				} else {
					// [tag=...
					var arg = null, args = null;
					if (eatChar("=")) {
						var start=i;
						while (c && c!="]" && c!=" ")
							scan();
						if (c == "]" || c == " ")
							arg = code.substring(start, i-1);
					}
					if (eatChar(" ")) {
						args = readArgList();
					}
					if (eatChar("]")) {
						startBlock(name, arg, args, i);
						if (name == 'code') {
							var end = code.indexOf("[/code]", i);
							if (end == -1)
								end = code.length;
							endBlock(end);
							i = end+"[/code]".length;
							i--;
							scan();
						}
					} else {
						cancel();
					}
				}
			}
		} else if (eatChar('\n')) {
			addLineBreak();
		} else {
			addText(c);
			scan();
		}
	}
	while (stack.length) {
		endBlock(i);
	}
	return output;
	
	function cancel() {
		addText(code.substring(point, i));
	}

	function readArgList() {
		var args = {};
		while (1) {
			// read key
			var start = i;
			while (isTagChar(c))
				scan();
			var key = code.substring(start, i);
			// key=...
			if (eatChar("=")) {
				// key="...
				if (eatChar('"')) {
					start = i;
					while (c && c!='"' && c!="\n")
						scan();
					if (eatChar('"'))
						args[key] = code.substring(start, i-2);
					else
						return null;
				// key=...
				} else {
					start = i;
					while (c && c!=" " && c!="]" && c!="\n")
						scan();
					if (c == "]") {
						args[key] = code.substring(start, i);
						return args;
					} else if (eatChar(" "))
						args[key] = code.substring(start, i-1);
					else
						return null;
				}
			// key ...
			} else if (eatChar(" ")) {
				args[key] = true;
			// key]...
			} else if (c == "]") {
				args[key] = true;
				return args;
			// key<other char> (error)
			} else
				return null;
		}
	}
	
	function readTagName() {
		var start = i;
		while (isTagChar(c))
			scan();
		return code.substring(start, i);
	}

	function isTagChar(c) {
		return c>="a" && c<="z" || c>="A"&&c<="Z" || c>="0"&&c<="9";
	}
		
	function eatChar(chr) {
		if (c == chr) {
			scan();
			return true;
		}
	}

	function scan() {
		i++;
		c = code.charAt(i);
	}

	// ###
	
	function addLineBreak() {
		if (skipNextLineBreak)
			skipNextLineBreak = false;
		else {
			flushText();
			lastLineBreak = options.lineBreak();
			addBlock(lastLineBreak);
		}
	}

	function addBlock(node) {
		flushText();
		options.append(curr, node);
	}
	
	function addText(text) {
		if (text) {
			textBuffer += text;
			skipNextLineBreak = false;
		}
	}

	function flushText() {
		if (textBuffer) {
			options.append(curr, options.text(textBuffer));
			textBuffer = "";
		}
	}

	function endBlock(index) {
		flushText();
		var item = stack.pop();
		var endFunc = options.end[item.type];
		if (endFunc) {
			endFunc(item.node, code.substring(item.start, index));
		}
		if (displayBlock[item.type] || (item.type=='code' && item.arg!='inline')) {
			skipNextLineBreak = true;
		}
		if (stack.length)
			curr = stack.top().node;
		else
			curr = null;
	}
	
	function startBlock(type, arg, args, index) {
		if (displayBlock[type] || (type=='code' && arg!='inline')) {
			if (eatChar("\n")) //hack
				index++;
			else
				skipNextLineBreak = true;
		}
		var node = options.tag[type](arg, args);
		stack.push({
			type: type,
			node: node,
			start: index,
			arg: arg
		});
		flushText();
		options.append(curr, node);
		curr = node;
	}
}

bbcodeParse.options = (function(){
	if (!document)
		return;

	var create = function(x) {
		return document.createElement(x);
	}
	var createText = function(x) {
		return document.createTextNode(x);
	}
	var creator = function(tag) {
		return function() {
			return document.createElement(tag);
		}
	}

	return {
		append: function(parent, child) {
			parent.appendChild(child);
		},
		remove: function(child) {
			child.parentNode.removeChild(child);
		},
		root: function() {
			var node = create('div');
			node.className = "markup-root";
			return node;
		},
		text: function (text) {
			return createText(text);
		},
		lineBreak: creator('br'),
		tag: {
			b: creator('b'),
			i: creator('i'),
			u: creator('u'),
			s: creator('s'),
			sup: creator('sup'),
			sub: creator('sub'),
			h1: creator('h2'),
			h2: creator('h3'),
			h3: creator('h4'),
			table: creator('table'),
			tr: creator('tr'),
			td: creator('td'),
			th: creator('th'),
			code: function(arg, args) {
				if (arg == 'inline')
					var node = create('code');
				node = create('pre');
				if (args && args.lang)
					node.setAttribute('data-lang', args.lang);
				return node;
			},
			align: function(arg) {
				var node = create('div');
				if (arg == 'left' || arg == 'right' || arg == 'center')
					node.style.textAlign = arg;
				return node;
			},
			url: function(arg) {
				var node = create('a');
				if (arg) {
					node.href = arg;
				}
				return node;
			},
			youtube: function(arg) {
				var node = create('iframe');
				return node;
			},
			img: function(arg) {
				var node = create('img');
				node.setAttribute('tabindex', "-1");
				return node;
			}
		},
		end: {
			url: function(node, contents) {
				if (!node.href) {
					node.href = contents;
				}
			},
			youtube: function(node, contents) {
				var protocol = "https:";
				if (window.location && window.location.protocol == "http:")
					protocol = "http:"
				var match = contents.match(/(?:https?:\/\/)?(?:www\.)?youtu\.?be(?:\.com)?\/?.*(?:watch|embed)?(?:.*v=|v\/|\/)([\w\-_]+)\&?/);
				if (match)
					node.src = protocol+"//www.youtube-nocookie.com/embed/"+match[1];
			},
			img: function(node, contents) {
				node.src = contents;
			},
			code: function(node, contents) {
				node.innerHTML = highlightSB(contents, node.getAttribute('data-lang'));
			}
		}
	}
})();
