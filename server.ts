import { createServer } from "http";
import * as fs from "fs";
import * as path from "path";
import next from "next";
import { apiResolver } from "next/dist/server/api-utils";

//const __filename = url.fileURLToPath(import.meta.url);
//const __dirname = path.dirname(__filename);

const dev = process.env["NODE_ENV"] !== "production";

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
	"dev": dev
});

app.prepare().then(async function() {
	// @ts-expect-error
	app.server.router.fsRoutes.push(...await (async function(routesDirectory) {
		const files = [];

		(function recurse(directory) {
			for (const file of fs.readdirSync(directory)) {
				if (fs.statSync(path.join(directory, file)).isDirectory()) {
					recurse(path.join(directory, file));
				} else if (path.extname(file).toLowerCase() === ".ts") {
					files.push(path.join(directory, file));
				}
			}
		})(routesDirectory);

		const routes = [];

		for (const file of files) {
			if (file.endsWith("middleware.ts")) {
				throw new Error("Not yet implemented.");
			}

			const routeHandlers = {};

			const route = await import(file);

			const parsedPath = path.parse(file.substring(routesDirectory.length));
			let pathName = parsedPath.dir;

			for (const routeHandler of Object.keys(route)) {
				let method = (/^(?:connect|del(?:ete)?|get|head|options|patch|post|put|trace)/u.exec(routeHandler) || [])[0];

				if (method === undefined) {
					continue;
				}

				if (method === "del") {
					method = "delete";
				}

				if (parsedPath.name !== "index") {
					pathName = path.join(pathName, parsedPath.name);
				}

				pathName = pathName.replace(/\\/gu, "/");

				console.log("Binding " + method.toUpperCase() + " " + pathName);

				routeHandlers[method] = route[routeHandler];
			}

			routes.push({
				"type": "route",
				"name": pathName,
				"match": function(pathname) {
					return pathname === pathName;
				},
				"fn": async function(request, response, _, parsedUrl) {
					// @ts-expect-error
					await apiResolver(request, response, parsedUrl.query, function(request: NextApiRequest, response: NextApiResponse) {
						routeHandlers[request.method.toLowerCase()](request, response);
					});

					return { "finished": true };
				}
			});
		}

		return routes;
	})(path.join(__dirname, "routes")));

	createServer(app.getRequestHandler()).listen(3000, function() {
		console.log("> Ready on http://localhost:3000");
	});
});
