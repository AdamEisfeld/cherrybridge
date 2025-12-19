#!/usr/bin/env node
import { runCLI } from "./cli.js";

runCLI().catch((err) => {
	console.error(err?.stack || err);
	process.exit(1);
});


