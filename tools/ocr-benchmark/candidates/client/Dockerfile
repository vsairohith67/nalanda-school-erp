FROM python:3.12.10-slim-bookworm@sha256:97983fa8cc88343512862c62307159a82261c3528dc025f79e5a3f7af43e50b4

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    VIRTUAL_ENV=/benchmark/.venv \
    PATH=/benchmark/.venv/bin:/usr/local/bin:/usr/bin:/bin

WORKDIR /benchmark
RUN python -m pip install --no-cache-dir uv==0.12.5
COPY pyproject.toml uv.lock README.md ./
COPY src ./src
RUN uv sync --frozen --no-dev --no-editable && \
    find /benchmark/.venv -type d -name __pycache__ -prune -exec rm -rf '{}' +

USER 65532:65532
ENTRYPOINT ["python", "-m", "nalanda_ocr_benchmark"]
