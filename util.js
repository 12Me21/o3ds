function hide(element) {
	element.style.display = 'none';
}

function show(element) {
	element.style.display = '';
}

function visible(element, state) {
	element.style.display = state ? '' : 'none';
}

function setChild(element, child) {
	element.innerHTML = "";
	if (child)
		element.appendChild(child);
}

function protocol() {
	if (window.location.protocol == "http:")
		return "http:";
	return "https:";
}

function parseJSON(json) {
	if (!json)
		return undefined;
	try {
		return JSON.parse(json);
	} catch (e) {
		return null;
	}
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

function forDict(dict, func) {
	for (key in dict)
		func(dict[key], key, dict);
}

function hasPerm(perms, id, perm) {
	return perms && perms[id] && perms[id].indexOf(perm) != -1
}
