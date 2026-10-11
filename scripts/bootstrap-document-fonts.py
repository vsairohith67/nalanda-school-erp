#!/usr/bin/env python3
"""Ephemeral Ubuntu 24.04 CI fonts, using the existing package's local-copy contract.

No node_modules, alternate fonts, cache, trust-store changes or font publication.
APT's authenticated index anchors the package; its config anchors archives/fonts.
The existing workflow supplies its already-authorised debconf EULA selection.
"""
import hashlib
import io
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tarfile
import threading
import time
from urllib.parse import urlsplit, unquote, urljoin, parse_qsl

PACKAGE = "ttf-mscorefonts-installer"
VERSION = "3.8.1ubuntu1"
FONT_DIR = Path("/usr/share/fonts/truetype/msttcorefonts")
ARCHIVES = {"andale32.exe", "arial32.exe", "arialb32.exe", "comic32.exe", "courie32.exe",
            "georgi32.exe", "impact32.exe", "times32.exe", "trebuc32.exe", "verdan32.exe", "webdin32.exe"}
REQUIRED = {"Arial.ttf": ("Arial", "Regular"), "Arial_Bold.ttf": ("Arial", "Bold"),
            "Georgia_Bold.ttf": ("Georgia", "Bold")}
MAX_ARCHIVE = 2_000_000
ACQUISITION_SECONDS = 300


class Refusal(RuntimeError):
    pass


def require(value, reason):
    if not value:
        raise Refusal(reason)


def terminate_group(process, privileged):
    # This exact Popen created a new session; never select a process by image name.
    for signal in ("TERM", "KILL"):
        args = (["sudo"] if privileged else []) + ["/bin/kill", "-" + signal, "--", "-" + str(process.pid)]
        subprocess.run(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5, check=False)
        if signal == "TERM":
            try:
                process.wait(timeout=1)
            except subprocess.TimeoutExpired:
                pass
    process.wait(timeout=5)
    deadline = time.monotonic() + 1
    while True:
        check = subprocess.run((["sudo"] if privileged else []) + ["/bin/kill", "-0", "--", "-" + str(process.pid)],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5, check=False)
        if check.returncode != 0:
            break
        require(time.monotonic() < deadline, "OWNED_PROCESS_GROUP_REMAINS")
        time.sleep(0.01)  # Bounded state observation for OS reaping, not an application/test delay.


def run_bounded(args, seconds, cwd=None, data=None):
    require(sys.platform == "linux", "PROCESS_BOUNDARY_LINUX_REQUIRED")
    require(data is None or len(data) <= 4096, "TOOL_STDIN_BOUND")
    process = subprocess.Popen(args, stdin=subprocess.PIPE if data is not None else subprocess.DEVNULL,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=cwd, start_new_session=True, bufsize=0)
    output, errors, exceeded = bytearray(), bytearray(), threading.Event()

    def read(stream, buffer):
        while True:
            chunk = stream.read(65536)
            if not chunk:
                break
            if len(buffer) + len(chunk) > 2_000_000:
                exceeded.set()
                break
            buffer.extend(chunk)

    readers = [threading.Thread(target=read, args=(process.stdout, output), daemon=True),
               threading.Thread(target=read, args=(process.stderr, errors), daemon=True)]
    for reader in readers:
        reader.start()
    deadline = time.monotonic() + seconds
    try:
        if data is not None:
            process.stdin.write(data)
            process.stdin.close()
        while process.poll() is None or any(reader.is_alive() for reader in readers):
            require(not exceeded.is_set(), "TOOL_OUTPUT_BOUND")
            require(time.monotonic() < deadline, "TOOL_DEADLINE")
            time.sleep(0.01)
        require(not exceeded.is_set(), "TOOL_OUTPUT_BOUND")
        return subprocess.CompletedProcess(args, process.returncode, bytes(output), bytes(errors))
    except BaseException:
        terminate_group(process, args[0] == "sudo")
        raise
    finally:
        for reader in readers:
            reader.join(timeout=1)
        require(not any(reader.is_alive() for reader in readers), "OWNED_PIPE_READER_REMAINS")
        process.stdout.close()
        process.stderr.close()


def command(args, seconds=30, cwd=None, data=None):
    # No child output is emitted: package messages can include private temp paths.
    if args[0] == "sudo":
        # The narrow bootstrap runs as root in the authorised disposable job.
        # Do not introduce a nested sudo monitor/PTY/foreign process session.
        require(os.geteuid() == 0, "DISPOSABLE_ROOT_REQUIRED")
        args = args[1:]
    result = run_bounded(args, seconds, cwd, data)
    require(result.returncode == 0, "TOOL_NONZERO")
    return result.stdout


def digest(data):
    return hashlib.sha256(data).hexdigest()


def regular(path, maximum):
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and 0 < info.st_size <= maximum,
            "UNSAFE_OR_EMPTY_FILE")
    return path.read_bytes()


def checksum_block(config, name, extension, count):
    matches = re.findall(r'(?m)^' + name + r'="\n([^"\r]+)"', config.replace("\r\n", "\n"))
    require(len(matches) == 1, "PACKAGE_HASH_BLOCK")
    result = {}
    for line in matches[0].splitlines():
        match = re.fullmatch(r"([a-f0-9]{64})=([A-Za-z0-9_]+\." + extension + ")", line)
        require(match is not None and match[2] not in result, "PACKAGE_HASH_ROW")
        result[match[2]] = match[1]
    require(len(result) == count, "PACKAGE_HASH_INVENTORY")
    return result


def archive_url(url, filename):
    parsed = urlsplit(url)
    require(parsed.scheme == "https" and parsed.port in (None, 443) and
            not parsed.username and not parsed.password and not parsed.fragment, "URL_TLS_OR_CREDENTIALS")
    # SourceForge's owned download namespace, including its selected official mirror.
    require(parsed.hostname == "downloads.sourceforge.net" or
            re.fullmatch(r"[a-z0-9-]+\.dl\.sourceforge\.net", parsed.hostname or ""), "URL_HOST")
    require(unquote(parsed.path) == "/project/corefonts/the fonts/final/" + filename, "URL_ARCHIVE")
    # Observed official SourceForge mirror redirects carry opaque delivery values.
    # Preserve them unchanged, never log them; they confer no font integrity trust.
    require(len(parsed.query) <= 1024, "URL_QUERY_BOUND")
    query = parse_qsl(parsed.query, keep_blank_values=True, strict_parsing=True)
    keys = [key for key, value in query]
    require(len(keys) == len(set(keys)) and set(keys) in (set(), {"viasf"}, {"viasf", "fid", "e", "st"}) and
            all(re.fullmatch(r"[A-Za-z0-9_-]{1,128}", value) for key, value in query) and
            (not query or dict(query)["viasf"] == "1"), "URL_DELIVERY_QUERY")


def verify_archive(data, expected):
    require(0 < len(data) <= MAX_ARCHIVE and data[:2] == b"MZ", "ARCHIVE_PAYLOAD")
    require(digest(data) == expected, "ARCHIVE_INTEGRITY")


def download(filename, expected, root, deadline, transfer=None, sleep=time.sleep):
    """At most three DOWNLOAD attempts; integrity/TLS/redirect failures never retry."""
    require(filename in ARCHIVES and re.fullmatch(r"[a-f0-9]{64}", expected), "ARCHIVE_IDENTITY")
    initial = "https://downloads.sourceforge.net/project/corefonts/the%20fonts/final/" + filename
    transfer = transfer or curl_transfer
    for attempt in range(1, 4):
        url = initial
        attempt_deadline = min(deadline, time.monotonic() + 30)
        transient = False
        for redirect in range(6):
            archive_url(url, filename)
            remaining = attempt_deadline - time.monotonic()
            require(remaining > 0, "DOWNLOAD_DEADLINE")
            code, status, location, body = transfer(url, root, remaining)
            if code in (6, 7, 28) or (code == 0 and status in (408, 429, 500, 502, 503, 504)):
                print(json.dumps({"phase": "download_transient", "archive": filename, "attempt": attempt,
                                  "classification": {6: "DNS", 7: "CONNECTION", 28: "TRANSFER_DEADLINE"}.get(code, "HTTP"),
                                  "httpStatus": status}), flush=True)
                transient = True
                break
            require(code == 0, "DOWNLOAD_TLS_OR_PERMANENT_TRANSPORT")
            if status in (301, 302, 303, 307, 308):
                require(redirect < 5 and location, "DOWNLOAD_REDIRECT_BOUND")
                url = urljoin(url, location)
                continue
            require(status == 200, "DOWNLOAD_HTTP")
            verify_archive(body, expected)
            destination = root / filename
            with destination.open("xb") as handle:
                handle.write(body)
            print(json.dumps({"phase": "archive_verified", "archive": filename,
                              "sha256": expected, "bytes": len(body), "attempt": attempt}), flush=True)
            return destination
        require(transient and attempt < 3, "DOWNLOAD_EXHAUSTED")
        require(time.monotonic() + attempt < deadline, "ACQUISITION_DEADLINE")
        sleep(attempt)
    raise Refusal("DOWNLOAD_EXHAUSTED")


def curl_transfer(url, root, seconds):
    body = root / "transfer.part"
    try:
        result = run_bounded(["curl", "--disable", "--silent", "--show-error", "--proto", "=https",
                                 "--max-redirs", "0", "--connect-timeout", str(min(10, seconds)),
                                 "--max-time", str(seconds), "--max-filesize", str(MAX_ARCHIVE),
                                 "--output", str(body), "--write-out", "%{http_code}\n%{redirect_url}", url], seconds + 2)
        require(len(result.stdout) <= 4096, "TRANSFER_OUTPUT_BOUND")
        # curl validates HTTPS; only its bounded status/redirect projection is retained.
        parts = result.stdout.decode("utf8").split("\n")
        require(len(parts) == 2 and re.fullmatch(r"[0-9]{3}", parts[0]), "TRANSFER_STATUS")
        data = regular(body, MAX_ARCHIVE) if body.exists() and body.stat().st_size else b""
        return result.returncode, int(parts[0]), parts[1], data
    finally:
        body.unlink(missing_ok=True)


def cab_inventory(listing):
    rows = re.findall(r"(?m)^\s*([0-9]+)\s*\|[^\n|]+\|\s*([^\r\n]+)$", listing)
    require(0 < len(rows) <= 20 and len(rows) == len(re.findall(r"(?m)^\s*[0-9]+\s*\|", listing)), "CAB_INVENTORY")
    names = set()
    total = 0
    for size, name in rows:
        require(re.fullmatch(r"[A-Za-z0-9_ .-]+", name) and name not in (".", "..") and
                ".." not in name and name not in names, "CAB_PATH")
        names.add(name)
        total += int(size)
    require(0 < total <= 6_000_000, "CAB_SIZE")
    return names


def verify_fonts(directory, expected, scan=None):
    require(len(expected) == 30 and REQUIRED.keys() <= expected.keys(), "FONT_REQUIRED_INVENTORY")
    for name, sha in sorted(expected.items()):
        require(digest(regular(directory / name, 2_000_000)) == sha, "FONT_INTEGRITY")
    scan = scan or (lambda path: command(["fc-scan", "--format", "%{family}\n%{style}\n", str(path)]).decode())
    for name, (family, style) in REQUIRED.items():
        values = scan(directory / name).strip().splitlines()
        require(len(values) == 2 and family in values[0].split(",") and style in values[1].split(","),
                "FONT_FAMILY_STYLE")
        print(json.dumps({"phase": "font_identity", "font": name, "family": family,
                          "style": style, "sha256": expected[name]}), flush=True)


def package_metadata(root):
    metadata = command(["apt-cache", "show", PACKAGE + "=" + VERSION]).decode()
    sections = [section for section in metadata.strip().split("\n\n") if section.startswith("Package: " + PACKAGE + "\n")]
    require(len(sections) == 1, "APT_PACKAGE_AMBIGUOUS")
    fields = {}
    for line in sections[0].splitlines():
        if line.startswith(" "):
            continue
        key, separator, value = line.partition(": ")
        require(separator and key not in fields, "APT_METADATA")
        fields[key] = value
    require(fields.get("Version") == VERSION and fields.get("Architecture") == "all" and
            re.fullmatch(r"[a-f0-9]{64}", fields.get("SHA256", "")) and
            fields.get("Filename") == "pool/multiverse/m/msttcorefonts/" + PACKAGE + "_" + VERSION + "_all.deb",
            "APT_IDENTITY")
    command(["apt-get", "download", PACKAGE + "=" + VERSION], 60, cwd=root)
    files = list(root.glob("*.deb"))
    require(len(files) == 1, "APT_OUTPUT_INVENTORY")
    data = regular(files[0], 100000)
    require(len(data) == int(fields["Size"]) and digest(data) == fields["SHA256"], "APT_PACKAGE_INTEGRITY")
    control = command(["dpkg-deb", "--ctrl-tarfile", str(files[0])])
    with tarfile.open(fileobj=io.BytesIO(control), mode="r:") as archive:
        entries = archive.getmembers()
        matches = [entry for entry in entries if entry.name in ("./config", "config")]
        require(len(entries) <= 20 and len(matches) == 1 and matches[0].isfile() and matches[0].size <= 50000,
                "PACKAGE_CONFIG_BOUND")
        config = archive.extractfile(matches[0]).read().decode()
    archives = checksum_block(config, "EXESHA256S", "exe", 11)
    require(archives.keys() == ARCHIVES, "PACKAGE_ARCHIVE_INVENTORY")
    fonts = checksum_block(config, "SHA256SUMS", "ttf", 30)
    print(json.dumps({"phase": "apt_authenticated_metadata", "package": PACKAGE, "version": VERSION,
                      "sha256": fields["SHA256"], "archives": 11, "fonts": 30}), flush=True)
    return archives, fonts


def context():
    require(sys.platform == "linux" and os.environ.get("GITHUB_ACTIONS") == "true", "DISPOSABLE_LINUX_REQUIRED")
    require(os.geteuid() == 0, "DISPOSABLE_ROOT_REQUIRED")
    require('VERSION_ID="24.04"' in Path("/etc/os-release").read_text(), "SUPPORTED_UBUNTU_REQUIRED")
    require(os.environ.get("GITHUB_REPOSITORY") == "vsairohith67/nalanda-school-erp", "REPOSITORY_REQUIRED")
    labels = [os.environ.get(key, "") for key in ("GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT", "GITHUB_JOB")]
    require(all(re.fullmatch(r"[A-Za-z0-9_-]{1,100}", value) for value in labels), "RUN_IDENTITY")
    source = command(["git", "rev-parse", "HEAD"]).decode().strip()
    require(re.fullmatch(r"[a-f0-9]{40}", source) and source == os.environ.get("FONT_EXPECTED_SHA"), "SOURCE_IDENTITY")
    parent = Path(os.environ["RUNNER_TEMP"])
    require(parent.is_absolute() and parent.resolve() == parent and not parent.is_symlink(), "OWNED_PARENT")
    root = parent / ("nalanda-fonts-" + "-".join(labels))
    identity = {"version": 1, "source": source, "run": labels[0], "attempt": labels[1], "job": labels[2], "uid": os.getuid()}
    return root, identity


def cleanup(root, identity):
    if not root.exists():
        return
    require(not root.is_symlink() and root.stat().st_uid == os.getuid(), "CLEANUP_FOREIGN_ROOT")
    receipt = json.loads(regular(root / "owner.json", 1024))
    require(receipt == identity, "CLEANUP_FOREIGN_RECEIPT")
    allowed = {"owner.json", "installation-started", PACKAGE + "_" + VERSION + "_all.deb", "archives", "scratch"}
    require(all(path.name in allowed for path in root.iterdir()), "CLEANUP_FOREIGN_RESOURCE")
    ordinary = [path for path in root.iterdir() if path.name not in ("archives", "scratch")]
    require(all(path.is_file() and not path.is_symlink() and path.stat().st_nlink == 1 for path in ordinary),
            "CLEANUP_AMBIGUOUS_RESOURCE")
    archive_root = root / "archives"
    if archive_root.exists():
        require(archive_root.is_dir() and not archive_root.is_symlink(), "CLEANUP_FOREIGN_ARCHIVES")
        require(all(path.name in ARCHIVES and path.is_file() and not path.is_symlink() and
                    path.stat().st_nlink == 1 for path in archive_root.iterdir()), "CLEANUP_AMBIGUOUS_ARCHIVE")
    scratch = root / "scratch"
    scratch_plan = []
    if scratch.exists():
        require(scratch.is_dir() and not scratch.is_symlink(), "CLEANUP_FOREIGN_SCRATCH")
        for directory in scratch.iterdir():
            require(re.fullmatch(r"ttf-mscorefonts-installer\.[A-Za-z0-9]{6}", directory.name) and
                    directory.is_dir() and not directory.is_symlink(), "CLEANUP_AMBIGUOUS_SCRATCH")
            files = list(directory.iterdir())
            require(len(files) <= 100 and all(path.is_file() and not path.is_symlink() and
                    path.stat().st_nlink == 1 and path.stat().st_uid in (0, os.getuid()) for path in files),
                    "CLEANUP_AMBIGUOUS_SCRATCH_FILE")
            scratch_plan.append((directory, files))
    # Every path is checked before any removal; unknown residue is preserved.
    for directory, files in scratch_plan:
        for path in files:
            command(["sudo", "rm", "--", str(path)], 10)
        command(["sudo", "rmdir", "--", str(directory)], 10)
    if scratch.exists():
        scratch.rmdir()
    # Font package installation was absent at preparation and is owned by this job.
    if (root / "installation-started").exists():
        command(["sudo", "apt-get", "purge", "-y", PACKAGE], 120)
        require(not FONT_DIR.exists() or not list(FONT_DIR.glob("*.ttf")), "FONT_CLEANUP_INCOMPLETE")
    # Never recursively traverse symlinks or delete outside this exact run root.
    if archive_root.exists():
        for path in archive_root.iterdir():
            path.unlink()
        archive_root.rmdir()
    for path in root.iterdir():
        require(path.is_file() and not path.is_symlink() and path.stat().st_nlink == 1, "CLEANUP_AMBIGUOUS_RESOURCE")
    for path in root.iterdir():
        path.unlink()
    root.rmdir()
    print('{"phase":"owned_cleanup","outcome":"verified"}', flush=True)


def prepare(root, identity):
    require(not root.exists(), "OWNED_ROOT_CONFLICT")
    installed = subprocess.run(["dpkg-query", "-W", "-f=${db:Status-Status}", PACKAGE], capture_output=True, timeout=10)
    require(installed.returncode != 0 and not FONT_DIR.exists(), "PREEXISTING_FONT_STATE")
    root.mkdir(mode=0o700)
    (root / "owner.json").write_text(json.dumps(identity))
    try:
        archives, fonts = package_metadata(root)
        archive_root = root / "archives"
        archive_root.mkdir(mode=0o700)
        scratch = root / "scratch"
        scratch.mkdir(mode=0o700)
        deadline = time.monotonic() + ACQUISITION_SECONDS
        for name, sha in sorted(archives.items()):
            archive = download(name, sha, archive_root, deadline)
            cab_inventory(command(["cabextract", "-l", str(archive)], 10).decode())
            require(time.monotonic() < deadline, "ACQUISITION_DEADLINE")
        # Existing authorised license choice, not a new acceptance mechanism.
        license_state = command(["sudo", "debconf-communicate", PACKAGE], data=b"GET msttcorefonts/accepted-mscorefonts-eula\n")
        require(license_state.strip() == b"0 true", "EXISTING_LICENSE_ACCEPTANCE_REQUIRED")
        command(["sudo", "debconf-set-selections"], data=(PACKAGE + " msttcorefonts/dldir string " + str(archive_root) + "\n").encode())
        (root / "installation-started").write_text("owned\n")
        try:
            command(["sudo", "env", "TMPDIR=" + str(scratch), "apt-get", "install", "-y", PACKAGE + "=" + VERSION], 120)
        finally:
            command(["sudo", "debconf-set-selections"], data=(PACKAGE + " msttcorefonts/dldir string\n").encode())
        require(Path("/var/lib/update-notifier/package-data-downloads/ttf-mscorefonts-installer").is_file(),
                "NORMAL_PACKAGE_TRIGGER_INCOMPLETE")
        require(command(["dpkg-query", "-W", "-f=${db:Status-Status} ${Version}", PACKAGE]).decode() ==
                "installed " + VERSION, "INSTALLED_PACKAGE_IDENTITY")
        verify_fonts(FONT_DIR, fonts)
        # Publish only after every genuine package font and required identity passed.
        with open(os.environ["GITHUB_ENV"], "a", encoding="utf8") as env:
            env.write("REPORT_CARD_FONT_DIR=" + str(FONT_DIR) + "\nCERTIFICATE_GEORGIA_BOLD_PATH=" +
                      str(FONT_DIR / "Georgia_Bold.ttf") + "\n")
        for path in archive_root.iterdir():
            path.unlink()
        archive_root.rmdir()
        require(not list(scratch.iterdir()), "INSTALLER_SCRATCH_REMAINS")
        scratch.rmdir()
        for path in root.iterdir():
            if path.name not in ("owner.json", "installation-started"):
                require(path.is_file() and not path.is_symlink(), "TEMP_RESOURCE_UNSAFE")
                path.unlink()
        print('{"phase":"fonts_ready","fonts":30,"outcome":"verified"}', flush=True)
    except BaseException as error:
        print(json.dumps({"phase": "preparation_failed", "reason": str(error) if isinstance(error, Refusal)
                          else "UNEXPECTED_PREPARATION_FAILURE"}), flush=True)
        cleanup(root, identity)
        raise


if __name__ == "__main__":
    try:
        require(len(sys.argv) == 2 and sys.argv[1] in ("prepare", "cleanup"), "OPERATION_REQUIRED")
        owned_root, owned_identity = context()
        if sys.argv[1] == "prepare":
            prepare(owned_root, owned_identity)
        else:
            cleanup(owned_root, owned_identity)
    except Exception as error:
        # Strict allowlisted reason, never subprocess output, URLs, or raw exceptions.
        reason = str(error) if isinstance(error, Refusal) else "UNEXPECTED_BOOTSTRAP_FAILURE"
        print(json.dumps({"phase": "font_bootstrap", "outcome": "refused", "reason": reason}), flush=True)
        sys.exit(1)
