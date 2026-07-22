import { readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";

const backendPort = Number(process.env.LOCAL_STAGING_BACKEND_PORT ?? "3101");
const proxyPort = Number(process.env.LOCAL_STAGING_HTTPS_PORT ?? "3443");
const pfxPath = process.env.LOCAL_STAGING_PFX_PATH?.trim();
const passphrase = process.env.LOCAL_STAGING_PFX_PASSPHRASE;

if (!pfxPath || !passphrase || !Number.isInteger(backendPort) || !Number.isInteger(proxyPort)) {
  throw new Error("LOCAL_STAGING_PROXY_CONFIGURATION_INVALID");
}

const server = https.createServer({ pfx: readFileSync(pfxPath), passphrase }, (request, response) => {
  const headers = { ...request.headers };
  delete headers.forwarded;
  delete headers["x-forwarded-for"];
  delete headers["x-forwarded-host"];
  delete headers["x-forwarded-proto"];
  delete headers["x-real-ip"];
  headers.host = "staging.localhost";
  headers["x-forwarded-for"] = request.socket.remoteAddress ?? "127.0.0.1";
  headers["x-real-ip"] = request.socket.remoteAddress ?? "127.0.0.1";
  headers["x-forwarded-host"] = "staging.localhost";
  headers["x-forwarded-proto"] = "https";
  const upstream = http.request({
    host: "127.0.0.1",
    port: backendPort,
    method: request.method,
    path: request.url,
    headers
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });
  upstream.on("error", () => {
    if (!response.headersSent) response.writeHead(502, { "cache-control": "no-store" });
    response.end("Local staging upstream unavailable");
  });
  request.pipe(upstream);
});

server.listen(proxyPort, "127.0.0.1", () => {
  console.log(`LOCAL_STAGING_PROXY_READY https://127.0.0.1:${proxyPort}`);
});
