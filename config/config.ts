// FROM: https://github.com/vercel/arg
function parseArgs(args) {
	const result = {};

	for (let x = 0; x < args.length; x++) {
		const wholeArg = args[x];

		if (wholeArg === "--") {
			break;
		}

		if (wholeArg.length > 1 && wholeArg[0] === "-") {
			for (const arg of wholeArg[1] === "-" || wholeArg.length === 2 ? [wholeArg] : wholeArg.slice(1).split("").map((a) => `-${a}`)) {
				const [key, value] = arg[1] === "-" ? arg.split(/[=](.*)/u, 2) : [arg, undefined];

				result[key] = value ?? args[x + 1];
			}
		}
	}

	return result;
}

function cloneDeep(object) {
	const clone = Array.isArray(object) ? [] : {};

	for (const [key, value] of Object.entries(object)) {
		if (Array.isArray(value)) {
			clone[key] = [];

			for (const element of value) {
				if (typeof element === "object" && element !== null) {
					clone[key].push(cloneDeep(element));
				} else {
					clone[key].push(element);
				}
			}
		} else if (typeof value === "object" && value !== null) {
			clone[key] = cloneDeep(value);
		} else {
			clone[key] = value;
		}
	}

	return clone;
}

function getOrCreateKeyOfObjectByPath(object, path) {
	return path.reduce(function(object, key) {
		if (object[key] === undefined) {
			object[key] = {};
		}

		return object[key];
	}, object) || object;
}

function getKeyOfObjectByPath(object, path) {
	return path.reduce(function(object, key) {
		return object[key];
	}, object) || object;
}

////////////////////////////////////////

class Juvy {
	private readonly schema = {
		"_juvyProperties": {}
	};

	public constructor(schema, options = { "strict": true }) {
		// ???
		for (const [key, value] of Object.entries(schema)) {
			if (key === "_juvyProperties") {
				throw new Error("`" + fullName + "`: `_juvyProperties` is reserved word of juvy.");
			}


		}

		// ...

		this.validate(options);
	}

	public default(path) {
		path = path.split(".").join("._juvyProperties.") + ".default";

		return cloneDeep(getKeyOfObjectByPath(this.schema._juvyProperties, path));
	}

	public get(path) {
		if (this.has(path)) {
			return this._get(path);
		}

		path = path[0].toUpperCase() + path.substring(1);

		if (this._get("env") === "production") {
			if (this.has("prod" + path)) {
				return this.get("prod" + path);
			}
		}

		return this._get("dev" + path);
	}

	public getProperties() {
		return cloneDeep(this.schema);
	}

	public has(path) {
		return Object.keys(this.getProperties()).includes(path);
	}

	public reset(path) {
		this.set(path, this.default(path));
	}

	public set(path, value) {
		// ???
		const format = (function getFormat(schema, path) {
			const o = traverseSchema(schema, path);
			if (o === null) {
				return null;
			}
			if (typeof o.format === "string") {
				return o.format;
			}
			if (o.default !== null) {
				return typeof o.default;
			}
			return null;
		})(this.schema, path);

		if (typeof value === "string") {
			switch (format) {
				case "int":
				case "integer":
				case "nat":
				case "port":
					value = parseInt(value);
					break;
				case "number":
					value = parseFloat(value);
					break;
				case "boolean":
					value = String(value).toLowerCase() !== "false";
					break;
				case "array":
					value = value.split(",");
					break;
				case "object":
					value = JSON.parse(value);
					break;
				case "regexp":
					value = new RegExp(value, "u");
					break;
				default:
					console.warn("No match for format: `" + format + "`");
			}
		}

		const parent = path.split(".");
		const child = parent.pop();

		if (parent !== "__proto__" && parent !== "constructor" && parent !== "prototype") {
			getOrCreateKeyOfObjectByPath(this.schema, parent)[child] = value;
		}

		return this;
	}

	public validate(options) {
		// ???

		return this;
	}

	private _get(path) {
		return cloneDeep(getKeyOfObjectByPath(this.schema, path));
	}
}

export function juvy(schema) {
	return new Juvy(schema);
}