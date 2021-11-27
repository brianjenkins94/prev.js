import { createServer } from "http";
import * as fs from "fs";
import * as path from "path";
import next from "next";
import { apiResolver } from "next/dist/server/api-utils";

//const __filename = url.fileURLToPath(import.meta.url);
//const __dirname = path.dirname(__filename);

process.on("uncaughtException", async function(error) {
	console.error("We have a little problem with our entry sequence, so we may experience some slight turbulence, and then explode.");

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
		},
		"webpack": function(config, options) {
			config.output.environment = {
				"arrowFunction": true,
				"bigIntLiteral": true,
				"const": true,
				"destructuring": true,
				"dynamicImport": true,
				"forOf": true,
				"module": true
			};

			return config;
		}
	},
	"dev": true
});

async function routeify(routesDirectory) {
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
					routeLayer[pathName] = {};

					const routeHandler = await import(file);

					for (const name of Object.keys(routeHandler)) {
						let method = (/^(?:connect|del(?:ete)?|get|head|options|patch|post|put|trace)/u.exec(name) || [])[0];

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

		routes.push(...(function processRoute(routeHandlers) {
			const routes = [];

			for (const [pathName, routeHandler] of Object.entries(routeHandlers)) {
				routes.push({
					"type": "route",
					"name": pathName,
					"match": function(pathname) {
						// TODO: Improve
						return pathname === pathName;
					},
					"fn": async function(request, response, _, parsedUrl) {
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
}

app.prepare().then(async function() {
	// @ts-expect-error
	app.server.router.fsRoutes.push(...await routeify(path.join(__dirname, "routes")));

	createServer(app.getRequestHandler()).listen(3000, function() {
		console.log("> Ready on http://localhost:3000");
	});
});
