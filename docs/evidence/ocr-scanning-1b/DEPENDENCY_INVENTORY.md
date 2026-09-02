# OCR Scanning Foundation 1B dependency inventory

Captured 2026-08-31. This inventory is evidence for software review; it is not an operational authorization.

## Exact OCR stack

| Component | Pin | Provenance |
|---|---|---|
| PaddleOCR | `3.7.0` | Apache-2.0 package; PaddleOCR source revision `2661c7c0ef5c613e8f93c6e93b2e052399f0f854` |
| PaddlePaddle GPU | `3.3.1` | Benchmark-cleared local GPU runtime |
| Python base | `python:3.12.10-slim-bookworm@sha256:97983fa8cc88343512862c62307159a82261c3528dc025f79e5a3f7af43e50b4` | Digest-pinned official image |
| Worker image | `sha256:597f0e036869533a6b5c687d4eae1fac2cb3b514d4ec9a4dd6240a4ef5047314` | Local only; build input `79a89b7499fa819c9d2949bf2e64eb1629c9e775d2057645cf433b4890c0af13` |

## Exact models

| Model | Revision | Weight SHA-256 |
|---|---|---|
| `PP-OCRv5_mobile_det` | `0d63e78e2b680928f6b1747d76a08db6e645efb7` | `afa1820cb16c1fd0dad589d0f8b389139061c1ef6d68019685fd07be997dda5b` |
| `en_PP-OCRv5_mobile_rec` | `267c36e24c331595590fe7bd72bde2436fd286f2` | `3ec8a97ed6cefe8568d3e2ee90bb193299b566a7661aa4fd52d224b96b59f66b` |
| `devanagari_PP-OCRv5_mobile_rec` | `99dcce6d196bd4aaf268c7a5c72c3cc9f3ea4932` | `719be7d20bfe9530e2deae324c999e9911087496bce5e70846767c448d023a01` |
| `te_PP-OCRv5_mobile_rec` | `151ab3b1c2f2a058f07a944416b92e9eaec6bf36` | `45967d00d6b4af590221733bf0d93791babc1feb17b98da401dba53d3cf110c9` |

Weights are checksum-verified external files. None are repository or CI artifacts.

## Application/runtime packages

The application reuses the repository-pinned Next.js/React/Prisma/Vitest/Sharp stack. No cloud OCR SDK, Tesseract runtime, Surya runtime or Unlimited-OCR runtime was added. The worker SBOM contains 338 Debian and Python packages; the list evidence SHA-256 is `67BE20A3B82B9BD33CA7AF48CEDFEC1D1C5B5022C5D732F2781972081D45CDD3`.

## Vulnerability review boundary

The rebuilt Bookworm image includes all vendor-available upgrades as of capture. Docker Scout still reports eight advisories for Bookworm packages with no Bookworm fixed version: two Perl advisories marked critical by the scanner, two additional Perl advisories, three OpenSSL advisories and one Expat advisory. The image is network-none, unprivileged, read-only, capability-free and runs only the Python OCR entrypoint against bounded raster input; it does not invoke Perl, expose DTLS/CMP/CMS, or parse document XML. Those controls reduce reachability but do not create a vendor fix. Final release classification must therefore preserve the external-toolchain gate until the security decision is recorded.

The local SARIF and full SBOM are retained outside the repository under `.codex/artifacts`; only sanitized hashes and counts are committed.
