/**
 * Minimal static server for the assembled tree.
 *
 * Deliberately dependency-free (`node:http` only) and deliberately does not
 * serve a directory index. The published root's `index.html` IS the live site
 * at benchmarks.vlt.sh, and this app must never be the thing that puts an
 * index page there.
 */
import { createServer, type Server } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { join, normalize, resolve, sep } from "node:path";

const CONTENT_TYPES: { [extension: string]: string | undefined } = {
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".log": "text/plain; charset=utf-8",
};

export interface ServeOptions {
  root: string;
  port: number;
  host?: string;
}

/** Resolve a request path to a file inside root, or undefined if it escapes. */
export const resolveRequestPath = (root: string, urlPath: string): string | undefined => {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return undefined;
  }
  if (decoded.includes("\0")) return undefined;

  const rootAbs = resolve(root);
  const candidate = resolve(join(rootAbs, normalize(decoded)));
  if (candidate !== rootAbs && !candidate.startsWith(rootAbs + sep)) return undefined;
  return candidate;
};

export const createDataServer = (options: ServeOptions): Server =>
  createServer((request, response) => {
    const urlPath = new URL(request.url ?? "/", "http://localhost").pathname;
    const filePath = resolveRequestPath(options.root, urlPath);

    if (filePath === undefined) {
      response.writeHead(400, { "content-type": "text/plain" });
      response.end("bad request\n");
      return;
    }

    let isFile = false;
    try {
      isFile = statSync(filePath).isFile();
    } catch {
      isFile = false;
    }

    if (!isFile) {
      // No directory listing and no index fallback, on purpose.
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("not found\n");
      return;
    }

    const dot = filePath.lastIndexOf(".");
    const extension = dot === -1 ? "" : filePath.slice(dot);
    response.writeHead(200, {
      "content-type": CONTENT_TYPES[extension] ?? "application/octet-stream",
      "access-control-allow-origin": "*",
    });
    createReadStream(filePath).pipe(response);
  });
