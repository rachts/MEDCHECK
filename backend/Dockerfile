# ==============================================================================
# MEDCHECK Backend Production Dockerfile
# Multi-stage lightweight Python container with security hardening
# ==============================================================================

FROM python:3.11-slim as builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Final runtime image
FROM python:3.11-slim as runtime

WORKDIR /app

# Create non-root clinical user
RUN groupadd -r medcheck && useradd -r -g medcheck -s /bin/false medcheck

# Copy installed Python packages
COPY --from=builder /root/.local /home/medcheck/.local
ENV PATH=/home/medcheck/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1
ENV SQLITE_DB_PATH=/app/data/local_cache.db

# Create persistent data directory
RUN mkdir -p /app/data && chown -R medcheck:medcheck /app

COPY --chown=medcheck:medcheck . /app

USER medcheck

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
