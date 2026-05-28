# Examples

End-to-end recipes for common reporting, audit, and support tasks.

## 1. Resolve bills by UUID

The bill UI numbers shown in Procurify (e.g. **Bill #613**) are not the same as
the hex UUIDs used by the API. If you have a UUID, look it up directly:

### a. From a single UUID

```bash
procure ap get-bill 1f99cf4a8c8d4d4abf5a4d3a2c1e7b88 \
  --query "{id: id, ui_number: number, vendor: vendor.name, status: status, total: total_amount}"
```

### b. From a list of UUIDs

`bill-uuids.txt`:

```
1f99cf4a8c8d4d4abf5a4d3a2c1e7b88
2a88de5b7d9c5e5bcf6b5e4b3d2f8c99
3b77ef6c8eadbf6cdf7c6f5c4e3a9daa
…
```

Pipe them in (concurrent, validated against the hex pattern):

```bash
cat bill-uuids.txt \
  | procure ap get-bill - --output jsonl --concurrency 8 \
  > bills.ndjson

# turn it into a mapping CSV
jq -r '[.id, .number, .vendor.name, .status] | @csv' bills.ndjson \
  > bill-mapping.csv
```

## 2. Listing bills with filters

```bash
procure ap list-bills \
  --status approved \
  --posting-date-0 2026-04-01 \
  --posting-date-1 2026-04-30 \
  --page-size 100 \
  --max-items 1000 \
  --output csv \
  --columns id,vendor.name,total_amount,posting_date \
  > april-approved-bills.csv
```

Note the kebab-case `--posting-date-0` becomes `posting_date_0` query param.

## 3. Server-side CSV export

For really large pulls, ask Procurify to render the CSV (saves the round-trip):

```bash
procure ap list-bills \
  --status approved \
  --server-format csv \
  > approved-bills.csv
```

## 4. Walk every active user

```bash
procure users list-users \
  --is-active true \
  --output jsonl \
  --query "[].{id: id, email: email, dept: department.name, loc: location.name}" \
  > users.ndjson
```

## 5. Find admin permission groups

```bash
procure permissions list-groups --output jsonl \
  | jq 'select(.name | test("admin"; "i"))'
```

## 6. Audit a vendor's purchase history

```bash
VENDOR_ID=99
procure purchase-orders get-billing-history --vendor "$VENDOR_ID" \
  --output csv > vendor-${VENDOR_ID}-bills.csv

procure order-items list-order-items --vendor "$VENDOR_ID" \
  --output csv > vendor-${VENDOR_ID}-items.csv
```

## 7. Pay transactions with the top-level pagination shape

The `pay` service uses Procurify's newer `pagination.next` shape (top-level,
not nested under `metadata`). The CLI handles this automatically:

```bash
procure pay list-transactions \
  --start-date 2026-04-01 --end-date 2026-04-30 \
  --output jsonl > april-pay.ndjson
```

## 8. Drop down to `raw` for an unregistered endpoint

```bash
procure raw GET /api/v3/some-new-experimental-endpoint/

procure raw POST /api/v3/foo/ --body '{"key":"value"}'

procure raw POST /api/v3/foo/ --body @payload.json
```

## 9. Multiple path parameters

Some actions take more than one — supply them positionally in declaration
order, or as flags:

```bash
procure purchase-orders list-by-role-status approver pending
procure purchase-orders list-by-role-status --role approver --status pending
```

## 10. Budget remaining for a department

`accounts list-accounts` returns per-GL-code line items (mostly zeroed) — for
the **headline budget figure** shown in the Procurify UI, use
`budget-categories list-budget-categories`. The endpoint returns `budget`,
`pending`, `approved`, `purchased`, `invoiced`, `received`, and a `variance`
field that is the remaining amount.

```bash
# Find the department id
procure departments list-departments \
  --search "Marketing" \
  --output table --columns id,name

# Headline budget + remaining for that department
procure budget-categories list-budget-categories \
  --departments 12 --output json \
  --query "[].{name: name, period_end: end_datetime, budget: budget, invoiced: invoiced, purchased: purchased, remaining: variance, pct_remaining: variance_percentage}"
```

Sample output:

```json
[
  {
    "name": "Marketing",
    "period_end": "2026-12-31T23:59:59.999000+00:00",
    "budget": "50000.00",
    "invoiced": "32000.00",
    "purchased": "500.00",
    "remaining": "17500.00",
    "pct_remaining": "0.35"
  }
]
```

## 11. Capture a HAR for a Procurify support ticket

When something looks wrong server-side, capture the trace:

```bash
procure ap get-bill 1f99cf4a8c8d4d4abf5a4d3a2c1e7b88 \
  --debug --debug-har bill-fail.har \
  --log-format json --log-file bill-fail.ndjson
```

The HAR file masks Authorization headers and any sensitive JSON keys before
writing — safe to attach to a Procurify ticket.
