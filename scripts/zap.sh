#!/usr/bin/env bash
# OWASP ZAP scan of the built app against the stand-in Wix and Supertext APIs, with a signed Wix
# instance (the second layer of the security audit; CI: .github/workflows/security-scan.yml).
#   npm run build && bash scripts/zap.sh            # baseline: spider + passive checks
#   npm run build && bash scripts/zap.sh full       # also the active scan (attacks; local only)
# Needs Docker (image ghcr.io/zaproxy/zaproxy:stable, or ZAP_IMAGE). The report goes to zap-report/.
# Exit code 0: no alerts beyond the accepted ones in .zap/rules.tsv; otherwise ZAP's (1: failures,
# 2: warnings). Pages carry the instance in the URL (as Wix opens them); API calls in X-Wix-Instance.
set -euo pipefail
cd "$(dirname "$0")/.."
mode=${1:-baseline}
work=$(mktemp -d)
app=http://127.0.0.1:8080
out="$PWD/zap-report"
mkdir -p "$out"
chmod 777 "$out"
cleanup() { kill $(jobs -p) 2>/dev/null || true; }
trap cleanup EXIT

export WIX_APP_ID=zap WIX_APP_SECRET=standin-secret WIX_API_BASE=http://127.0.0.1:8766 \
  SUPERTEXT_API_ENDPOINT=http://127.0.0.1:8765/v1/ SUPERTEXT_API_KEY=zap-key \
  SUPERTEXT_API_KEY_INSTANCE=7c3e1d2a-5b4f-4e6a-9c8d-0f1e2d3c4b5a SUPERTEXT_REPORT_URL=http://127.0.0.1:8765/report PORT=8080
npx tsx tests/standin/server.ts > "$work/standin.log" 2>&1 &
node dist/server.js > "$work/app.log" 2>&1 &
for i in $(seq 1 30); do curl -fs $app/health > /dev/null && grep -q "$app/?instance=" "$work/standin.log" && break; sleep 1; done
url=$(grep -o "$app/?instance=[^ ]*" "$work/standin.log" | head -1)
[ -n "$url" ] || { echo "No dashboard URL from the stand-in"; cat "$work/standin.log" "$work/app.log"; exit 1; }
instance=$(sed -E 's/.*instance=([^&]*).*/\1/' <<< "$url")
curl -fs -o /dev/null "$url" || { echo "The dashboard page doesn't load"; cat "$work/app.log"; exit 1; }

# The instance header on every request ZAP sends (for the API calls); no form posts by the spider.
zap_options="-config replacer.full_list(0).description=instance \
-config replacer.full_list(0).enabled=true \
-config replacer.full_list(0).matchtype=REQ_HEADER \
-config replacer.full_list(0).matchstr=X-Wix-Instance \
-config replacer.full_list(0).regex=false \
-config replacer.full_list(0).replacement=$instance \
-config spider.postForm=false -config spider.processForm=false"

# Alerts the app accepts: .zap/rules.tsv (copied next to the report, where ZAP reads it).
cp .zap/rules.tsv "$out/rules.tsv"
script=zap-baseline.py
[ "$mode" = full ] && script=zap-full-scan.py
status=0
docker run --rm --network host -v "$out:/zap/wrk:rw" -t "${ZAP_IMAGE:-ghcr.io/zaproxy/zaproxy:stable}" \
  "$script" -t "$url" -m 3 -c rules.tsv -r report.html -J report.json -w report.md \
  -z "$zap_options" || status=$?
echo "ZAP finished (exit $status); report in $out"
exit $status
