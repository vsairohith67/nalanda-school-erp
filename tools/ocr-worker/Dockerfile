FROM nalanda-ocr-paddle:1a AS benchmark_cleared_runtime

FROM python:3.12.10-slim-bookworm@sha256:97983fa8cc88343512862c62307159a82261c3528dc025f79e5a3f7af43e50b4 AS ocr_scanning_foundation_1b
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 VIRTUAL_ENV=/benchmark/candidates/paddle/.venv PATH=/benchmark/candidates/paddle/.venv/bin:/usr/local/bin:/usr/bin:/bin
WORKDIR /benchmark
RUN apt-get update \
    && apt-get full-upgrade --yes \
    && apt-get install --yes --no-install-recommends libegl1 libgl1 libglib2.0-0 libgomp1 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
COPY --from=benchmark_cleared_runtime /benchmark/candidates/paddle/.venv /benchmark/candidates/paddle/.venv
COPY tools/ocr-benchmark/src ./src
COPY tools/ocr-benchmark/candidates/candidate-lock.json ./candidates/candidate-lock.json
COPY tools/ocr-worker/runtime/main.py /runtime/main.py
LABEL org.opencontainers.image.title="Nalanda local OCR worker" org.opencontainers.image.version="1b" nalanda.ocr.engine="paddleocr-3.7.0" nalanda.ocr.runtime="paddlepaddle-gpu-3.3.1" nalanda.ocr.base="benchmark-cleared-1a"
USER 65532:65532
ENTRYPOINT ["python", "/runtime/main.py"]
