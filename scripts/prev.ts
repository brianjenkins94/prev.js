import { createInterface } from "readline";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const argv = (function parseArgs(args) {
	const argv = {};

	args = args.join(" ").match(/-(.*?)(?= +-|$)/gu) || [];

	for (let x = 0; x < args.length; x++) {
		const arg = args[x];

		if (arg[1] !== "-") {
			for (const shorthand of arg.substring(1).split("")) {
				argv[shorthand] = true;
			}

			continue;
		} else if (arg.length === 2) {
			break;
		}

		const value = arg.split(/ +|=/u);
		const key = value.shift().replace(/^-+/u, "");

		argv[key] = value.join(" ") ?? (args[x + 1] === undefined || args[x + 1].startsWith("-") || args[x + 1]);
	}

	return argv;
})(process.argv);

for (const [shorthand, alias] of Object.entries({
	"d": "dry-run",
	"r": "recursive",
	"t": "retab",
	"u": "update",
	"x": "exclude",
	"y": "yes"
})) {
	argv[alias] = argv[shorthand];

	delete argv[shorthand];
}

argv["exclude"] = argv["exclude"] ?? ["package.json", "package-lock.json"];

let readline;

if (argv["yes"] !== true) {
	readline = createInterface({
		"input": process.stdin,
		"output": process.stdout
	});
}

const prevDirectory = path.join(__dirname);
const baseDirectory = process.cwd();

function confirm(prompt, defaultOption = true) {
	return new Promise(function(resolve, reject) {
		readline.question(prompt + (defaultOption ? " [Y/n] " : " [y/N] "), async function(answer) {
			if (/^y(es)?$/iu.test(answer) || (answer === "" && defaultOption)) {
				resolve(true);
			} else if (/^n(o)?$/iu.test(answer) || (answer === "" && defaultOption)) {
				resolve(false);
			} else {
				resolve(await confirm(prompt, defaultOption));
			}
		});
	});
}

async function update(directory = baseDirectory) {
	if (prevDirectory === directory) {
		return;
	}

	for (const file of [[".eslintrc.json"], ["tsconfig.json"], [".vscode", "extensions.json"], [".vscode", "settings.json"]]) {
		if (fs.existsSync(path.join(directory, ...file))) {
			if (argv["yes"] === true || (await confirm("Overwrite `" + path.join(directory, ...file) + "`?")) === true) {
				fs.copyFileSync(path.join(prevDirectory, ...file), path.join(directory, ...file));
			}
		}
	}
}

function findRepositories(baseDirectory) {
	const repositories = [];

	(function recurse(directory) {
		for (const file of fs.readdirSync(directory)) {
			if (fs.statSync(path.join(directory, file)).isDirectory()) {
				if (file === ".git") {
					repositories.push(directory);
				}

				if (file !== "node_modules") {
					recurse(path.join(directory, file));
				}
			}
		}
	})(baseDirectory);

	return repositories;
}

function findRepositoryTextFiles(cwd = baseDirectory) {
	const options = {
		"cwd": cwd,
		"encoding": "utf8"
	};

	if (process.platform === "win32") {
		const bash = path.join(process.env["ProgramW6432"], "Git", "usr", "bin", "bash.exe");
		const wsl = path.join(process.env["windir"], "System32", "bash.exe");

		if (fs.existsSync(bash)) {
			options["env"] = {
				"PATH": "/mingw64/bin:/usr/local/bin:/usr/bin:/bin"
			};

			options["shell"] = bash;
		} else if (fs.existsSync(wsl)) {
			const { root, dir, base } = path.parse(cwd);

			options["cwd"] = path.join("/", "mnt", root.split(":")[0].toLowerCase(), dir.substring(root.length), base).replace(/\\/gu, "/");

			options["shell"] = wsl;
		} else {
			throw new Error("No suitable shell found. Aborting.");
		}
	}

	const files = execSync("git ls-files", options).split("\n");
	const textFiles = [];

	for (const file of files) {
		if (/text/gu.test(execSync("file \"" + cwd + "/" + file + "\"", options))) {
			textFiles.push(file);
		}
	}

	return textFiles;
}

function retab(file) {
	fs.readFile(file, "utf8", function(error, data) {
		// Convert leading, trim trailing
		data = data.replace(/^\t+/gmu, function(match) {
			return " ".repeat(match.length * 4);
		}).replace(/[ \t]+$/gmu, "");

		const indentationWidth = (/^ {2,}/mu.exec(data) || [""])[0].length;

		data = data.split("\n");

		let indentationLevel = 0;

		let errors = "";

		for (let x = 0; x < data.length; x++) {
			const [indentation, firstToken] = (/^\s{2,}?\S+/u.exec(data[x]) || [""])[0].split(/(\S+)/u, 2);
			const lastToken = data[x].split(/(\S+)$/u, 2).pop();

			if (data[x] !== "" || indentationLevel === indentation.length / indentationWidth) {
				if (indentation.length === ((indentationLevel + 1) * indentationWidth)) {
					indentationLevel += 1;
				} else if (indentation.length === ((indentationLevel - 1) * indentationWidth)) {
					indentationLevel -= 1;
				} else if (indentation.length === ((indentationLevel - 2) * indentationWidth)) {
					// Big jump, but not unreasonable
					indentationLevel = indentation.length / indentationWidth;
				} else if (indentation.length !== ((indentationLevel) * indentationWidth)
					&& indentation.length % indentationWidth === 0) {
					if (errors === "") {
						errors += file + "\n";
					}

					errors += "    at " + file + ":" + (x + 1) + " - Unexpected indentation jump\n";

					indentationLevel = indentation.length / indentationWidth;
				}
			}
		}

		if (errors !== "") {
			console.error(errors);
		}

		// Ensure newline at EOF
		if (data[data.length - 1] !== "") {
			data.push("");
		}

		data = data.join("\n");

		if (indentationWidth >= 2 && !file.toLowerCase().endsWith(".md")) {
			data = data.replace(new RegExp("^( {" + indentationWidth + "})+", "gmu"), function(match) {
				return "\t".repeat(match.length / indentationWidth);
			});
		}

		if (argv["dry-run"] !== true) {
			fs.writeFile(file, data, function(error) { });
		}
	});
}

if (argv["recursive"] === true && argv["update"] === true) {
	const repositories = findRepositories(baseDirectory);

	for (const repository of repositories) {
		await update(repository);
	}

	if (argv["retab"] === true) {
		for (const repository of repositories) {
			const files = findRepositoryTextFiles(repository).filter(function(file) {
				return !argv["exclude"].includes(path.basename(file));
			});

			for (const file of files) {
				retab(path.join(repository, file));
			}
		}
	}
} else if (argv["update"] === true) {
	if (!fs.existsSync(path.join(baseDirectory, "package.json"))) {
		if (await confirm("Are you sure you're in the right place?", false)) {
			update();
		}
	}
} else {
	const dependencies = ["typescript", "ts-node", "@types/node"];
	const devDependencies = ["eslint", "@typescript-eslint/eslint-plugin", "@typescript-eslint/parser"];

	if (!fs.existsSync(path.join(baseDirectory, "package.json"))) {
		execSync("npm init", { "cwd": baseDirectory, "stdio": "inherit" });
		console.log();
	}

	fs.mkdirSync(path.join(baseDirectory, "config"), { "recursive": true });
	fs.mkdirSync(path.join(baseDirectory, "config", "dev"), { "recursive": true });
	fs.mkdirSync(path.join(baseDirectory, "config", "prod"), { "recursive": true });
	fs.mkdirSync(path.join(baseDirectory, "config", "dev", "example"), { "recursive": true });
	fs.mkdirSync(path.join(baseDirectory, "config", "prod", "example"), { "recursive": true });

	fs.copyFileSync(path.join(prevDirectory, "dotfiles", "config", "index.ts"), path.join(baseDirectory, "config", "index.ts"));
	fs.copyFileSync(path.join(prevDirectory, "dotfiles", "config", "dev", "example", "index.ts"), path.join(baseDirectory, "config", "dev", "index.ts"));
	fs.copyFileSync(path.join(prevDirectory, "dotfiles", "config", "prod", "example", "index.ts"), path.join(baseDirectory, "config", "prod", "index.ts"));

	fs.copyFileSync(path.join(prevDirectory, ".eslintrc.json"), path.join(baseDirectory, ".eslintrc.json"));
	fs.copyFileSync(path.join(prevDirectory, "tsconfig.json"), path.join(baseDirectory, "tsconfig.json"));

	fs.mkdirSync(path.join(baseDirectory, ".vscode"), { "recursive": true });

	fs.copyFileSync(path.join(prevDirectory, ".vscode", "extensions.json"), path.join(baseDirectory, ".vscode", "extensions.json"));

	fs.copyFileSync(path.join(prevDirectory, ".vscode", "settings.json"), path.join(baseDirectory, ".vscode", "settings.json"));

	if (readline !== undefined) {
		readline.close();
	}

	console.log("> npm install " + dependencies.join(" ") + "\n");
	execSync("npm install " + dependencies.join(" "), { "cwd": baseDirectory, "stdio": "inherit" });

	console.log("> npm install --save-dev " + devDependencies.join(" ") + "\n");
	execSync("npm install --save-dev " + devDependencies.join(" "), { "cwd": baseDirectory, "stdio": "inherit" });
}