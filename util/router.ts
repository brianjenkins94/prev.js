import { apiResolver } from "next/dist/server/api-utils";
import { render } from "./renderer";

import * as fs from "fs";
import * as path from "path";
import * as url from "url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function processRouteLayer(routeHandlers) {
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
					const file = path.join(__dirname, "..", "views", fileName + ".ejs");

					if (fs.existsSync(file)) {
						response.send(render(fs.readFileSync(file, { "encoding": "utf8" }), data));
					} else {
						response.status(404);
					}
				};

				/// @ts-expect-error
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
}

export async function routeify(routesDirectory) {
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

					const routeHandler = await import(url.pathToFileURL(file).toString());

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

		routes.push(...processRouteLayer(routeLayer));

		if (Object.keys(nextQueue).length > 0) {
			await breadthFirstSearch(nextQueue);
		}
	})({ [routesDirectory]: fs.readdirSync(routesDirectory) });

	return routes;
}
