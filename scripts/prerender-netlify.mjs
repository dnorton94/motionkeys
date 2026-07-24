import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const root = process.cwd();
const outputDir = join(root, "netlify-dist");
const clientDir = join(root, "dist", "client");
const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("prerender", `${process.pid}-${Date.now()}`);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".wasm", "application/wasm"],
  [".webp", "image/webp"],
]);

async function assetFetch(request) {
  const url = new URL(request.url);
  const relativePath = decodeURIComponent(url.pathname.replace(/^\/+/, ""));

  try {
    const body = await readFile(join(clientDir, relativePath));
    return new Response(body, {
      headers: {
        "content-type": contentTypes.get(extname(relativePath)) ?? "application/octet-stream",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

await rm(outputDir, { force: true, recursive: true });
await mkdir(outputDir, { recursive: true });
await cp(clientDir, outputDir, { recursive: true });

const { default: worker } = await import(workerUrl.href);
const response = await worker.fetch(
  new Request("https://motionkeys-piano.netlify.app/", {
    headers: { accept: "text/html" },
  }),
  { ASSETS: { fetch: assetFetch } },
  {
    passThroughOnException() {},
    waitUntil() {},
  },
);

if (!response.ok) {
  throw new Error(`Prerender failed with HTTP ${response.status}`);
}

await writeFile(join(outputDir, "index.html"), await response.text());
