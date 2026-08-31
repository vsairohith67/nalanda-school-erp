from __future__ import annotations

from nalanda_ocr_benchmark.adapters.surya import PROMPT, _extract_blocks, _validated_loopback_url


def test_prompt_is_the_upstream_training_contract() -> None:
    assert PROMPT == (
        "OCR this image to HTML. Each block is a div with data-label and data-bbox "
        "(x0 y0 x1 y1, normalized 0-1000)."
    )


def test_surya_html_is_normalized_without_executing_it() -> None:
    raw = '<div data-label="Text" data-bbox="100 200 500 300">Student <b>OCRTEST-0001</b></div>'
    blocks = _extract_blocks(raw, page=2, width=1000, height=2000)
    assert blocks[0].text == "Student OCRTEST-0001"
    assert blocks[0].region is not None
    assert blocks[0].region.page == 2
    assert blocks[0].region.x == 100
    assert blocks[0].region.y == 400
    assert blocks[0].region.width == 400
    assert blocks[0].region.height == 200


def test_server_url_is_strict_loopback_only() -> None:
    assert _validated_loopback_url("http://127.0.0.1:32137") == "http://127.0.0.1:32137"
    for value in (
        "http://localhost:32137",
        "http://127.0.0.1:8000",
        "https://127.0.0.1:32137",
        "http://example.com:32137",
    ):
        assert _validated_loopback_url(value) is None
