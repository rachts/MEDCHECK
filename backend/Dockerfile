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
RUN groupadd -r medcheck && useradd -r -g medcheck -s /bin/false -m -d /home/medcheck medcheck

# Copy installed Python packages with correct ownership
COPY --from=builder --chown=medcheck:medcheck /root/.local /home/medcheck/.local
RUN chown -R medcheck:medcheck /home/medcheck/.local

ENV PATH=/home/medcheck/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1
ENV SQLITE_DB_PATH=/app/data/local_cache.db

# Create persistent data directory
RUN mkdir -p /app/data && chown -R medcheck:medcheck /app

COPY --chown=medcheck:medcheck . /app

USER medcheck

EXPOSE 8000

# start-period must cover the slowest cold start, not the fastest. Importing the
# app runs the SQLite schema migration, the expired-row sweep and the curated
# knowledge-base load before uvicorn binds; on a cold volume or a throttled
# container that exceeds 5s, and the container was then marked unhealthy and
# restarted before it had ever finished starting. Failures inside the start
# period do not count toward --retries, so a generous window costs nothing.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
