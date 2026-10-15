import { mkdirSync } from "node:fs";
mkdirSync(".private-data", { recursive: true, mode: 0o700 });
console.log("Private development directory ready; no database changed.");
