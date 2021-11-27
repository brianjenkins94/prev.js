// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";

export function get(request: NextApiRequest, response: NextApiResponse): Promise<void> | void {
	// ../node_modules/next/dist/server/api-utils.js
	// response.(write|end|status|send|json|redirect)

	response.send("Hijacked!");
}
