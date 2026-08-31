from __future__ import annotations

from pathlib import Path

import pypdfium2 as pdfium
from PIL import Image


def page_images(source: Path, output_dir: Path, *, scale: float = 2.0) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    if source.suffix.lower() != ".pdf":
        # Candidates receive decoded pixels only. Re-encoding prevents EXIF,
        # comments, ICC payloads and other hidden source metadata from crossing
        # the candidate trust boundary.
        with Image.open(source) as opened:
            opened.load()
            image = opened.convert("RGB")
        target = output_dir / "page-001.png"
        image.save(target, format="PNG", optimize=False, compress_level=9)
        return [target]
    document = pdfium.PdfDocument(str(source))
    paths: list[Path] = []
    for index in range(len(document)):
        bitmap = document[index].render(scale=scale)
        image: Image.Image = bitmap.to_pil().convert("RGB")
        target = output_dir / f"page-{index + 1:03d}.png"
        image.save(target, format="PNG", optimize=False, compress_level=9)
        paths.append(target)
    return paths
