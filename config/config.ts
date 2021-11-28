/* eslint-disable complexity */

import assert from "assert";

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

function validate(instance, schema, strictValidation) {
	const errors = {
		"undeclared": [],
		"invalid_type": [],
		"missing": []
	};

	function flatten(obj, useProperties?) {
		const stack = Object.keys(obj);
		let key;

		const entries = [];

		while (stack.length) {
			key = stack.shift();
			let val = walk(obj, key);
			if (typeof val === "object" && !Array.isArray(val) && val !== null) {
				if (useProperties) {
					if ("_juvyProperties" in val) {
						val = val._juvyProperties;
						key += "._juvyProperties";
					} else {
						entries.push([key, val]);
						continue;
					}
				}
				const subkeys = Object.keys(val);

				// Don't filter out empty objects
				if (subkeys.length > 0) {
					subkeys.forEach(function(subkey) {
						stack.push(key + "." + subkey);
					});
					continue;
				}
			}
			entries.push([key, val]);
		}

		const flattened = {};
		entries.forEach(function(entry) {
			let key = entry[0];
			if (useProperties) {
				key = key.replace(/\._juvyProperties/gu, "");
			}
			const val = entry[1];
			flattened[key] = val;
		});

		return flattened;
	}

	const flatInstance = flatten(instance);
	const flatSchema = flatten(schema._juvyProperties, true);

	Object.keys(flatSchema).forEach(function(name) {
		const schemaItem = flatSchema[name];
		let instanceItem = flatInstance[name];
		if (!(name in flatInstance)) {
			try {
				if (typeof schemaItem.default === "object"
					&& !Array.isArray(schemaItem.default)) {
					// Missing item may be an object with undeclared children, so try to
					// pull it unflattened from the config instance for type validation
					instanceItem = walk(instance, name);
				} else {
					throw new Error("missing");
				}
			} catch (e) {
				const err = new Error("configuration param '" + name
					+ "' missing from config, did you override its parent?");
				errors.missing.push(err);
				return;
			}
		}
		delete flatInstance[name];

		// ignore nested keys of schema 'object' properties
		if (schemaItem.format === "object" || typeof schemaItem.default === "object") {
			Object.keys(flatInstance)
				.filter(function(key) {
					return key.lastIndexOf(name + ".", 0) === 0;
				}).forEach(function(key) {
					delete flatInstance[key];
				});
		}

		if (!(typeof schemaItem.default === "undefined"
			&& instanceItem === schemaItem.default)) {
			try {
				schemaItem._format(instanceItem);
			} catch (err) {
				errors.invalid_type.push(err);
			}
		}
	});

	if (strictValidation) {
		Object.keys(flatInstance).forEach(function(name) {
			const err = new Error("configuration param '" + name
				+ "' not declared in the schema");
			errors.undeclared.push(err);
		});
	}

	return errors;
}

const BUILT_INS_BY_NAME = {
	"Object": Object,
	"Array": Array,
	"String": String,
	"Number": Number,
	"Boolean": Boolean,
	"RegExp": RegExp
};
const BUILT_IN_NAMES = Object.keys(BUILT_INS_BY_NAME);
const BUILT_INS = BUILT_IN_NAMES.map(function(name) {
	return BUILT_INS_BY_NAME[name];
});

function traverseSchema(schema, path) {
	const ar = path.split(".");
	let o = schema;
	while (ar.length > 0) {
		const k = ar.shift();
		if (o && o._juvyProperties && o._juvyProperties[k]) {
			o = o._juvyProperties[k];
		} else {
			o = null;
			break;
		}
	}

	return o;
}

function getFormat(schema, path) {
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
}

function coerce(k, v, schema) {
	// magic coerceing
	const format = getFormat(schema, k);

	if (typeof v === "string") {
		switch (format) {
			case "port":
			case "nat":
			case "integer": v = parseInt(v); break;
			case "number": v = parseFloat(v); break;
			case "boolean": v = String(v).toLowerCase() !== "false"; break;
			case "array": v = v.split(","); break;
			case "object": v = JSON.parse(v); break;
			case "regexp": v = new RegExp(v, "u"); break;
			default:
			// TODO: Should we throw an exception here?
		}
	}

	return v;
}

function walk(obj, path, initializeMissing?) {
	if (path) {
		const ar = path.split(".");
		while (ar.length) {
			const k = ar.shift();
			if (initializeMissing && obj[k] === null) {
				obj[k] = {};
				obj = obj[k];
			} else if (k in obj) {
				obj = obj[k];
			} else {
				throw new Error("cannot find configuration param '" + path + "'");
			}
		}
	}

	return obj;
}

class Juvy {
	private _def;
	private _schema = {
		"_juvyProperties": {}
	};
	private _env = {}
	private _argv = {}
	private _sensitive = new Set();
	private _instance = {}

	public constructor(def) {
		if (typeof def !== "string") {
			this._def = def;
		}

		Object.keys(this._def).forEach(function(name) {
			//normalizeSchema(k, this._def[k], this._schema._juvyProperties, k, this._env, this._argv, this._sensitive);
			//function normalizeSchema(name, node, props, fullName, env, argv, sensitive) {
			if (name === "_juvyProperties") {
				throw new Error("'" + fullName + "': '_juvyProperties' is reserved word of juvy.");
			}

			// If the current schema node is not a config property (has no "default"), recursively normalize it.
			if (typeof node === "object" && node !== null && !Array.isArray(node)
				&& Object.keys(node).length > 0 && !("default" in node)) {
				props[name] = {
					"_juvyProperties": {}
				};
				Object.keys(node).forEach(function(k) {
					normalizeSchema(k, node[k], props[name]._juvyProperties, fullName + "."
						+ k, env, argv, sensitive);
				});
				return;
			} else if (typeof node !== "object" || Array.isArray(node)
				|| node === null || Object.keys(node).length == 0) {
				// Normalize shorthand "value" config properties
				node = { "default": node };
			}

			const o = cloneDeep(node);
			props[name] = o;
			// associate this property with an environmental variable
			if (o.env) {
				if (!env[o.env]) {
					env[o.env] = [];
				}
				env[o.env].push(fullName);
			}

			// associate this property with a command-line argument
			if (o.arg) {
				if (argv[o.arg]) {
					throw new Error("'" + fullName + "' reuses a command-line argument: "
						+ o.arg);
				}
				argv[o.arg] = fullName;
			}

			// mark this property as sensitive
			if (o.sensitive === true) {
				sensitive.add(fullName);
			}

			// store original format function
			const format = o.format;
			let newFormat;

			if (BUILT_INS.includes(format) || BUILT_IN_NAMES.includes(format)) {
				// if the format property is a built-in JavaScript constructor,
				// assert that the value is of that type
				const Format = typeof format === "string" ? BUILT_INS_BY_NAME[format] : format;
				newFormat = function(x) {
					assert(Object.prototype.toString.call(x)
						=== Object.prototype.toString.call(new Format()), new Error("must be of type " + Format.name));
				};
				o.format = Format.name.toLowerCase();
			} else if (typeof format === "string") {
				// format can be a:
				// - predefined type, as seen below
				// - an array of enumerated values, e.g. ["production", "development", "testing"]
				// - built-in JavaScript type, i.e. Object, Array, String, Number, Boolean, RegExp
				// - or if omitted, the Object.prototype.toString.call of the default value

				const types = {
					"*": function() { },
					"integer": function(x) {
						assert(Number.isInteger(x), new Error("must be an integer"));
					},
					"nat": function(x) {
						assert(Number.isInteger(x) && x >= 0, new Error("must be a positive integer"));
					},
					"port": function(x) {
						assert(Number.isInteger(x) && x >= 0 && x <= 65535, new Error("ports must be within range 0 - 65535"));
					}
				};

				// store declared type
				if (!types[format]) {
					throw new Error("'" + fullName + "' uses an unknown format type: "
						+ format);
				}

				// use a predefined type
				newFormat = types[format];
			} else if (Array.isArray(format)) {
				// assert that the value is a valid option
				newFormat = assert(!options.includes(x), new Error("must be one of the possible values: " + JSON.stringify(options)));
			} else if (typeof format === "function") {
				newFormat = format;
			} else if (format && typeof format !== "function") {
				throw new Error("'" + fullName
					+ "': `format` must be a function or a known format type.");
			}

			if (!newFormat && !format) {
				// default format is the typeof the default value
				const type = Object.prototype.toString.call(o.default);
				newFormat = function(x) {
					assert(Object.prototype.toString.call(x) == type, new Error(" should be of type " + type.replace(/\[.* |]/g, "")));
				};
			}

			o._format = function(x) {
				// accept null if allowed before calling any format function
				if (this.nullable && x === null) {
					return;
				}

				try {
					newFormat(x, this);
				} catch (e) {
					// attach the value and the property's fullName to the error
					e.fullName = fullName;
					e.value = x;
					throw e;
				}
			};
			//}
		});

		(function addDefaultValues(schema, c, instance) {
			Object.keys(schema._juvyProperties).forEach(function(name) {
				const p = schema._juvyProperties[name];
				if (p._juvyProperties) {
					const kids = c[name] || {};
					addDefaultValues(p, kids, instance);
					c[name] = kids;
				} else {
					c[name] = coerce(name, cloneDeep(p.default), schema);
				}
			});
		})(this._schema, this._instance, this);

		//function importEnvironment(o) {
		const env = process.env;
		Object.keys(this._env).forEach(function(envStr) {
			if (env[envStr] !== undefined) {
				const ks = this._env[envStr];
				ks.forEach(function(k) {
					this.set(k, env[envStr]);
				});
			}
		});
		//}

		//function importArguments(o) {
		const argv = parseArgs(process.argv.slice(2), {
			"configuration": {
				"dot-notation": false
			}
		});

		Object.keys(this._argv).forEach(function(argStr) {
			const k = this._argv[argStr];
			if (argv[argStr] !== undefined) {
				this.set(k, String(argv[argStr]));
			}
		});
		//}
	}

	/**
	 * Exports the schema as JSON.
	 */
	//public getSchema() {
	//	return JSON.parse(JSON.stringify(this._schema));
	//}

	/**
	 * Exports the schema as a JSON string
	 */
	//public getSchemaString() {
	//	return JSON.stringify(this._schema, null, 2);
	//}

	/**
	 * @returns the current value of the name property. name can use dot
	 *     notation to reference nested values
	 */
	public get(path) {
		const o = walk(this._instance, path);
		return cloneDeep(o);
	}

	/**
	 * @returns the default value of the name property. name can use dot
	 *     notation to reference nested values
	 */
	//public default(path) {
	//	// The default value for FOO.BAR.BAZ is stored in `_schema._juvyProperties` at:
	//	//   FOO._juvyProperties.BAR._juvyProperties.BAZ.default
	//	path = path.split(".").join("._juvyProperties.") + ".default";
	//	const o = walk(this._schema._juvyProperties, path);
	//	return cloneDeep(o);
	//}

	/**
	 * Resets a property to its default value as defined in the schema
	 */
	//public reset(prop_name) {
	//	this.set(prop_name, this.default(prop_name));
	//}

	/**
	 * @returns true if the property name is defined, or false otherwise
	 */
	public has(path) {
		try {
			const r = this.get(path);
			// values that are set but undefined return false
			return typeof r !== "undefined";
		} catch (e) {
			return false;
		}
	}

	/**
	 * Sets the value of name to value. name can use dot notation to reference
	 * nested values, e.g. "database.port". If objects in the chain don't yet
	 * exist, they will be initialized to empty objects
	 */
	public set(k, v) {
		v = coerce(k, v, this._schema);
		const path = k.split(".");
		const childKey = path.pop();
		const parentKey = path.join(".");
		if (!(parentKey === "__proto__" || parentKey === "constructor" || parentKey === "prototype")) {
			const parent = walk(this._instance, parentKey, true);
			parent[childKey] = v;
		}
		return this;
	}

	/**
	 * Validates config against the schema used to initialize it
	 */
	public validate(options) {
		options = options || {};

		options.allowed = options.allowed || "warn";

		if (options.output && typeof options.output !== "function") {
			throw new Error("options.output is optional and must be a function.");
		}

		const errors = validate(this._instance, this._schema, options.allowed);

		if (errors.invalid_type.length + errors.undeclared.length + errors.missing.length) {
			const types_err_buf = this.fillErrorBuffer(errors.invalid_type);
			const params_err_buf = this.fillErrorBuffer(errors.undeclared);
			const missing_err_buf = this.fillErrorBuffer(errors.missing);

			const output_err_bufs = [types_err_buf, missing_err_buf];

			if (options.allowed === "warn" && params_err_buf.length) {
				console.warn("Warning: " + params_err_buf);
			} else if (options.allowed === "strict") {
				output_err_bufs.push(params_err_buf);
			}

			const output = output_err_bufs
				.filter(function(str) {
					return str.length;
				})
				.join("\n");

			if (output.length) {
				throw new Error(output);
			}
		}

		return this;
	}

	private fillErrorBuffer(errors) {
		let err_buf = "";

		for (const error of errors) {
			if (err_buf.length) {
				err_buf += "\n";
			}

			if (error.fullName) {
				err_buf += error.fullName + ": ";
			}
			if (error.message) {
				err_buf += error.message;
			}
			if (error.value && !sensitive.has(error.fullName)) {
				err_buf += ": value was " + JSON.stringify(error.value);
			}
		}
		return err_buf;
	}
}

export function juvy(schema) {
	return new Juvy(schema);
}
