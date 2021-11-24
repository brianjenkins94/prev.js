import { createServer } from "http";
import { parse } from "url";
import next from "next";

const dev = process.env["NODE_ENV"] !== "production";

const app = next({
	"conf": {
		"useFileSystemPublicRoutes": false
	},
	"dev": dev
});

const handle = app.getRequestHandler();

await app.prepare();

createServer(function(request, response) {
	// @ts-expect-error
	const parsedUrl = parse(request.url, true);
	const { pathname, query } = parsedUrl;

	if (pathname === "/a") {
		app.render(request, response, "/a", query);
	} else if (pathname === "/b") {
		app.render(request, response, "/b", query);
	} else {
		handle(request, response, parsedUrl);
	}
}).listen(3000, function() {
	console.log("> Ready on http://localhost:3000");
});
