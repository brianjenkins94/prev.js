import { apiResolver } from "next/dist/server/api-utils";
import { createServer } from "http";
import * as fs from "fs";
import * as path from "path";
import * as url from "url";
import * as Eta from "eta";
import next from "next";

import { config } from "./config";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (fs.existsSync(path.join(__dirname, "views"))) {
	Eta.config.views = path.join(__dirname, "views");
}

process.on("uncaughtException", function(error) {
	console.error(error.stack);

	//await postMessageToChannel("```" + error.stack + "```", "#general");

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
app.server.router.fsRoutes.push(...await (async function routeify(routesDirectory) {
	const routes = [];

	await (async function breadthFirstSearch(queue) {
		const nextQueue = {};

		const routeLayer = {};

		for (const [directory, files] of Object.entries(queue)) {
			for (let file of files) {
				file = path.join(directory, file);

				const parsedPath = path.parse(file.substring(routesDirectory.length));
				let pathName = parsedPath.dir;

				if (parsedPath.name !== "index") {
					pathName = path.join(pathName, parsedPath.name);
				}

				pathName = pathName.replace(/\\/gu, "/");

				if (fs.statSync(file).isDirectory()) {
					nextQueue[file] = fs.readdirSync(file);
				} else {
					if (file.endsWith("_middleware.ts")) {
						throw new Error("Not yet implemented");
					}

					routeLayer[pathName] = {};

					const routeHandler = await import(file);

					for (const exportName of Object.keys(routeHandler)) {
						if (/middleware$/iu.test(exportName)) {
							throw new Error("Not yet implemented");
						}

						let method = (/^(?:connect|del(?:ete)?|get|head|options|patch|post|put|trace)/u.exec(exportName) || [])[0];

						if (method === undefined) {
							continue;
						}

						if (method === "del") {
							method = "delete";
						}

						routeLayer[pathName][method] = routeHandler[method];
					}
				}
			}
		}

		routes.push(...(function processRouteLayer(routeHandlers) {
			const routes = [];

			for (const [pathName, routeHandler] of Object.entries(routeHandlers)) {
				routes.push({
					"type": "route",
					"name": pathName,
					"match": function(pathname) {
						// TODO: Improve?
						return new RegExp(pathName.replace(/\[.*?\]+/gu, "(.*)"), "u").test(pathname);
					},
					"fn": async function(request, response, _, parsedUrl) {
						response.render = function(fileName, data) {
							Eta.renderFile(fileName, data, function(error, string) {
								if (error !== undefined) {
									throw error;
								}

								response.send(string);
							});
						};

						// @ts-expect-error
						await apiResolver(request, response, parsedUrl.query, function(request: NextApiRequest, response: NextApiResponse) {
							if (routeHandler[request.method.toLowerCase()] !== undefined) {
								routeHandler[request.method.toLowerCase()](request, response);
							} else {
								response.status(405);
							}
						});

						return { "finished": true };
					}
				});
			}

			return routes;
		})(routeLayer));

		if (Object.keys(nextQueue).length > 0) {
			await breadthFirstSearch(nextQueue);
		}
	})({ [routesDirectory]: fs.readdirSync(routesDirectory) });

	return routes;
})(path.join(__dirname, "routes")));

createServer(app.getRequestHandler()).listen(config.get("port"), function() {
	console.log("> Ready on http://localhost:" + config.get("port"));
});

// HACK: https://github.com/vercel/next.js/issues/9607
fs.writeFileSync(path.join(__dirname, ".next", "package.json"), JSON.stringify({ "type": "CommonJS" }, undefined, 2));
