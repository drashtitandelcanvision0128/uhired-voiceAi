import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const stubUrl = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "server-only-stub.mjs")).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: stubUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
