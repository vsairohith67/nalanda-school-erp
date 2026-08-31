FROM ubuntu:24.04@sha256:33ceb71981b602c1a7443a53469e4dba065f7503eab3078a2d7a57a2ab987517 AS builder
ENV DEBIAN_FRONTEND=noninteractive UV_COMPILE_BYTECODE=1 UV_HTTP_TIMEOUT=1200 UV_LINK_MODE=copy VIRTUAL_ENV=/runtime/.venv PATH=/runtime/.venv/bin:/usr/local/bin:/usr/bin:/bin
WORKDIR /benchmark
RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
        ca-certificates=20260601~24.04.1 \
        python3=3.12.3-0ubuntu2.1 \
        python3-pip=24.0+dfsg-1ubuntu1.3 \
        python3-venv=3.12.3-0ubuntu2.1 \
    && python3 -m pip install --break-system-packages --no-cache-dir uv==0.12.5
COPY tools/ocr-benchmark/pyproject.toml tools/ocr-benchmark/uv.lock tools/ocr-benchmark/README.md ./
COPY tools/ocr-benchmark/src ./src
COPY tools/ocr-benchmark/candidates/candidate-lock.json ./candidates/candidate-lock.json
COPY tools/ocr-benchmark/candidates/paddle/pyproject.toml tools/ocr-benchmark/candidates/paddle/uv.lock ./candidates/paddle/
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,from=paddlewheel,source=.,target=/mnt/paddlewheel,ro \
    mkdir -p /runtime \
    && echo 'b1500120002c2bf4542c841e25296cf10c52e0d395053aa395f79bd9c0303cce  /mnt/paddlewheel/paddlepaddle_gpu-3.3.1-cp312-cp312-linux_x86_64.whl' | sha256sum --check --strict \
    && uv sync --project candidates/paddle --frozen --no-dev --no-editable --no-install-package paddlepaddle-gpu \
    && uv pip install --python candidates/paddle/.venv/bin/python --no-deps /mnt/paddlewheel/paddlepaddle_gpu-3.3.1-cp312-cp312-linux_x86_64.whl \
    && uv pip check --python candidates/paddle/.venv/bin/python \
    && mv candidates/paddle/.venv /runtime/.venv

FROM ubuntu:24.04@sha256:33ceb71981b602c1a7443a53469e4dba065f7503eab3078a2d7a57a2ab987517 AS ocr_scanning_foundation_1b
ENV DEBIAN_FRONTEND=noninteractive PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 VIRTUAL_ENV=/runtime/.venv PATH=/runtime/.venv/bin:/usr/local/bin:/usr/bin:/bin
WORKDIR /benchmark
RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
        libegl1=1.7.0-1build1 \
        libgl1=1.7.0-1build1 \
        libglib2.0-0t64=2.80.0-6ubuntu3.8 \
        libgomp1=14.2.0-4ubuntu2~24.04.1 \
        libp11-kit0=0.25.3-4ubuntu2.2 \
        libssl3t64=3.0.13-0ubuntu3.15 \
        python3=3.12.3-0ubuntu2.1 \
    && apt-get purge --yes --allow-remove-essential perl-base \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /usr/share/doc/* /usr/share/man/* \
    && ! command -v perl \
    && ! find /usr -type f \( -name 'IO.pm' -o -path '*/IO/Compress/*' \) -print -quit | grep -q . \
    && dpkg --audit \
    && python3 -c "import hashlib, ssl; assert ssl.OPENSSL_VERSION.startswith('OpenSSL 3.0.13 '); hashlib.sha256(b'nalanda').hexdigest()"
COPY --from=builder /runtime/.venv /runtime/.venv
COPY tools/ocr-benchmark/src ./src
COPY tools/ocr-benchmark/candidates/candidate-lock.json ./candidates/candidate-lock.json
COPY tools/ocr-worker/runtime/main.py /runtime/main.py
LABEL org.opencontainers.image.title="Nalanda local OCR worker" org.opencontainers.image.version="1b-r1" nalanda.ocr.engine="paddleocr-3.7.0" nalanda.ocr.runtime="paddlepaddle-gpu-3.3.1" nalanda.ocr.base="ubuntu-24.04-lts"
USER 65532:65532
ENTRYPOINT ["python", "/runtime/main.py"]
