import * as fs from "fs";
import * as path from "path";
import * as url from "url";

import { juvy } from "./config";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
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

export const config = juvy(await (async function bindConfigurations(directory) {
	const schema = [];

	await (async function recurse(directory) {
		for (const file of fs.readdirSync(directory)) {
			if (fs.statSync(path.join(directory, file)).isDirectory()) {
				await recurse(path.join(directory, file));
			} else if (path.extname(file).toLowerCase() === ".ts") {
				let namespace;

				if (file === "index.ts") {
					namespace = directory.substring(__dirname.length + 1).replace(/\\/gu, "/").split(/\//gu);
				} else {
					namespace = [...directory.substring(__dirname.length + 1).replace(/\\/gu, "/").split(/\//gu), path.basename(file, path.extname(file))];
				}

				const options = (await import(path.join(directory, file)))["default"];

				if (!Array.isArray(options)) {
					continue;
				}

				convictify(options, namespace);
			}
		}
	})(directory);

	return schema;
})(__dirname));
