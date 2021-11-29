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
	private readonly options = {};
	private readonly env = {};
	private readonly argv = {};

	public constructor(schema, options = { "strict": true }) {
		this.options["strict"] = options["strict"];

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

	private _get(path) {
		return cloneDeep(getKeyOfObjectByPath(this.schema, path));
	}

	public get(path) {
		if (this.has(path)) {
			return this._get(path);
		}

		if (this._get("env") === "production") {
			if (this.has("prod." + path)) {
				return this.get("prod." + path);
			}
		}

		return this._get("dev." + path);
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
		// <IDK>
		const ar = path.split(".");

		let o = this.schema;

		while (ar.length > 0) {
			const k = ar.shift();

			if (o?._juvyProperties?.[k]) {
				o = o._juvyProperties[k];
			} else {
				o = null;
				break;
			}
		}
		// </IDK>

		const format = o["format"];

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

	public validate(options = this.options) {
		// ???

		return this;
	}
}

export function juvy(schema) {
	return new Juvy(schema);
}
