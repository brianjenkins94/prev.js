#!/usr/bin/env node

import { spawnSync } from "child_process";
import * as path from "path";
import * as url from "url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let directory = __dirname;

const options = {
	"cwd": process.cwd(),
	"encoding": "utf8",
	"env": {
		...process.env,
		"TS_NODE_PROJECT": path.join(directory, "tsconfig.json"), // https://github.com/TypeStrong/ts-node/pull/1655
		"TS_NODE_SKIP_IGNORE": true
	},
	"stdio": "inherit"
};

if (process.platform === "win32") {
	const bash = path.join(process.env.ProgramW6432, "Git", "usr", "bin", "bash.exe");
	const wsl = path.join(process.env.windir, "System32", "bash.exe");

	if (fs.existsSync(bash)) {
		options["env"] = {
			"PATH": "/mingw64/bin:/usr/local/bin:/usr/bin:/bin"
		};

		options["shell"] = bash;
	} else if (fs.existsSync(wsl)) {
		const { root, dir, base } = path.parse(directory);

		directory = "/mnt/" + root.split(":")[0].toLowerCase() + "/" + dir.substring(root.length).replace(/\\/g, "/") + "/" + base;

		options["shell"] = wsl;
	} else {
		throw new Error("No suitable shell found. Aborting.");
	}
}

const command = [
	"node",
	//"--experimental-specifier-resolution=node",
	"--loader=" + path.join(directory, "..", "ts-node", "esm.mjs"),
	path.join(directory, "hello.ts"),
	...process.argv.slice(2)
];

console.log("\n> " + command.join(" ") + "\n");

spawnSync(command[0], command.slice(1), options);
