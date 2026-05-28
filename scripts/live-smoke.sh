#!/usr/bin/env bash
# Live smoke test against a real Procurify tenant.
#
# Requires:
#   - procure on PATH (npm link OR npm install -g)
#   - either a configured profile (default: 'sandbox')
#   - or PROCURIFY_DOMAIN / _CLIENT_ID / _CLIENT_SECRET env vars
#
# Usage:
#   ./scripts/live-smoke.sh                    # uses --profile sandbox
#   PROFILE=prod ./scripts/live-smoke.sh
#   BILL_UUID=1f99cf4a8c8d4d4abf5a4d3a2c1e7b88 ./scripts/live-smoke.sh

set -euo pipefail

PROFILE="${PROFILE:-sandbox}"
BILL_UUID="${BILL_UUID:-}"
LOG_DIR="$(mktemp -d)"

echo "==> Profile:  ${PROFILE}"
echo "==> Logs in:  ${LOG_DIR}"
echo

echo "==> 1. procure --version"
procure --version
echo

echo "==> 2. procure login --profile ${PROFILE} (force fresh token)"
procure login --profile "${PROFILE}"
echo

echo "==> 3. procure whoami --profile ${PROFILE}"
procure whoami --profile "${PROFILE}" > "${LOG_DIR}/whoami.json"
head -c 500 "${LOG_DIR}/whoami.json"; echo "..."
echo

echo "==> 4. procure ap list-bills --max-items 3 (paginated, smoke)"
procure ap list-bills --profile "${PROFILE}" --max-items 3 \
  --output jsonl > "${LOG_DIR}/list-bills.ndjson"
wc -l "${LOG_DIR}/list-bills.ndjson"
echo

if [[ -n "${BILL_UUID}" ]]; then
  echo "==> 5. procure ap get-bill ${BILL_UUID}"
  procure ap get-bill "${BILL_UUID}" --profile "${PROFILE}" \
    > "${LOG_DIR}/bill.json"
  head -c 500 "${LOG_DIR}/bill.json"; echo "..."
  echo
else
  echo "==> 5. (skipped — set BILL_UUID=<hex-uuid> to test get-bill)"
  echo
fi

echo "==> 6. procure list-services / list-actions ap"
procure list-services > /dev/null
procure list-actions ap > /dev/null
echo "    ok"
echo

echo "==> 7. HAR capture smoke (3 requests)"
procure ap list-bills --profile "${PROFILE}" --max-items 3 \
  --debug --debug-har "${LOG_DIR}/smoke.har" \
  --log-format json --log-file "${LOG_DIR}/smoke.ndjson" \
  --output jsonl > /dev/null
echo "    HAR: ${LOG_DIR}/smoke.har"
echo "    Log: ${LOG_DIR}/smoke.ndjson"
echo "    Authorization headers in HAR (should all show as masked Bearer ...):"
jq -r '.log.entries[].request.headers[] | select(.name | ascii_downcase == "authorization") | .value' \
  "${LOG_DIR}/smoke.har" | head -3
echo

echo "==> All smoke steps passed."
echo "==> Artefacts: ${LOG_DIR}"
