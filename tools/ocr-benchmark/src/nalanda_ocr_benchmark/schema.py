from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal


ConfidenceState = Literal["GREEN", "AMBER", "RED", "UNKNOWN"]


@dataclass(frozen=True)
class SourceRegion:
    page: int
    x: float
    y: float
    width: float
    height: float


@dataclass(frozen=True)
class TextBlock:
    text: str
    region: SourceRegion | None = None
    confidence: float | None = None
    reading_order: int | None = None


@dataclass(frozen=True)
class FieldCandidate:
    field_id: str
    label: str
    value: str | None
    state: ConfidenceState = "UNKNOWN"
    confidence: float | None = None
    region: SourceRegion | None = None
    validator_state: str | None = None


@dataclass(frozen=True)
class TableCell:
    row: int
    column: int
    text: str
    region: SourceRegion | None = None


@dataclass(frozen=True)
class PageResult:
    page: int
    text_blocks: list[TextBlock] = field(default_factory=list)
    fields: list[FieldCandidate] = field(default_factory=list)
    table_cells: list[TableCell] = field(default_factory=list)
    omitted: bool = False
    error: str | None = None


@dataclass(frozen=True)
class EngineMetadata:
    candidate: str
    version: str
    revision: str | None
    device: str
    cold_start_ms: float
    elapsed_ms: float
    peak_ram_bytes: int | None = None
    peak_vram_bytes: int | None = None
    cpu_seconds: float | None = None
    cpu_utilization_percent: float | None = None
    offline: bool | None = None
    status: str = "OK"
    notes: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class DocumentResult:
    document_id: str
    pages: list[PageResult]
    engine: EngineMetadata
    schema_version: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, raw: dict[str, Any]) -> "DocumentResult":
        pages: list[PageResult] = []
        for page in raw["pages"]:
            blocks = [
                TextBlock(
                    text=item["text"],
                    region=SourceRegion(**item["region"]) if item.get("region") else None,
                    confidence=item.get("confidence"),
                    reading_order=item.get("reading_order"),
                )
                for item in page.get("text_blocks", [])
            ]
            fields = [
                FieldCandidate(
                    field_id=item["field_id"],
                    label=item["label"],
                    value=item.get("value"),
                    state=item.get("state", "UNKNOWN"),
                    confidence=item.get("confidence"),
                    region=SourceRegion(**item["region"]) if item.get("region") else None,
                    validator_state=item.get("validator_state"),
                )
                for item in page.get("fields", [])
            ]
            cells = [
                TableCell(
                    row=item["row"],
                    column=item["column"],
                    text=item["text"],
                    region=SourceRegion(**item["region"]) if item.get("region") else None,
                )
                for item in page.get("table_cells", [])
            ]
            pages.append(
                PageResult(
                    page=page["page"],
                    text_blocks=blocks,
                    fields=fields,
                    table_cells=cells,
                    omitted=page.get("omitted", False),
                    error=page.get("error"),
                )
            )
        return cls(
            document_id=raw["document_id"],
            pages=pages,
            engine=EngineMetadata(**raw["engine"]),
            schema_version=raw["schema_version"],
        )
