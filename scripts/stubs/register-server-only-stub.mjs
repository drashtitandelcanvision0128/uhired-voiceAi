import { createRequire } from "node:module";
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const stubCjs = join(dir, "server-only-stub.cjs");

const require = createRequire(import.meta.url);
try {
  const resolved = require.resolve("server-only");
  require.cache[resolved] = {
    id: resolved,
    path: resolved,
    exports: {},
    loaded: true,
    children: [],
    filename: resolved,
  };
} catch {
  // server-only not installed — tests may still run.
}

register(pathToFileURL(join(dir, "server-only-hook.mjs")).href);
