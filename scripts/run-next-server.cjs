const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const cwd = path.resolve(__dirname, "..");
const out = fs.openSync(path.join(cwd, "next-managed.log"), "a");
const err = fs.openSync(path.join(cwd, "next-managed.err.log"), "a");
const nextBin = path.join(cwd, "node_modules", "next", "dist", "bin", "next");

function start() {
  const child = spawn(process.execPath, [nextBin, "start", "-H", "127.0.0.1", "-p", "3000"], {
    cwd,
    env: {
      ...process.env,
      PATH: process.env.Path || process.env.PATH || ""
    },
    stdio: ["ignore", out, err],
    windowsHide: true
  });

  child.on("exit", (code, signal) => {
    fs.writeSync(err, `next child exited code=${code} signal=${signal}\n`);
    setTimeout(start, 1000);
  });
}

start();
setInterval(() => {}, 60_000);
