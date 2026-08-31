#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const imageReference = process.env.OCR_WORKER_IMAGE || "nalanda-ocr-worker:1b";
const inspected = JSON.parse(command("docker", ["image", "inspect", imageReference, "--format", "{{json .}}"]));
const imageId = inspected.Id;
if (!/^sha256:[a-f0-9]{64}$/.test(imageId)) throw new Error("OCR_IMAGE_ID_INVALID");
if (inspected.Config.User !== "65532:65532") throw new Error("OCR_IMAGE_NON_ROOT_USER_REQUIRED");
if (JSON.stringify(inspected.Config.Entrypoint) !== JSON.stringify(["python", "/runtime/main.py"])) throw new Error("OCR_IMAGE_ENTRYPOINT_INVALID");
if (inspected.Config.ExposedPorts && Object.keys(inspected.Config.ExposedPorts).length) throw new Error("OCR_IMAGE_PUBLIC_PORT_PROHIBITED");
if (inspected.Config.Labels?.["nalanda.ocr.base-image-digest"] !== "sha256:33ceb71981b602c1a7443a53469e4dba065f7503eab3078a2d7a57a2ab987517") throw new Error("OCR_IMAGE_BASE_DIGEST_INVALID");
if (inspected.Config.Labels?.["nalanda.ocr.paddle-wheel-sha256"] !== "b1500120002c2bf4542c841e25296cf10c52e0d395053aa395f79bd9c0303cce") throw new Error("OCR_IMAGE_PADDLE_WHEEL_DIGEST_INVALID");

const probe = String.raw`
import hashlib, hmac, json, pathlib, pyexpat, shutil, ssl, subprocess

def package(name):
    package_format = "$" + "{Status}|$" + "{Version}"
    value = subprocess.run(["dpkg-query", "-W", "-f", package_format, name], capture_output=True, text=True)
    return {"installed": value.returncode == 0, "value": value.stdout.strip()}

packages = {name: package(name) for name in ("perl-base", "libexpat1", "libp11-kit0", "libssl3t64", "openssl")}
if packages["perl-base"]["installed"] or shutil.which("perl"):
    raise RuntimeError("OCR_PERL_RUNTIME_PROHIBITED")
if any("IO/Compress" in str(path) for path in pathlib.Path("/usr").rglob("*")):
    raise RuntimeError("OCR_IO_COMPRESS_PROHIBITED")
if packages["libexpat1"]["value"] != "install ok installed|2.6.1-2ubuntu0.4":
    raise RuntimeError("OCR_EXPAT_VENDOR_FIX_REQUIRED")
if packages["libp11-kit0"]["value"] != "install ok installed|0.25.3-4ubuntu2.2":
    raise RuntimeError("OCR_P11_KIT_VENDOR_FIX_REQUIRED")
if pyexpat.EXPAT_VERSION != "expat_2.6.1":
    raise RuntimeError("OCR_PYEXPAT_VERSION_INVALID")
if packages["libssl3t64"]["value"] != "install ok installed|3.0.13-0ubuntu3.15" or packages["openssl"]["installed"]:
    raise RuntimeError("OCR_OPENSSL_VENDOR_FIX_REQUIRED")
if not ssl.OPENSSL_VERSION.startswith("OpenSSL 3.0.13 "):
    raise RuntimeError("OCR_OPENSSL_RUNTIME_INVALID")
digest = hmac.new(b"synthetic-worker-secret", b"synthetic-body", hashlib.sha256).hexdigest()
if not hmac.compare_digest(digest, "8e873db0a2402e4a0f485d430891cad69e219540ed7b669524115ed6129c25d3"):
    raise RuntimeError("OCR_HMAC_RUNTIME_INVALID")
prohibited = {name: shutil.which(name) for name in ("curl", "wget", "git", "gcc", "xml2-config")}
if any(prohibited.values()):
    raise RuntimeError("OCR_PROHIBITED_RUNTIME_TOOL_PRESENT")
apt_lists = pathlib.Path("/var/lib/apt/lists")
manuals = pathlib.Path("/usr/share/man")
if apt_lists.exists() and any(apt_lists.iterdir()):
    raise RuntimeError("OCR_APT_CACHE_NOT_EMPTY")
if manuals.exists() and any(manuals.iterdir()):
    raise RuntimeError("OCR_MANUAL_PAGES_NOT_EMPTY")
print(json.dumps({
    "packages": packages,
    "pythonOpenSsl": ssl.OPENSSL_VERSION,
    "pythonExpat": pyexpat.EXPAT_VERSION,
    "perlExecutable": None,
    "ioCompressPresent": False,
    "hmacSha256": "passed",
    "prohibitedTools": prohibited,
    "maintenanceUtilities": {name: shutil.which(name) for name in ("apt-get", "dpkg", "sh", "bash", "tar", "openssl")}
}, sort_keys=True))
`;
const runtime = JSON.parse(command("docker", [
  "run", "--rm", "--network", "none", "--read-only", "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=64m",
  "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--pids-limit", "64", "--memory", "1g",
  "--ulimit", "nofile=64:64", "--entrypoint", "/runtime/.venv/bin/python", imageId, "-c", probe
]));

console.log(JSON.stringify({
  result: "OCR_SCANNING_FOUNDATION_1B_IMAGE_SECURITY_QA_PASSED",
  imageId,
  baseImageDigest: inspected.Config.Labels["nalanda.ocr.base-image-digest"],
  buildInputSha256: inspected.Config.Labels["nalanda.ocr.build-input-sha256"],
  user: inspected.Config.User,
  entrypoint: inspected.Config.Entrypoint,
  exposedPorts: [],
  networkDuringProbe: "none",
  runtime
}, null, 2));

function command(program, args) {
  const result = spawnSync(program, args, { encoding: "utf8", windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || result.stdout.trim() || `${program} failed`);
  return result.stdout.trim();
}
