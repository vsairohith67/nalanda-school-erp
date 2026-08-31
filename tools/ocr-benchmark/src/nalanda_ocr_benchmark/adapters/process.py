from __future__ import annotations

import os
import signal
import subprocess
import threading
import time
from dataclasses import dataclass
from pathlib import Path

import psutil


@dataclass(frozen=True)
class ProcessEvidence:
    returncode: int
    stdout: str
    stderr: str
    elapsed_ms: float
    peak_ram_bytes: int
    cpu_seconds: float
    timed_out: bool
    output_limited: bool


def _terminate_process_tree(process: subprocess.Popen[bytes], tracked: psutil.Process) -> None:
    if process.poll() is None:
        if os.name == "nt":
            subprocess.run(
                ["taskkill.exe", "/PID", str(process.pid), "/T", "/F"],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=5,
                check=False,
                shell=False,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
            )
        else:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except (ProcessLookupError, PermissionError):
                pass
    try:
        children = tracked.children(recursive=True)
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        children = []
    for child in children:
        try:
            child.terminate()
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    try:
        tracked.terminate()
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        pass
    _, alive = psutil.wait_procs([*children, tracked], timeout=1)
    for item in alive:
        try:
            item.kill()
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    if process.poll() is None:
        process.kill()


def _drain_stream(
    stream,
    chunks: list[bytes],
    limit: int,
    exceeded: threading.Event,
) -> None:
    retained = 0
    while True:
        chunk = stream.read(64 * 1024)
        if not chunk:
            return
        remaining = max(0, limit - retained)
        if remaining:
            chunks.append(chunk[:remaining])
            retained += min(len(chunk), remaining)
        if len(chunk) > remaining:
            exceeded.set()


def run_bounded(
    argv: list[str],
    *,
    cwd: Path,
    environment: dict[str, str],
    timeout_seconds: float,
    max_output_bytes: int,
) -> ProcessEvidence:
    started = time.perf_counter()
    creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0) | getattr(
        subprocess, "CREATE_NEW_PROCESS_GROUP", 0
    )
    process = subprocess.Popen(
        argv,
        cwd=str(cwd),
        env=environment,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=False,
        shell=False,
        creationflags=creationflags,
        start_new_session=os.name != "nt",
    )
    tracked = psutil.Process(process.pid)
    stdout_chunks: list[bytes] = []
    stderr_chunks: list[bytes] = []
    output_exceeded = threading.Event()
    readers = [
        threading.Thread(
            target=_drain_stream,
            args=(process.stdout, stdout_chunks, max_output_bytes, output_exceeded),
            daemon=True,
        ),
        threading.Thread(
            target=_drain_stream,
            args=(process.stderr, stderr_chunks, max_output_bytes, output_exceeded),
            daemon=True,
        ),
    ]
    for reader in readers:
        reader.start()
    peak_ram = 0
    cpu_seconds = 0.0
    timed_out = False
    while process.poll() is None:
        try:
            memory = tracked.memory_info().rss
            children = tracked.children(recursive=True)
            memory += sum(child.memory_info().rss for child in children if child.is_running())
            peak_ram = max(peak_ram, memory)
            cpu = tracked.cpu_times()
            cpu_seconds = max(cpu_seconds, cpu.user + cpu.system)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
        if time.perf_counter() - started > timeout_seconds:
            timed_out = True
            _terminate_process_tree(process, tracked)
            break
        if output_exceeded.is_set():
            _terminate_process_tree(process, tracked)
            break
        time.sleep(0.025)
    try:
        process.wait(timeout=2)
    except subprocess.TimeoutExpired:
        _terminate_process_tree(process, tracked)
        process.wait(timeout=2)
    for reader in readers:
        reader.join(timeout=2)
    stdout_bytes = b"".join(stdout_chunks)
    stderr_bytes = b"".join(stderr_chunks)
    return ProcessEvidence(
        returncode=process.returncode if process.returncode is not None else -1,
        stdout=stdout_bytes.decode("utf-8", errors="replace"),
        stderr=stderr_bytes.decode("utf-8", errors="replace"),
        elapsed_ms=(time.perf_counter() - started) * 1000,
        peak_ram_bytes=peak_ram,
        cpu_seconds=cpu_seconds,
        timed_out=timed_out,
        output_limited=output_exceeded.is_set(),
    )
