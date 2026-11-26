#!/usr/bin/env bash
# Fails if redact.pl lets a known secret shape through.
set -e
dir="$(dirname "$0")"
out=$(printf '%s\n' \
  'DATABASE_URL=postgresql://postgres:hunter2@db.example.com:5432/postgres' \
  'CHROME_PLUGIN_TOKEN=abc123secret' \
  'OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz' \
  'Authorization: Bearer abcdefghijklmnop1234' \
  'key AKIAABCDEFGHIJKLMNOP' | perl -p "$dir/redact.pl")
for secret in hunter2 abc123secret abcdefghijklmnopqrstuvwxyz abcdefghijklmnop1234 AKIAABCDEFGHIJKLMNOP; do
  if grep -q "$secret" <<<"$out"; then echo "redactor leaked: $secret"; exit 1; fi
done
echo "redaction ok"
