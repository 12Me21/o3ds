var Parse = {
	lang:{}
};

var create = function(x) {
	return document.createElement(x);
}
var createText = function(x) {
	return document.createTextNode(x);
}
var creator = function (tag) {
	return function() {
		return create(tag);
	}
};

Parse.options = {
	append: function (parent, child) {
		parent.appendChild(child);
	},
	parent: function (child) { // unused currently
		return child.parent;
	},
	remove: function(child) {
		child.parentNode.removeChild(child);
	},

	//========================
	// nodes without children:
	text: function(text) {
		return createText(text);
	},
	lineBreak: creator('br'),
	line: creator('hr'),
	// code block
	code: function(code, language) {
		var node = create('pre');
		node.setAttribute('data-lang', language);
		node.innerHTML = highlightSB(code, language);
		return node;
	},
	// inline code
	icode: function(code) {
		var node = create('code');
		node.textContent = code;
		return node;
	},
	audio: function(url) {
		var node = create('audio');
		node.setAttribute('controls', "");
		node.setAttribute('src', url);
		return node;
	},
	video: function(url) {
		var node = create('video');
		node.setAttribute('controls', "");
		node.setAttribute('src', url);
		return node;
	},
	youtube: function(node, contents) {
		var protocol = "https:";
		if (window.location && window.location.protocol == "http:")
			protocol = "http:"
		var match = contents.match(/(?:https?:\/\/)?(?:www\.)?youtu\.?be(?:\.com)?\/?.*(?:watch|embed)?(?:.*v=|v\/|\/)([\w\-_]+)\&?/);
		if (match)
			node.src = protocol+"//www.youtube-nocookie.com/embed/"+match[1];
	},
	
	//=====================
	// nodes with children
	root: function() {
		var node = create('div');
		node.className = "markup-root";
		return node;
	},
	bold: creator('b'),
	italic: creator('i'),
	underline: creator('u'),
	strikethrough: creator('s'),
	heading: function(level) { // input: 1, 2, or 3
		return create('h' + (level+1));//['h1','h2','h3'][level-1] || 'h3');
	},
	quote: function(user) {
		var node = create('blockquote');
		node.setAttribute('cite', user);
		return node;
	},
	list: creator('ul'),
	item: creator('li'), // (list item)
	link: function(url) {
		var protocol = url.match(/^([-\w]+:)([^]*)$/);
		if (protocol && protocol[1] == "sbs:") {
			url = "#"+protocol[2];
		} else if (!protocol) {
			var protocol = "https:";
			if (window.location && window.location.protocol == "http:")
				protocol = "http:";
			url = protocol+"//"+url;
		}
		var node = create('a');
		node.setAttribute('href', url);
		return node;
	},
	table: creator('table'),
	row: creator('tr'),
	cell: function (header) {
		return header ?
			create('th') :
			create('td');
	},
	image: function(url) {
		var node = create('img');
		node.setAttribute('src', url);
		node.setAttribute('tab-index', "-1");
		return node;
	},
	error: function() {
		var node = create('div');
		node.className = "parse-error";
		node.textContent = "Error";
		return node;
	},
	align: function(arg) {
		var node = create('div');
		if (arg == 'left' || arg == 'right' || arg == 'center')
			node.style.textAlign = arg;
		return node;
	},
	sup: creator('sup'),
	sub: creator('sub'),
	anchor: function(name) {
		var node = create('a');
		node.name = "_anchor_"+name;
		return node;
	}
}

Parse.lang['12y'] = function(code) {
	var options = Parse.options;
	var output = options.root();
	var curr = output;
	var lastLineBreak = null;
	var displayBlock = {
		code:true,audio:true,video:true,heading:true,quote:true,
		list:true,item:true,table:true,image:true
	};
	var skipNextLineBreak;
	
	try {
		// this is a list of all nodes that we are currently inside
		// as well as {}-block pseudo-nodes
		var stack = [{node:curr, type:'root'}];
		stack.top = function() {
			return stack[stack.length-1];
		};
		var textBuffer = "";
		var inside = {};
		var startOfLine = true;
		var leadingSpaces = 0;
		var lastWasBlock;
		// todo:
		// so, the way to prevent extra linebreaks (without just ignoring them all) is
		// to ignore linebreaks around blocks. (before and after, as well as inside, ignore 1 leading/trailing linebreak)
		// idea:
		
		var i = -1;
		var c;
		scan();
		
		while (c) {
			if (eatChar("\n")) {
				endLine();
				//==========
				// \ escape
			} else if (eatChar("\\")) {
				if (c == "\n")
					addLineBreak();
				else
					addText(c);
				scan();
				//===============
				// { group start (why did I call these "groups"?)
			} else if (eatChar("{")) {
				startBlock(null, {});
				lineStart();
			//=============
			// } group end
			} else if (eatChar("}")) {
				if (stackContains(null)) {
					closeAll(false);
				} else {
					addText("}");
				}
			//================
			// * heading/bold
			} else if (c == "*") {
				if (startOfLine && (code[i+1] == "*" || code[i+1] == " ")) {
					var headingLevel = 0;
					while (eatChar("*"))
						headingLevel++;
					if (headingLevel > 3)
						headingLevel = 3;
					
					if (eatChar(" "))
						startBlock('heading', {}, headingLevel);
					else
						addText('*'.repeat(headingLevel));
				} else {
					doMarkup('bold', options.bold);
				}
			} else if (c == "/") {
				doMarkup('italic', options.italic);
			} else if (c == "_") {
				doMarkup('underline', options.underline);
			} else if (c == "~") {
				doMarkup('strikethrough', options.strikethrough);
			//============
			// >... quote
			} else if (startOfLine && eatChar(">")) {
				// todo: maybe >text should be a quote without author... 
				// need to add a way to add information to quotes:
				// - user ID
				// - post ID
				start = i;
				while (eatChar(" "))
					;
				while (c && !char_in(c, " \n{:"))
					scan();
				var name = code.substring(start, i).trim();
				eatChar(":");
				while (eatChar(" "))
					;
				startBlock('quote', {}, name);
				//==============
				// -... list/hr
			} else if (startOfLine && eatChar("-")) {
				//----------
				// --... hr
				if (eatChar("-")) {
					var count = 2;
					while (eatChar("-"))
						count++;
					//-------------
					// ---<EOL> hr
					if (c == "\n" || !c) { //this is kind of bad
						addBlock(options.line());
					//----------
					// ---... normal text
					} else {
						addText("-".repeat(count));
					}
				//------------
				// - ... list
				} else if (eatChar(" ")) {
					startBlock('list', {level:leadingSpaces});
					startBlock('item', {level:leadingSpaces});
				//---------------
				// - normal char
				} else
					addText("-");
			//==========================
			// ] end link if inside one
			} else if (c == "]" && stack.top().inBrackets){ //this might break if it assumes .top() exists. needs more testing
				scan();
				if (stack.top().big) {
					if (eatChar("]"))
						endBlock();
					else
						addText("]");
				} else
					endBlock();
			//================
			// https?:// link
			} else if (c == "h" || c == "!") { //lol this is silly
				var embed = eatChar("!");
				if (embed && eatChar("[")) {
					readBracketedLink(embed) || addText("[");
					// handled
				} else {
					var start = i;
					if (code.substr(start,7) == "http://" || code.substr(start,8) == "https://") {
						var url = readUrl();
						startBlock(embed ? urlType(url) : 'link', {}, url);
						if (eatChar("["))
							stack.top().inBrackets = true;
						else {
							addText(url);
							endBlock();
						}
					} else {
						if (embed)
							addText("!");
						else {
							scan();
							addText("h");
						}
					}
				}
			//============
			// |... table
			} else if (c == "|") {
				var top = stack.top();
				// continuation
				if (top.type == 'cell') {
					var row = top.row;
					var table = top.row.table;
					scan();
					eatChar("\n");
					//--------------
					// | | next row
					if (eatChar("|")) {
						if (table.columns == null)
							table.columns = row.cells;
						endBlock();
						if (top_is('row')) //always
							endBlock();
						var row = startBlock('row', {table:table, cells:0});
						row.header = eatChar("*");
						startBlock('cell', {row:row}, row.header);
						while (eatChar(" "))
							;
						//--------------------------
						// | next cell or table end
					} else {
						row.cells++;
						textBuffer = textBuffer.replace(/ *$/,""); //strip trailing spaces (TODO: allow \<space>)
						// end of table
						// table ends when number of cells in current row = number of cells in first row
						// single-row tables are not easily possible ..
						// TODO: fix single row tables
						if (table.columns != null && row.cells > table.columns) {
							endBlock(); //end cell
							if (top_is('row')) //always
								endBlock();
							if (top_is('table')) //always
								endBlock();
						} else { // next cell
							endBlock();
							startBlock('cell', {row:row}, row.header);
							while (c == " ")
								scan();
						}
					}
					// start of new table (must be at beginning of line)
				} else if (startOfLine) {
					scan();
					table = startBlock('table', {
						columns: null
					});
					row = startBlock('row', {
						table: table,
						cells: 0
					});
					row.header = eatChar("*");
					startBlock('cell', {
						row: row
					}, row.header);
					while (eatChar(" "))
						;
				} else {
					scan();
					addText("|");
				}
				//===========
				// `... code
			} else if (eatChar("`")) {
				//---------------
				// ``...
				if (eatChar("`")) {
					//----------------
					// ``` code block
					if (eatChar("`")) {
						// read lang name
						start = i;
						while (c && c!="\n" && c!="`")
							scan();
						var language = code.substring(start, i).trim().toLowerCase();
						eatChar("\n");
						start = i;
						i = code.indexOf("```", i);
						addBlock(options.code(
							code.substring(start, i!=-1 ? i : code.length),
							language
						));
						if (i != -1) {
							i += 2;
							scan();
						} else {
							i = code.length;
							scan();
						}
					//------------
					// `` invalid
					} else {
						addText("``");
					}
				// --------------
				// ` inline code
				} else {
					start = i;
					var codeText = ""
					while (c) {
						if (c=="`") {
							if (code[i+1] == "`") {
								if (i == start+1 && codeText[0] == " ")
									codeText = codeText.substr(1);
								scan();
							} else
								break;
						}
						codeText += c;
						scan();
					}
					addBlock(options.icode(codeText));
					scan();
				}
			//
			//=============
			// [[url link
			} else if (eatChar("[")) {
				readBracketedLink() || addText("[");
			//
			//=============
			// normal char
			} else {
				addText(c);
				scan();
			}
		}
		flushText();
		closeAll(true);
		return output;
	} catch (e) {
		try {
			flushText();
			closeAll(true);
			addBlock(options.error());

			addText(code.substr(i));
			flushText();

			return output;
		} catch (e) {
			alert("Fatal parse error at: "+i);
		}
	}
	
	// ######################
	
	function eatChar(chr) {
		if (c == chr) {
			scan();
			return true;
		}
	}
	
	// block dangerous url protocols
	function sanitizeUrl(url) {
		// this might need to be improved
		if (/^ *javascript:/i.test(url)) //most browsers don't allow leading spaces but I think IE does.
			return "";
		return url;
	}

	function readBracketedLink(embed) {
		if (c != "[") {
			return false;
		} else {
			scan();
			// read url:
			var start = i;
			var part2 = false;
			var url = readUrl(true);
			if (eatChar("]")) {
				if (eatChar("]"))
					;
				else if (eatChar("["))
					part2 = true;
			}
			startBlock(embed ? urlType(url) : 'link', {big: true}, url);
			if (part2)
				stack.top().inBrackets = true;
			else {
				addText(url);
				endBlock();
			}
			return true;
		}
	}

	// read a url
	// if `allow` is true, url is only ended by end of file or ]] or ][ (TODO)
	function readUrl(allow) {
		var start = i;
		if (allow)
			while (c && c!="]" && c!="[")
				scan();
		else
			while (isUrlChar(c))
				scan();
		return sanitizeUrl(code.substring(start, i));
	}
	
	// ew regex
	function isUrlChar(c) {
		return c && (/[-\w\$\.+!*'(),;/\?:@=&#%]/).test(c);
	}
	
	// closeAll(true) - called at end of document
	// closeAll(false) - called at end of {} block
	function closeAll(force) {
		while(stack.length) {
			var top = stack.top();
			if (top.type == 'root') {
				break;
			}
			if (!force && top.type == null) {
				endBlock();
				break;
			}
			endBlock();
		}
	}
	
	function endLine() {
		var eat = false;
		while (1) {
			var top = stack.top();
			if (top.type == 'heading' || top.type == 'quote') {
				endBlock();
				eat = true;
			} else if (top.type == 'item') {
				eat = true;
				if (top.type == 'item')
					endBlock();
				var indent = 0;
				while (eatChar(" "))
					indent++;
				// OPTION 1:
				// no next item; end list
				if (c != "-") {
					while (top_is('list')) {//should ALWAYS happen at least once
						endBlock();
					}
					addText(" ".repeat(indent));
				} else {
					scan();
					while (eatChar(" "))
						;
					// OPTION 2:
					// next item has same indent level; add item to list
					if (indent == top.level) {
						startBlock('item', {level: indent});
						// OPTION 3:
						// next item has larger indent; start nested list	
					} else if (indent > top.level) {
						startBlock('list', {level: indent});
						startBlock('item', {level: indent}); // then made the first item of the new list
						// OPTION 4:
						// next item has less indent; try to exist 1 or more layers of nested lists
						// if this fails, fall back to just creating a new item in the current list
					} else {
						// TODO: currently this will just fail completely 
						while(1) {
							top = stack.top();
							if (top && top.type == 'list') {
								if (top.level <= indent) {
									break;
								} else {
									endBlock();
								}
							} else {
								// no suitable list was found :(
								// so just create a new one
								startBlock('list', {level: indent});
								break;
							}
						}
						startBlock('item', {level: indent});
					}
					break; //really?
				}
			} else {
				if (!eat)
					addLineBreak();
				break;
			}
		}
	}

	// audio, video, image, youtube (todo)
	function urlType(url) {
		if (/(\.mp3(?!\w)|\.ogg(?!\w)|\.wav(?!\w)|#audio$)/.test(url))
			return "audio";
		if (/(\.mp4(?!\w)|#video$)/.test(url))
			return "video";
		return "image";
	}
	
	// common code for all text styling tags (bold etc.)
	function doMarkup(type, create) {
		var symbol = c;
		scan();
		if (canStartMarkup(type)) {
			startBlock(type, {});
		} else if (canEndMarkup(type)) {
			endBlock();
		} else {
			addText(symbol);
		}
	}
	// todo: maybe have support for non-ASCII punctuation/whitespace?
	function canStartMarkup(type) {
		return (
			(!code[i-2] || char_in(code[i-2], " \t\n({'\"")) && //prev char is one of these (or start of text)
			!char_in(c, " \t\n,'\"") && //next char is not one of these
			!stackContains(type)
		);
	}
	function canEndMarkup(type) {
		return (
			top_is(type) && //there is an item to close
			!char_in(code[i-2], " \t\n,'\"") && //prev char is not one of these
			(!c || char_in(c, " \t\n-.,:!?')}\"")) //next char is one of these (or end of text)
		);
	}
	function char_in(chr, list) {
		return chr && list.indexOf(chr) != -1;
	}

	function lineStart() {
		startOfLine = true;
		leadingSpaces = 0;
	}
	
	function scan() {
		if (c == "\n" || !c)
			lineStart();
		else if (c != " ")
			startOfLine = false;
		else if (startOfLine)
			leadingSpaces++;
		i++;
		c = code.charAt(i);
	}

	// um like
	// don't use 'null' as a type name probably
	// In THis House
	// We use ==         ,
	function stackContains(type) {
		for (var i=0; i<stack.length; i++) {
			if (stack[i].type == type) {
				return true;
			}
		}
		return false;
	}
	function top_is(type) {
		var top = stack.top();
		return top && top.type == type;
	}
	
	function startBlock(type, data, arg) {
		if (displayBlock[type]) {
			/*if (lastLineBreak) {
				options.remove(lastLineBreak);
			}*/
			skipNextLineBreak = true;
		}
		data.type = type;
		if (type) {
			data.node = options[type](arg);
			flushText();
			options.append(curr, data.node);
			curr = data.node;
		}
		stack.push(data);
		return data;
	}
	// add simple block with no children
	function addBlock(node) {
		flushText();
		options.append(curr, node);
	}
	function addText(text) {
		if (text) {
			textBuffer += text;
			lastLineBreak = null;
			if (skipNextLineBreak) {
				skipNextLineBreak = false;
			}
		}
	}
	function flushText() {
		if (textBuffer) {
			options.append(curr, options.text(textBuffer));
			textBuffer = ""
		}
	}
	function addLineBreak() {
		if (skipNextLineBreak) {
			skipNextLineBreak = false;
		} else {
			flushText();
			lastLineBreak = options.lineBreak();
			addBlock(lastLineBreak);
		}
	}
	function endBlock() {
		flushText();
		var node = stack.pop();
		if (displayBlock[node.type]) {
			skipNextLineBreak = true;
		}
		var i=stack.length-1;
		// this skips {} fake nodes
		// it will always find at least the root <div> element I hope
		while (!stack[i].node){
			i--;
		}
		curr = stack[i].node;
	}
}

Parse.lang.bbcode = function(code) {
	var options = Parse.options;
	var output = options.root();
	var curr = output;
	var displayBlock = {
		h1:true,h2:true,h3:true,align:true,list:true,spoiler:true,youtube:true,quote:true,table:true,tr:true,img:true
	};
	var blocks = {
		b: options.bold,
		i: options.italic,
		u: options.underline,
		s: options.strikethrough,
		sup: options.superscript,
		sub: options.subscript,
		h1: function(){return options.heading(1)},
		h2: function(){return options.heading(2)},
		h3: function(){return options.heading(3)},
		table: options.table,
		tr: options.row,
		td: function(){return options.cell(false)},
		th: function(){return options.cell(true)},
		code: true, 
		align: options.align,
		url: options.link,//+<VERY special case> (only hardcode when no argument)
		youtube: true, //<special case>,
		img: true, //<special case>,
		list: options.list,
		spoiler: options.spoiler,
		quote: options.quote,
		anchor: function(arg){
			return options.anchor(arg);
		}
	};
	var specialBlock = {
		url: function(arg, args, contents){
			var node = options.link(contents);
			node.textContent = contents;
			return node;
		},
		code: function(arg, args, contents) {
			if (args)
				var lang = args.lang;
			if (arg == 'inline')
				return options.icode(contents, lang);
			return options.code(contents, lang);
		},
		youtube: function(arg, args, contents) {
			return options.youtube(contents);
		},
		img: function(arg, args, contents) {
			return options.image(contents);
		}
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
				if (!eatChar("]") || !name || stack.top().type != name) {
					cancel();
				} else {
					endBlock(point);
				}
			} else {
				var name = readTagName();
				if (!name || !blocks[name]) {
					cancel();
				} else {
					
					// [tag=...
					var arg = null, args = null;
					if (eatChar("=")) {
						var start=i;
						while (c && c!="]" && c!=" ")
							scan();
						if (c == "]" || c == " ")
							arg = code.substring(start, i);
					}
					if (eatChar(" ")) {
						args = readArgList();
					}
					if (eatChar("]")) {
						if (name == "youtube" || name == "img" || (name == "url" && !arg) || name == "code") {
							var endTag = "[/"+name+"]";
							var end = code.indexOf(endTag, i);
							if (end < 0)
								cancel();
							else {
								var contents = code.substring(i, end);
								i = end + endTag.length;
								i--;
								scan();
								addBlock(specialBlock[name](arg,args,contents));
								if (name == "youtube" || name=="img" || (name=="code" && arg != "inline"))
									skipNextLineBreak = true;
							}
						} else if (blocks[name]) {
							startBlock(name, arg, args, i);
						} else
							cancel();
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
		if (displayBlock[item.type]) {
			skipNextLineBreak = true;
		}
		if (stack.length)
			curr = stack.top().node;
		else
			curr = null;
	}
	
	function startBlock(type, arg, args, index) {
		if (displayBlock[type]) {
			if (eatChar("\n")) //hack
				index++;
			else
				skipNextLineBreak = true;
		}
		var node = blocks[type](arg, args);
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

Parse.fallback = function(text) {
	var root = options.root();
	var text = options.text(text);
	options.append(root, text);
	//todo: autolinker
	return root;
}