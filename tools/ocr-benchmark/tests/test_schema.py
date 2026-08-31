from __future__ import annotations

from nalanda_ocr_benchmark.schema import DocumentResult, EngineMetadata, FieldCandidate, PageResult, SourceRegion, TableCell, TextBlock


def test_normalized_schema_round_trip() -> None:
    original = DocumentResult(
        document_id="OCRTEST-DOC",
        pages=[
            PageResult(
                page=1,
                text_blocks=[TextBlock("OCRTEST", SourceRegion(1, 1, 2, 3, 4), 0.9, 0)],
                fields=[FieldCandidate("student", "Student", "STUDENT OCRTEST-0001", "GREEN", 0.9)],
                table_cells=[TableCell(0, 0, "OCRTEST")],
            )
        ],
        engine=EngineMetadata("test", "1", "abc", "CPU", 10, 20, 100, 0, True, "OK", []),
        schema_version="test",
    )
    reconstructed = DocumentResult.from_dict(original.to_dict())
    assert reconstructed == original
