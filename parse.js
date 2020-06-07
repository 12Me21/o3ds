var Parse = {
	lang:{},
	id: 0
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
		if (parent.isSpoiler) {
			parent = parent.branch;
		}
		if (child.isSpoiler) {
			child.nodes.forEach(function(x){
				parent.appendChild(x)
			});
		} else {
			parent.appendChild(child);
		}
	},
	parent: function (child) { // unused currently
		return child.parent;
	},
	remove: function(child) {
		child.parentNode.removeChild(child);
	},

	preview: {
		video: function(url) {
			
		},
		youtube: function(url) {
			
		},
		audio: function(url) {
			
		}
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
	audio: function(url, preview) {
		if (preview) {
			var node = create('div');
			node.className = "audioPreview preview";
			node.textContent = "[audio preview]\n";
			return node;
		}
		var node = create('audio');
		node.setAttribute('controls', "");
		node.setAttribute('src', url);
		return node;
	},
	video: function(url, preview) {
		if (preview) {
			var node = create('div');
			node.className = "videoPreview preview";
			node.textContent = "[video preview]\n";
			return node;
		}
		var node = create('video');
		node.setAttribute('controls', "");
		node.setAttribute('src', url);
		return node;
	},
	youtube: function(url, preview) {
		var protocol = "https:";
		if (window.location && window.location.protocol == "http:")
			protocol = "http:"
		var match = url.match(/(?:https?:\/\/)?(?:www\.)?youtu\.?be(?:\.com)?\/?.*(?:watch|embed)?(?:.*v=|v\/|\/)([\w\-_]+)\&?/);
		
		if (true) {
			var node = create('img');
			node.className = "youtube";
			if (match)
				node.src = protocol+"//i.ytimg.com/vi/"+match[1]+"/mqdefault.jpg";
			return node;
		}
		var node = create('iframe');
		node.className = "youtube";
		if (match)
			node.src = protocol+"//www.youtube-nocookie.com/embed/"+match[1];
		return node;
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
		// important, do not remove, prevents script injection
		if (/^ *javascript:/i.test(url))
			url = "";
		
		var protocol = url.match(/^([-\w]+:)([^]*)$/);
		if (protocol && protocol[1].toLowerCase() == "sbs:") {
			// put your custom local url handling code here
			url = "#"+protocol[2];
			
		} else if (!protocol) {
			// urls without protocol get https:// or http:// added
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
	cell: function (opt) {
		var node = opt.h ?
			create('th') :
			 create('td');
		if (opt.rs)
			node.rowSpan = opt.rs;
		if (opt.cs)
			node.colSpan = opt.cs;
		if (opt.c) {
			if (opt.c[0] == "#")
				node.style.backgroundColor = opt.c;
			node.setAttribute("data-bgcolor", opt.c);
		}
		node.className = "cell";
		return node;
	},
	image: function(url) {
		var node = create('img');
		node.setAttribute('src', url);
		node.setAttribute('tabindex', "-1");
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
	},
	spoiler: function(name, args) {
		var checkbox = create('input');
		checkbox.type = 'checkbox';
		checkbox.style.display = 'none';
		Parse.id++;
		checkbox.id = "spoiler-"+Parse.id;

		var label = create('label');
		label.setAttribute('for', checkbox.id);
		label.className = "spoilerButton";
		label.textContent = name;
		
		var box = create('div');
		box.className = "spoiler";

		return {
			isSpoiler: true,
			nodes: [checkbox, label, box],
			branch: box
		}
	}
}

Parse.lang['12y'] = function(code, preview, cache) {
	// so what happens here is
	// when a video needs to be generated
	// first, check the cache. if it exists there, insert it
	// (remember that a node can only exist in one place in the DOM though)
	// now, if the video needs to be created, and preview mode is enabled,
	// a place holder is generated (and not stored in the cache)
	// if preview is disabled (and cache is passed), the video is generated
	// and stored in the cache, to be reused later
	
	// in the editor, this should be called normally with preview mode enabled
	// then maybe after a delay of no typing, call it with preview off,
	// to generate any new videos
	// or don't use preview at all! maybe it's fine!
	if (cache)
		markCacheUnused();
	
	var options = Parse.options;
	var output = options.root();
	var curr = output;
	var lastLineBreak = null;
	var displayBlock = {
		code:true,audio:true,video:true,heading:true,quote:true,
		list:true,item:true,table:true,image:true,line:true,youtube:true,
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
				//if (eatChar("#")){} TAGS PLEASE
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
						addMulti('*', headingLevel);
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
						skipNextLineBreak = true; //hack
					//----------
					// ---... normal text
					} else {
						addMulti("-", count);
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
			//============
			// |... table
			} else if (eatChar("|")) {
				var top = stack.top();
				// continuation
				if (top.type == 'cell') {
					var row = top.row;
					var table = top.row.table;
					var eaten = eatChar("\n");
					//--------------
					// | | next row
					if (eatChar("|")) {
						// number of cells in first row
						// determines number of columns in table
						if (table.columns == null)
							table.columns = row.cells;
						// end blocks
						endBlock(); //cell
						if (top_is('row')) //always
							endBlock();
						// start row
						// calculate number of cells in row which will be
						// already filled due to previous row-spanning cells
						var cells = 0
						table.rowspans = table.rowspans.map(function(span){
							cells++;
							return span-1;
						}).filter(function(span){return span > 0});
						var row = startBlock('row', {table:table, cells:cells});
						row.header = eatChar("*");
						// start cell
						startCell(row);
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
								endBlock(); //row
							if (top_is('table')) //always
								endBlock(); //table
							if (eaten)
								addLineBreak();
						} else { // next cell
							endBlock(); //cell
							startCell(row);
						}
					}
					// start of new table (must be at beginning of line)
				} else if (startOfLine) {
					table = startBlock('table', {
						columns: null,
						rowspans: []
					});
					row = startBlock('row', {
						table: table,
						cells: 0
					});
					row.header = eatChar("*");
					startCell(row);
				} else {
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
						//todo: protect against ```why won't this work``` ?
						var language = code.substring(start, i).trim().toLowerCase();
						var eaten = eatChar("\n");
						start = i;
						i = code.indexOf("```", i);
						addBlock(options.code(
							code.substring(start, i!=-1 ? i : code.length),
							language
						));
						skipNextLineBreak = eaten;
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
			//================
			// link
			} else if (readLink()) {
			//
			//=============
			// normal char
			} else {
				addText(c);
				scan();
			}
		}
		// END
		flushText();
		closeAll(true);
		return output;
		
	} catch (e) {
		try {
			flushText();
			closeAll(true);
			addBlock(options.error());
			console.log(e);

			addText(code.substr(i));
			flushText();

			return output;
		} catch (e) {
			alert("Fatal parse error at: "+i);
		}
	}
	
	// ###################################
	
	function eatChar(chr) {
		if (c == chr) {
			scan();
			return true;
		}
	}
	
	function readBracketedLink(embed) {
		if (eatChar("[")) {
			if (eatChar("[")) {
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
				startBlock(embed ? urlType(url) : 'link', {big: true}, url, preview);
				if (part2)
					stack.top().inBrackets = true;
				else {
					addText(url);
					endBlock();
				}
				return true;
			} else {
				addText("[");
			}
		}
		return false;
	}

	// read table cell properties and start cell block, and eat whitespace
	// assumed to be called when pointing to char after |
	function startCell(row) {
		if (eatChar("#")) {
			var props = readProps();
			if (props.rs)
				row.table.rowspans.push(props.rs-1);
			if (props.cs)
				row.cells += props.cs-1;
		} else {
			props = {};
		}
		props.h = row.header;
		startBlock('cell', {row: row}, props);
		while (eatChar(" "))
			;
	}

	// split string on first occurance
	function split1(string, sep) {
		var n = string.indexOf(sep);
		if (n == -1)
			return [string, null];
		else
			return [string.substr(0,n), string.substr(n+sep.length)];
	}

	// read properties key=value,key=value... ended by a space
	// =value is optional and defaults to `true`
	function readProps() {
		var start = i;
		var end = code.indexOf(" ", i);
		if (end < 0)
			end = code.length;
		i = end-1;
		scan();
		var propst = code.substring(start, end);
		var props = {};
		propst.split(",").forEach(function(x){
			var pair = split1(x, "=");
			props[pair[0]] = pair[1] || true;
		});
		return props;
	}

	// string.repeat doesn't exist
	function addMulti(text, count) {
		while (count --> 0)
			addText(text);
	}

	
	function readLink() {
		var embed = eatChar("!");
		if (readBracketedLink(embed) || readPlainLink(embed))
			return true;
		else if (embed) {
			addText("!");
			return true;
			//lesson: if anything is eaten, you must return true if it's in the top level if switch block
		}
	}

	function readPlainLink(embed) {
		if (matchNext("http://") || matchNext("https://") || matchNext("sbs:")) {
			var url = readUrl();
			var after = eatChar("[");
			startBlock(embed ? urlType(url) : 'link', {
				inBrackets: after
			}, url, preview);
			if (!after) {
				addText(url);
				endBlock();
			}
			return true;
		}
	}
	
	function matchNext(str) {
		return code.substr(i, str.length) == str;
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
		return code.substring(start, i);
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

	// called at the end of a line (unescaped newline)
	function endLine() {
		while (1) {
			var top = stack.top();
			if (top.type == 'heading' || top.type == 'quote') {
				endBlock();
			} else if (top.type == 'item') {
				if (top.type == 'item')
					endBlock();
				var indent = 0;
				while (eatChar(" "))
					indent++;
				// OPTION 1:
				// no next item; end list
				if (c != "-") {
					while (top_is('list')) //should ALWAYS happen at least once
						endBlock();
					addMulti(" ", indent);
				} else {
					scan();
					while (eatChar(" ")) {}
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
				addLineBreak();
				break;
			}
		}
	}

	// audio, video, image, youtube
	//todo: improve this lol
	function urlType(url) {
		if (/(\.mp3(?!\w)|\.ogg(?!\w)|\.wav(?!\w)|#audio$)/.test(url))
			return "audio";
		if (/(\.mp4(?!\w)|\.mkv(?!\w)|#video$)/.test(url))
			return "video";
		if (/(?:https?:\/\/)?(?:www\.)?youtu\.?be(?:\.com)?\/?.*(?:watch|embed)?(?:.*v=|v\/|\/)([\w\-_]+)\&?/.test(url))
			return "youtube";
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

	function markCacheUnused() {
		for (type in cache)
			for (arg in cache[type])
				cache[type][arg].forEach(function(x){
					x.used = false;
				});
	}
	
	function findUnusedCached(type, arg) {
		var list = cache[type][arg]
		if (!list)
			return null;
		for (var i=0;i<list.length;i++) {
			if (!list[i].used)
				return list[i];
		}
		return null;
	}
	
	function startBlock(type, data, arg) {
		if (displayBlock[type]) {
			/*if (lastLineBreak) {
				options.remove(lastLineBreak);
			}*/
			skipNextLineBreak = true;
		}
		var node;
		if (cache && type && cache[type]) {
			var item = findUnusedCached(type, arg);
			if (item) {
				item.used = true;
				node = item.node;
			}
		}
		if (!node && type) {
			node = options[type](arg);
			
			if (cache && cache[type]) {
				if (!cache[type][arg])
					cache[type][arg] = [];
				cache[type][arg].push({node:node, used:true});
			}
		}
		
		data.type = type;
		if (type) {
			data.node = node;
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
		var node = stack.pop();
		if (displayBlock[node.type]) {
			skipNextLineBreak = true;
		}
		flushText();
		var i=stack.length-1;
		// this skips {} fake nodes
		// it will always find at least the root <div> element I hope
		while (!stack[i].node){
			i--;
		}
		curr = stack[i].node;
	}
}

Parse.lang.bbcode = function(code, preview) {
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
		td: function(arg, opt){
			return options.cell(Object.assign({h:false}, opt))
		},
		th: function(arg, opt){
			return options.cell(Object.assign({h:true}, opt))
		},
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
		},
		item: options.item,
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
			return options.youtube(contents, preview);
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
				if (!eatChar("]") || !name) {
					cancel();
				} else {
					if (name == "list" && stack.top().type == "item") {
						endBlock(point);
					}
					if (name == stack.top().type) {
						endBlock(point);
						// eat whitespace between table cells
						if (name == 'td' || name == 'th') {
							while(eatChar(' ')||eatChar('\n')){
							}
						}
					} else {
						cancel();
					}
				}
			} else {
				var name = readTagName();
				if (!name || !blocks[name]) {
					if (eatChar("*") && eatChar("]")) {
						if (stack.top().type == "item") {
							endBlock(point);
						}
						startBlock("item", undefined, undefined, i);
					} else {
						cancel();
					}
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
							// eat first linebreak in blocks
							if (name == "youtube" || name=="img" || (name=="code" && arg != "inline"))
								eatChar("\n");
							
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
		if (displayBlock[item.type])
			skipNextLineBreak = true;
		
		if (stack.length)
			curr = stack.top().node;
		else
			curr = null;
	}
	
	function startBlock(type, arg, args, index) {
		if (displayBlock[type]) {
			//if (eatChar("\n")) //hack
			//	index++;
			//else
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
	var options = Parse.options;
	var root = options.root();
	var text = options.text(text);
	options.append(root, text);
	//todo: autolinker
	return root;
}
