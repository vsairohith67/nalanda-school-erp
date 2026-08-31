from __future__ import annotations

import numpy as np

from nalanda_ocr_benchmark.preprocess import VARIANTS, transform


def test_preprocessing_variants_are_bounded_and_deterministic() -> None:
    image = np.full((80, 120, 3), 255, dtype=np.uint8)
    image[20:60, 30:90] = 40
    for variant in VARIANTS:
        first = transform(image, variant)
        second = transform(image, variant)
        assert np.array_equal(first, second)
        assert max(first.shape[:2]) <= 6000
