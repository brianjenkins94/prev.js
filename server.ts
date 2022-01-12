import { createServer } from "http";
import * as fs from "fs";
import * as path from "path";
import * as url from "url";
import next from "next";

import { config } from "./config";
import { routeify } from "./util/router";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.on("uncaughtException", function(error) {
	console.error(error.stack);

	//await postMessageToSlackChannel("```" + error.stack + "```", "#general");

	process.exit(1);
});

for (const signal of ["SIGINT", "SIGUSR1", "SIGUSR2"]) {
	process.on(signal, function() {
		process.exit(0);
	});
}

const app = next({
	"conf": {
		"reactStrictMode": true,
		"redirects": async function() {
			return [];
		},
		"rewrites": async function() {
			return [];
		}
	},
	"dev": true
});

await app.prepare();

// @ts-expect-error
app.server.router.fsRoutes.push(...await routeify(path.join(__dirname, "routes")));

createServer(app.getRequestHandler()).listen(config.get("port"), function() {
	console.log("> Ready on http://localhost:" + config.get("port"));
});

// HACK: https://github.com/vercel/next.js/issues/9607
fs.writeFileSync(path.join(__dirname, ".next", "package.json"), JSON.stringify({ "type": "CommonJS" }, undefined, 2));
