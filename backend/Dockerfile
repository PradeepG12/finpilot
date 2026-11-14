# syntax=docker/dockerfile:1
FROM python:3.13-slim AS base

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Create non-root user
RUN groupadd --system appgroup && useradd --system --gid appgroup appuser

# Install dependencies
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy application code
COPY . .

# Set ownership
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

# Entrypoint: init (migrate + seed users) then optionally auto-seed data, then gunicorn
CMD ["sh", "-c", "\
    python manage.py init_app && \
    if [ \"$AUTO_SEED\" = 'true' ]; then \
        python manage.py seed_data_if_empty; \
    fi && \
    gunicorn config.wsgi:application \
        --bind 0.0.0.0:8000 \
        --workers 3 \
        --threads 2 \
        --timeout 60 \
        --access-logfile - \
        --error-logfile - \
"]
