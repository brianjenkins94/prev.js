import type { NextApiRequest, NextApiResponse } from "next";

export function get(request: NextApiRequest, response: NextApiResponse): Promise<void> | void {
	// ../node_modules/next/dist/server/api-utils.js:67
	// response.(write|end|status|send|json|redirect)

	response.status(200).send("OK");
}
