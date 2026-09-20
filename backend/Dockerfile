FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY alembic.ini .
COPY alembic ./alembic

COPY src ./src

# Drop root for the runtime. Nothing is written to the filesystem: PYTHONDONTWRITEBYTECODE=1
# suppresses .pyc files, alembic only reads its migration scripts (its version bookkeeping
# lives in the database) and uvicorn logs to stdout. /app stays root-owned and read-only to
# this user, which is what we want.
RUN useradd --create-home --uid 1001 appuser
USER appuser

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
