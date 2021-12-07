import * as fs from "fs";
import * as path from "path";
import * as url from "url";

import { juvy } from "juvy";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schema = {
	"env": {
		"format": ["production", "development", "test"],
		"default": "development",
		"env": "NODE_ENV",
		"arg": "env"
	},
	"port": {
		"format": "port",
		"default": 3000,
		"env": "PORT",
		"arg": "port"
	}
};

await (async function recurse(directory, parent) {
	for (const file of fs.readdirSync(directory)) {
		if (fs.statSync(path.join(directory, file)).isDirectory()) {
			parent[file] = {};

			await recurse(path.join(directory, file), parent[file]);
		} else if (path.join(directory, file) === path.join(__dirname, "index.ts")) {
			continue;
		} else if (path.extname(file).toLowerCase() === ".ts") {
			if (file !== "index.ts") {
				const key = path.basename(file, path.extname(file));

				parent[key] = {};

				parent = parent[key];
			}

			(function recurse(options, parent) {
				for (const [name, option] of Object.entries(options)) {
					if (!Object.prototype.hasOwnProperty.call(option, "default")) {
						recurse(option, parent[name]);
					} else {
						const namespace = directory.substring(__dirname.length + 1).replace(/\\/gu, "/").slice(1).split(/\//gu);

						const env = option["env"] || namespace.join("_").toUpperCase();
						const arg = option["arg"] || namespace.join("-");

						// For third-party scripts that make direct access to `process.env.*`
						if (process.env[env] === undefined) {
							process.env[env] = JSON.stringify(option["default"]);
						}

						parent[name] = {
							"format": option["format"] || "String",
							"default": option["default"],
							"env": env,
							"arg": arg
						};
					}
				}
			})((await import(path.join(directory, file)))["default"], parent);
		}
	}
})(__dirname, schema);

export const config = juvy(schema);

config.validate({ "strict": true });
