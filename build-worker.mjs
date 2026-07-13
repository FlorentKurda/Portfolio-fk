import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL(".", import.meta.url);
const dist = new URL("dist/", root);
const serverDir = new URL("dist/server/", root);
const clientDir = new URL("dist/client/", root);

const files = [
  { route: "/", path: "index.html", type: "text/html; charset=utf-8" },
  { route: "/index.html", path: "index.html", type: "text/html; charset=utf-8" },
  { route: "/styles.css", path: "styles.css", type: "text/css; charset=utf-8" },
  { route: "/script.js", path: "script.js", type: "text/javascript; charset=utf-8" },
  { route: "/assets/data/projects.json", path: "assets/data/projects.json", type: "application/json; charset=utf-8" },
  { route: "/assets/img/logo-fk.png", path: "assets/img/logo-fk.png", type: "image/png" },
  { route: "/assets/img/logo-fk.svg", path: "assets/img/logo-fk.svg", type: "image/svg+xml" },
  { route: "/assets/img/project-cabinet-infirmier.png", path: "assets/img/project-cabinet-infirmier.png", type: "image/png" },
  { route: "/assets/img/project-domaine-viticole.png", path: "assets/img/project-domaine-viticole.png", type: "image/png" },
  { route: "/assets/img/project-photographe-nature.png", path: "assets/img/project-photographe-nature.png", type: "image/png" },
  { route: "/assets/img/project-restaurant-bistrot.png", path: "assets/img/project-restaurant-bistrot.png", type: "image/png" },
  { route: "/assets/img/project-spa.png", path: "assets/img/project-spa.png", type: "image/png" },
];

await rm(dist, { recursive: true, force: true });
await mkdir(serverDir, { recursive: true });
await mkdir(clientDir, { recursive: true });
await mkdir(new URL("dist/client/assets/img/", root), { recursive: true });
await mkdir(new URL("dist/.openai/", root), { recursive: true });

const manifest = [];

for (const file of files) {
  const source = new URL(file.path, root);
  const bytes = await readFile(source);
  manifest.push({
    route: file.route,
    type: file.type,
    body: bytes.toString("base64"),
  });

  if (file.route !== "/") {
    const destination = new URL(`dist/client${file.route}`, root);
    await mkdir(dirname(fileURLToPath(destination)), { recursive: true });
    await copyFile(source, destination);
  }
}

await copyFile(new URL(".openai/hosting.json", root), new URL("dist/.openai/hosting.json", root));

const workerSource = `const files = new Map(${JSON.stringify(manifest, null, 2)}.map((file) => [file.route, file]));

const securityHeaders = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "SAMEORIGIN",
};

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith("/")) path += "index.html";
    if (path === "/index.html") path = "/";

    const asset = files.get(path) ?? files.get(url.pathname) ?? files.get("/");
    const headers = new Headers(securityHeaders);
    headers.set("content-type", asset.type);
    headers.set("cache-control", asset.type.startsWith("image/") ? "public, max-age=31536000, immutable" : "public, max-age=300");

    return new Response(decodeBase64(asset.body), { headers });
  },
};
`;

await writeFile(new URL("dist/server/index.js", root), workerSource);

await writeFile(
  new URL("dist/client/manifest.json", root),
  JSON.stringify({ files: files.map(({ route, path, type }) => ({ route, path, type })) }, null, 2),
);

console.log(`Built ${files.length} static routes into ${join("dist", "server", "index.js")}`);
