/* eslint-disable function-call-argument-newline */

import * as fs from "fs";
import * as path from "path";

function parse(template) {
	const buffer = [];

	const openTagRegex = /<%\s*(=|-)?\s*/gu;
	const closeTagRegex = /'|"|`|\/\*|(\s*%>)/gu;

	let index = 0;
	let match;

	while (match = openTagRegex.exec(template)) {
		index = match[0].length + match.index;
		const prefix = match[1] ?? "";

		closeTagRegex.lastIndex = index;

		let closeTag;

		while (closeTag = closeTagRegex.exec(template)) {
			if (closeTag[1] !== undefined) {
				const value = template.slice(index, closeTag.index);

				index = closeTagRegex.lastIndex;
				openTagRegex.lastIndex = index;

				buffer.push({
					"type": {
						"": "execute",
						"-": "raw",
						"=": "interpolate"
					}[prefix],
					"value": value
				});

				break;
			}
		}
	}

	return buffer;
}

function compile(nodes) {
	const buffer = ["const buffer = [];"];

	for (const node of nodes) {
		if (typeof node === "string") {
			buffer.push("buffer.push(\"" + node + "\");");
		} else {
			let { type, value } = node;

			switch (type) {
				case "interpolate":
					if (/[&<>"']/gu.test(value)) {
						value = value.replace(/[&<>"']/gu, function(character) {
							return {
								"&": "&amp;",
								"<": "&lt;",
								">": "&gt;",
								"\"": "&quot;",
								"'": "&#39;"
							}[character];
						});
					}
				case "raw":
					buffer.push("buffer.push(" + value + ");");
					break;
				case "execute":
					buffer.push(value);
					break;
				default:
			}
		}
	}

	buffer.push("return buffer.join(\"\\n\");");

	return buffer.join("\n");
}

// All `extras` must receive `data` as their first argument
const extras = {
	"include": function(data, file) {
		const basePath = path.join(__dirname, "..", "views");
		const fullPath = path.join(basePath, file);

		if (path.resolve(fullPath).startsWith(basePath)) {
			if (fs.existsSync(fullPath)) {
				if (fs.statSync(fullPath).isFile()) {
					return render(fs.readdirSync(fullPath, { "encoding": "utf8" }), data);
				}
			}
		}
	}
};

export function render(template, data) {
	// eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
	return new Function(
		...Object.keys(data),
		...Object.keys(extras),
		compile(parse(template))
	)(
		...Object.values(data),
		...Object.values(extras).map(function(extra: (...args) => string) {
			return function(...args) {
				return extra(data, ...args);
			};
		})
	);
}
