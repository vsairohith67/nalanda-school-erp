"""HARNESS_ONLY: harmless bytes and delegated process boundaries, no licensed assets."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import time
import sys
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("fonts", Path(__file__).parents[1] / "scripts/bootstrap-document-fonts.py")
fonts = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fonts)


class Bootstrap(unittest.TestCase):
    def test_download_success_and_inventory(self):
        data = b"MZharmless-fixture"
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            result = fonts.download("andale32.exe", fonts.digest(data), Path(directory), time.monotonic() + 60,
                                    transfer=lambda *args: (0, 200, "", data))
            self.assertEqual(result.read_bytes(), data)
            self.assertEqual(list(Path(directory).iterdir()), [result])

    def test_exhaustion_is_three_attempts_and_non_success(self):
        calls = []
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(fonts.Refusal, "DOWNLOAD_EXHAUSTED"):
                fonts.download("andale32.exe", "0" * 64, Path(directory), time.monotonic() + 60,
                               transfer=lambda *args: (calls.append(1) or 7, 0, "", b""), sleep=lambda delay: None)
            self.assertEqual(len(calls), 3)
            self.assertEqual(list(Path(directory).iterdir()), [])

    def test_payload_and_integrity_never_retry(self):
        for payload in (b"", b"<html>error</html>", b"MZtruncated", b"MZ" + b"x" * fonts.MAX_ARCHIVE):
            calls = []
            with tempfile.TemporaryDirectory() as directory:
                with self.assertRaises(fonts.Refusal):
                    fonts.download("andale32.exe", "0" * 64, Path(directory), time.monotonic() + 60,
                                   transfer=lambda *args: (calls.append(1) or 0, 200, "", payload))
                self.assertEqual(len(calls), 1)
                self.assertEqual(list(Path(directory).iterdir()), [])

    def test_redirect_bound_and_tls_refusal(self):
        for url in ("http://downloads.sourceforge.net/project/corefonts/the%20fonts/final/andale32.exe",
                    "https://foreign.example/project/corefonts/the%20fonts/final/andale32.exe",
                    "https://downloads.sourceforge.net:444/project/corefonts/the%20fonts/final/andale32.exe",
                    "https://downloads.sourceforge.net/project/other/andale32.exe"):
            with self.assertRaises(fonts.Refusal):
                fonts.archive_url(url, "andale32.exe")
        with tempfile.TemporaryDirectory() as directory:
            calls = []
            with self.assertRaisesRegex(fonts.Refusal, "DOWNLOAD_REDIRECT_BOUND"):
                fonts.download("andale32.exe", "0" * 64, Path(directory), time.monotonic() + 60,
                               transfer=lambda url, *args: (calls.append(1) or 0, 302, url, b""))
            self.assertEqual(len(calls), 6)
            with self.assertRaisesRegex(fonts.Refusal, "PERMANENT_TRANSPORT"):
                fonts.download("andale32.exe", "0" * 64, Path(directory), time.monotonic() + 60,
                               transfer=lambda *args: (60, 0, "", b""))

    def test_cab_paths_sizes_and_duplicates(self):
        self.assertEqual(fonts.cab_inventory(" 100 | 01.01.2000 00:00:00 | Arial.ttf\n"), {"Arial.ttf"})
        for listing in ("", "100 | date | ../foreign.ttf\n", "100 | date | dir/file.ttf\n",
                        "100 | date | c:\\file.ttf\n", "9000000 | date | huge.ttf\n",
                        "100 | date | same.ttf\n100 | date | same.ttf\n"):
            with self.assertRaises(fonts.Refusal):
                fonts.cab_inventory(listing)

    def test_missing_wrong_font_and_no_fallback(self):
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            root = Path(directory)
            expected = {**{name: fonts.digest(b"font") for name in fonts.REQUIRED},
                        **{f"Fixture_{i}.ttf": fonts.digest(b"font") for i in range(27)}}
            with self.assertRaises(FileNotFoundError):
                fonts.verify_fonts(root, expected)
            for name in expected:
                (root / name).write_bytes(b"font")
            with self.assertRaisesRegex(fonts.Refusal, "FAMILY_STYLE"):
                fonts.verify_fonts(root, expected, scan=lambda path: "Fallback\nRegular\n")
            fonts.verify_fonts(root, expected, scan=lambda path: "\n".join(fonts.REQUIRED[path.name]) + "\n")
            (root / "Arial_Bold.ttf").write_bytes(b"wrong")
            with self.assertRaisesRegex(fonts.Refusal, "FONT_INTEGRITY"):
                fonts.verify_fonts(root, expected)

    def test_foreign_cleanup_and_owned_partial_cleanup(self):
        # POSIX identity boundary double only; actual filesystem ownership/cleanup is exercised.
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()), \
                patch.object(fonts.os, "getuid", return_value=0 if not hasattr(fonts.os, "getuid") else fonts.os.getuid(), create=True):
            root = Path(directory) / "owned"
            root.mkdir()
            identity = {"run": "fixture"}
            (root / "owner.json").write_text(json.dumps(identity))
            (root / "ttf-mscorefonts-installer_3.8.1ubuntu1_all.deb").write_bytes(b"partial")
            with self.assertRaisesRegex(fonts.Refusal, "FOREIGN_RECEIPT"):
                fonts.cleanup(root, {"run": "foreign"})
            self.assertTrue((root / "ttf-mscorefonts-installer_3.8.1ubuntu1_all.deb").exists())
            fonts.cleanup(root, identity)
            self.assertFalse(root.exists())

    def test_command_failure_preserves_failure_and_excludes_private_output(self):
        with patch.object(fonts, "run_bounded", return_value=fonts.subprocess.CompletedProcess([], 1, b"private", b"private")):
            with self.assertRaisesRegex(fonts.Refusal, "^TOOL_NONZERO$"):
                fonts.command(["fixture"])

    def test_deadline_and_untrusted_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(fonts.Refusal, "DEADLINE"):
                fonts.download("andale32.exe", "0" * 64, Path(directory), time.monotonic() - 1)
        for config in ("", 'SHA256SUMS="\n' + '0' * 64 + '=wrong.ttf"'):
            with self.assertRaises(fonts.Refusal):
                fonts.checksum_block(config, "SHA256SUMS", "ttf", 30)

    def test_failed_preparation_cleans_only_owned_resources(self):
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()), \
                patch.object(fonts.os, "getuid", return_value=0 if not hasattr(fonts.os, "getuid") else fonts.os.getuid(), create=True), \
                patch.object(fonts, "FONT_DIR", Path(directory) / "absent-fonts"), \
                patch.object(fonts.subprocess, "run", return_value=fonts.subprocess.CompletedProcess([], 1, b"", b"")), \
                patch.object(fonts, "package_metadata", side_effect=fonts.Refusal("EXPECTED_METADATA_FAILURE")):
            root = Path(directory) / "owned"
            foreign = Path(directory) / "foreign"
            foreign.write_bytes(b"preserve")
            with self.assertRaisesRegex(fonts.Refusal, "EXPECTED_METADATA_FAILURE"):
                fonts.prepare(root, {"run": "fixture"})
            self.assertFalse(root.exists())
            self.assertEqual(foreign.read_bytes(), b"preserve")

    def test_purge_failure_retains_receipt_and_non_success(self):
        with tempfile.TemporaryDirectory() as directory, \
                patch.object(fonts.os, "getuid", return_value=0 if not hasattr(fonts.os, "getuid") else fonts.os.getuid(), create=True):
            root = Path(directory) / "owned"
            root.mkdir()
            (root / "owner.json").write_text(json.dumps({"run": "fixture"}))
            (root / "installation-started").write_text("owned\n")
            with patch.object(fonts, "command", side_effect=fonts.Refusal("EXPECTED_PURGE_FAILURE")):
                with self.assertRaisesRegex(fonts.Refusal, "EXPECTED_PURGE_FAILURE"):
                    fonts.cleanup(root, {"run": "fixture"})
            self.assertTrue((root / "owner.json").exists())

    @unittest.skipUnless(sys.platform == "linux", "Real POSIX process groups execute on the five hosted Linux consumers")
    def test_real_process_deadline_and_output_bound(self):
        with self.assertRaisesRegex(fonts.Refusal, "TOOL_DEADLINE"):
            fonts.command([sys.executable, "-c", "import time; time.sleep(5)"], 0.05)
        with self.assertRaisesRegex(fonts.Refusal, "TOOL_OUTPUT_BOUND"):
            fonts.command([sys.executable, "-c", "import sys; sys.stdout.write('x'*2100000); sys.stdout.flush()"], 5)

    @unittest.skipUnless(sys.platform == "linux", "Harmless real sudo process-tree boundary runs only on hosted Linux")
    def test_real_privileged_descendants_cannot_outlive_budget(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            root.chmod(0o755)
            receipt = root / "child-pids"
            receipt.write_text("")
            receipt.chmod(0o666)
            child = "import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); time.sleep(30)"
            for parent_ignores_term in (True, False):
                parent = ("import os,signal,subprocess,time; " +
                          ("signal.signal(signal.SIGTERM,signal.SIG_IGN); " if parent_ignores_term else "") +
                          "p=subprocess.Popen([" + repr(sys.executable) + ",'-c'," + repr(child) + "]); "
                          "open(" + repr(str(receipt)) + ",'w').write(str(os.getpid())+' '+str(p.pid)); time.sleep(30)")
                start = time.monotonic()
                with self.assertRaisesRegex(fonts.Refusal, "TOOL_DEADLINE"):
                    fonts.command(["sudo", sys.executable, "-c", parent], 1)
                self.assertLess(time.monotonic() - start, 3)
                pids = receipt.read_text().split()
                self.assertEqual(len(pids), 2)
                for pid in pids:
                    state = Path("/proc") / pid / "stat"
                    # Kernel zombie awaiting reaping has terminated; never signal it or reuse its PID.
                    self.assertTrue(not state.exists() or state.read_text().split(") ")[1].startswith("Z "))


if __name__ == "__main__":
    unittest.main()
