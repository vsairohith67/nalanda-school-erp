FROM python:3.12.10-slim-bookworm@sha256:97983fa8cc88343512862c62307159a82261c3528dc025f79e5a3f7af43e50b4

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_HTTP_TIMEOUT=1200 \
    UV_LINK_MODE=copy \
    VIRTUAL_ENV=/benchmark/candidates/paddle/.venv \
    PATH=/benchmark/candidates/paddle/.venv/bin:/usr/local/bin:/usr/bin:/bin

WORKDIR /benchmark
RUN python -m pip install --no-cache-dir uv==0.12.5
COPY pyproject.toml uv.lock README.md ./
COPY src ./src
COPY candidates/candidate-lock.json ./candidates/candidate-lock.json
COPY candidates/paddle/pyproject.toml candidates/paddle/uv.lock ./candidates/paddle/
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --project candidates/paddle --frozen --no-dev --no-editable && \
    find /benchmark/candidates/paddle/.venv -type d -name __pycache__ -prune -exec rm -rf '{}' +
RUN apt-get update && \
    apt-get install --yes --no-install-recommends libegl1 libgl1 libglib2.0-0 libgomp1 && \
    rm -rf /var/lib/apt/lists/*

USER 65532:65532
ENTRYPOINT ["python", "-m", "nalanda_ocr_benchmark"]
