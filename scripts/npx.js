#!/usr/bin/env node

import * as path from "path";
import * as url from "url";
import { main as spawn } from "ts-node/dist/bin"

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let baseDirectory = path.join(__dirname, "..");

spawn(["--esm", path.join(baseDirectory, "prev.ts"), ...process.argv.slice(2)]);
