# OCR scanning foundation 1B R1 supply-chain blocker

Status recorded 2026-08-31: `OCR_SCANNING_FOUNDATION_1B_BLOCKED_EXTERNAL_BASE_IMAGE`.

This record is sanitized for the public repository. It contains no image, model weights,
source documents, rasters, OCR output, database content, secrets, or private filesystem paths.

## Exact candidate

- Final runtime base: `ubuntu:24.04@sha256:33ceb71981b602c1a7443a53469e4dba065f7503eab3078a2d7a57a2ab987517`
- Candidate image ID: `sha256:49671769cab532361baf7301fb474b397508f7077ddffab38738f13070ade233`
- Candidate image size: 4,422,003,752 bytes in the local Docker content store
- Build-input SHA-256: `548331561cb9f1b07cb1024f0cf8d9f78afc49a51727a107ae936dc11f31ca41`
- External Paddle wheel SHA-256: `b1500120002c2bf4542c841e25296cf10c52e0d395053aa395f79bd9c0303cce`
- Python: 3.12.3
- PaddleOCR: 3.7.0
- PaddlePaddle GPU: 3.3.1

Ubuntu 24.04 removed the earlier unresolved distribution-package Critical and High findings.
Perl and IO::Compress are absent, and the candidate contains the vendor-fixed Ubuntu Expat,
p11-kit, and OpenSSL runtime packages. The stricter whole-filesystem scan nevertheless blocks
release because locked Python wheels bundle vulnerable FFmpeg binaries.

## Same-image scanner results

| Scanner | Fresh result | Decision |
| --- | --- | --- |
| Docker Scout | 0 Critical, 0 High, 0 Medium, 0 Low | Does not identify the bundled binary findings |
| Trivy 0.74.0 | 0 Critical, 0 High, 12 Medium, 9 Low | Does not identify the bundled binary findings |
| Grype 0.118.0 | 1 Critical, 45 High, 168 Medium, 19 Low, 3 Negligible | Blocking result |

The disagreement is preserved without suppression or VEX. The stricter unresolved result governs.
The exact-image Trivy report SHA-256 is
`58cd31b0562420c6668b551e326bc1c9dc68849bf7cdd2d2319c99ef419b09dd`;
the exact-image Grype report SHA-256 is
`f0b17e6050c48efcbea8b6738e2a50104b40cf9fb1d500dcc843493f5bb1db96`.

## Exact remaining Critical and High components

| Locked Python package | Bundled component | Critical | High | Current fix status |
| --- | --- | ---: | ---: | --- |
| `opencv-contrib-python==4.10.0.84` | FFmpeg 5.1.4 | 1 | 30 | Critical `CVE-2026-40962` is reported fixed in FFmpeg 8.1; High fixes vary and several have no fix recorded by the scanner |
| `opencv-python-headless==5.0.0.93` | FFmpeg 8.1.1 | 0 | 15 | `CVE-2026-8461` is reported fixed in FFmpeg 8.1.2; several 2026 High findings have no fix recorded by the scanner |

The FFmpeg 5.1.4 High inventory is:

`CVE-2023-49502`, `CVE-2023-50008`, `CVE-2023-50010`, `CVE-2023-51791`,
`CVE-2023-51793`, `CVE-2023-51794`, `CVE-2023-51795`, `CVE-2023-51798`,
`CVE-2023-6605`, `CVE-2024-31582`, `CVE-2024-7055`, `CVE-2024-7272`,
`CVE-2025-1594`, `CVE-2025-9951`, `CVE-2026-30997`, `CVE-2026-30998`,
`CVE-2026-30999`, `CVE-2026-64830`, `CVE-2026-64832`, `CVE-2026-64833`,
`CVE-2026-64834`, `CVE-2026-64835`, `CVE-2026-65703`, `CVE-2026-65704`,
`CVE-2026-65705`, `CVE-2026-65706`, `CVE-2026-66036`, `CVE-2026-66039`,
`CVE-2026-66040`, `CVE-2026-8461`.

The FFmpeg 8.1.1 High inventory is:

`CVE-2026-64830`, `CVE-2026-64831`, `CVE-2026-64832`, `CVE-2026-64833`,
`CVE-2026-64834`, `CVE-2026-64835`, `CVE-2026-65703`, `CVE-2026-65704`,
`CVE-2026-65705`, `CVE-2026-65706`, `CVE-2026-66036`, `CVE-2026-66039`,
`CVE-2026-66040`, `CVE-2026-66041`, `CVE-2026-8461`.

PaddleX 3.7.2 exactly requires `opencv-contrib-python==4.10.0.84`, so replacing that
wheel outside the frozen supported graph would fail dependency integrity. The official
OpenCV Python package project also records that its current Linux wheels bundle FFmpeg;
see the [official PyPI project](https://pypi.org/project/opencv-contrib-python/) and
[upstream wheel issue 1212](https://github.com/opencv/opencv-python/issues/1212).

A bounded build of the exact official `opencv-contrib-python-4.10.0.84` source archive
(`SHA-256 4a3eae0ed9cadf1abe9293a6938a25a540e2fd6d7fc308595caa5896c8b36a0c`)
produced only a CPython 3.11 wheel and did not pass the post-build FFmpeg-disabled assertion.
It is not a supported substitute for the locked Python 3.12 worker and was not committed.

## SBOM and monitoring

The exact candidate SPDX 2.3 SBOM contains 326 SPDX packages (325 indexed packages):
209 Debian, 99 Python, 11 RPM-origin CUDA, 6 generic, and 1 OCI image package. Its SHA-256
is `c8c616d859540ac247e68b57d5c318a5b99737b7f7bd3e41fc3678adbd4ffefb`.
No private host path occurs in the SBOM. Docker Scout reported 0 Critical/High findings but
could not remove one temporary local image archive because another process held it; that
residue is outside the repository and is not represented as cleaned up.

The scheduled/manual dependency monitor rebuilds this digest-pinned source with the exact
external Paddle wheel, runs runtime-minimality checks, then runs unsuppressed Trivy and Grype
Critical/High gates against the same ephemeral image. It uploads no image or scanner artifact
and fails until both scanners return zero Critical and zero High findings.

PR #19 must remain open. No merge, release tag, activation, real-document processing, or
tracker clearance is permitted until a supported dependency set produces a clean exact image.
