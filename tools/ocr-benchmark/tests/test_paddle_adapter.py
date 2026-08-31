from __future__ import annotations

from nalanda_ocr_benchmark.adapters.paddle import _deduplicate, _scripts
from nalanda_ocr_benchmark.schema import SourceRegion, TextBlock


def test_script_selection_avoids_redundant_latin_pass() -> None:
    assert _scripts("en") == ["en"]
    assert _scripts("en+hi") == ["hi"]
    assert _scripts("en+te") == ["te"]
    assert _scripts("en+hi+te") == ["hi", "te"]


def test_overlapping_script_passes_keep_higher_confidence() -> None:
    region = SourceRegion(page=1, x=10, y=20, width=100, height=30)
    blocks = _deduplicate(
        [
            TextBlock("wrong", region=region, confidence=0.4),
            TextBlock("correct", region=region, confidence=0.9),
        ]
    )
    assert [block.text for block in blocks] == ["correct"]
    assert blocks[0].reading_order == 0
