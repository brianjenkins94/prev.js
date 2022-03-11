#!/usr/bin/env node

const path = require("path");
const spawn = require("ts-node/dist/bin").main;

spawn(["--esm", path.join(__dirname, "prev.ts"), ...process.argv.slice(2)]);
