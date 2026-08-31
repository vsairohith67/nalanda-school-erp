from __future__ import annotations

from nalanda_ocr_benchmark.adapters.unlimited import PROMPT, _clean_grounded_output, _validated_internal_url


def test_prompt_and_grounding_cleanup_match_vllm_recipe() -> None:
    assert PROMPT == "<image>document parsing."
    raw = "<|ref|>Student OCRTEST-0001<|/ref|><|det|>[[10,20,30,40]]<|/det|>"
    assert _clean_grounded_output(raw) == "Student OCRTEST-0001"


def test_server_url_is_limited_to_launcher_internal_endpoint() -> None:
    assert _validated_internal_url("http://nalanda-ocr-unlimited-server-1234-deadbeef:8000")
    for value in (
        "https://nalanda-ocr-unlimited-server-1234-deadbeef:8000",
        "http://example.com:8000",
        "http://127.0.0.1:8000",
        "http://nalanda-ocr-unlimited-server-1234-deadbeef:8000/redirect",
    ):
        assert _validated_internal_url(value) is None
