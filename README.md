# procure-cli

An unofficial command-line client for the [Procurify](https://www.procurify.com/)
REST API. It is a thin convenience wrapper around Procurify's OAuth 2.0
client-credentials API for finance, operations, and engineering staff who need
to inspect or reconcile tenant data from a terminal or a script.

It exposes read-only (GET) operations across Procurify's services, plus a small
set of targeted mutating actions for vendors and AP bills (PATCH) — see
[Mutating actions](#mutating-actions). Other resources remain read-only by
design; for one-off mutations beyond the named actions, use the escape hatch
[`raw`](#raw-command-escape-hatch) command with an explicit method and body.

> **API stability.** Commands fall into two tiers. **Supported** commands map to
> endpoints in Procurify's published API documentation and are expected to be
> stable. **Unstable** commands target methods, events, or properties that are
> not in the published documentation. Per Procurify's own API disclaimer,
> undocumented aspects of the API may change at any time and are relied on **at
> your own risk** — unstable commands can break or be removed without notice.

> **Disclaimer.** This is an independent, community-maintained tool. It is
> **not** affiliated with, endorsed by, sponsored by, or supported by Procurify
> Technologies Inc. "Procurify" is a trademark of its respective owner and is
> used here only nominatively to describe what the API targets. The software is
> provided "as is", without warranty of any kind. **You** are responsible for
> ensuring your use of the Procurify API complies with your own agreement with
> Procurify (Subscription Services Agreement, API terms, and Acceptable Use
> Policy). Procurify may change its API at any time, including undocumented
> endpoints and behaviour.

---

## Table of contents

1. [Quick start](#quick-start)
2. [Installation](#installation)
3. [Authentication](#authentication)
4. [Command shape](#command-shape)
5. [Global flags](#global-flags)
6. [Output formats](#output-formats)
7. [Filtering and querying](#filtering-and-querying)
8. [Pagination](#pagination)
9. [API reference](#api-reference)
10. [Mixed API versions (v2, v3, public/v1)](#mixed-api-versions)
11. [Common recipes](#common-recipes)
11b. [Path parameters: positional vs flag](#path-parameters)
11c. [Mutating actions](#mutating-actions)
12. [Debug mode and observability](#debug-mode-and-observability)
13. [Profiles and credential storage](#profiles-and-credential-storage)
14. [Troubleshooting](#troubleshooting)
15. [Security model](#security-model)
16. [Contributing](#contributing)
17. [Testing](#testing)
18. [Release process](#release-process)
19. [License](#license)

---

## Quick start

**Prerequisites:** Node.js >= 20 and Procurify OAuth client-credentials (see
[Authentication](#authentication)).

```bash
# 1. Install from npm
npm install -g procure-cli

# 2. Configure and authenticate
procure configure --profile sandbox
procure login --profile sandbox

procure whoami --profile sandbox

procure ap list-bills --profile sandbox --page-size 50 --max-items 100
procure ap get-bill 1f99cf4a8c8d4d4abf5a4d3a2c1e7b88 --profile sandbox
```

---

## Installation

### Global install

```bash
npm install -g procure-cli
procure --version
```

### One-off via npx

```bash
npx procure-cli --help
```

### Local clone (for contributors)

```bash
git clone https://github.com/Gribbs/procure-cli.git
cd procure-cli
npm install
npm test
npm link
procure --version
```

### Verify install

```bash
procure --version
procure --help
procure list-services
```

---

## Authentication

Procurify uses the **OAuth 2.0 client-credentials** grant (machine-to-machine).
Note that the credential inherits the permissions of the Procurify user who
created the application. The provisioning flow is:

1. **Sign in to Procurify as the user who will own the application.** The
   OAuth application is bound to whoever creates it, and runs with that user's
   role. For a personal/exploratory install you can use your own account; for a
   shared integration you should create a dedicated Procurify user first (see
   [How Procurify permissions work](#how-procurify-permissions-work)).
2. **Settings → Integrations → Procurify API → Create Application.** Give it a
   description and copy the **Client ID** and **Client Secret**. The secret is
   shown **exactly once**; capture it straight into `procure configure` or your
   password manager.
3. Configure the CLI:

```bash
procure configure --profile sandbox
# prompts for: subdomain (full URLs accepted), client id, client secret (masked)
```

Token caching:

- Procurify issues long-lived tokens; the CLI honours whatever `expires_in`
  (seconds) the server returns rather than assuming a fixed lifetime.
- The token is cached on disk inside the encrypted profile.
- The CLI re-fetches transparently when within 5 min of expiry, or on a
  401 response.
- There is no refresh-token grant; re-fetching simply re-runs the
  client-credentials flow with the stored Client ID + Secret.

You can also override per-process via env vars (env wins over profile):

```bash
export PROCURIFY_DOMAIN=acme
export PROCURIFY_CLIENT_ID=…
export PROCURIFY_CLIENT_SECRET=…
procure whoami
```

### How Procurify permissions work

A few characteristics of Procurify's OAuth model are worth understanding before
operating this in anything beyond a personal install:

- **OAuth applications are per-user-owned.** Each Procurify user can create
  their own application via *Settings → Integrations → Procurify API*, and the
  page only displays applications **that user** owns.
- **Each application is bound to its creator and runs as that creator.**
  `procure whoami` returns the Procurify *user record* the application is bound
  to. API calls are attributed to that user; there is no separate "service
  account" identity unless you deliberately create one.
- **Effective permissions = the bound user's role.** There is no read-only
  toggle or per-endpoint permission grid on the application; to restrict what an
  application can do, restrict the *role* of the user that owns it.
- **Off-boarding fragility.** If the bound user's account is deactivated or has
  its role reduced, every integration using that application's credentials
  breaks. This makes a personal-account-bound application a poor choice for
  anything other than ad-hoc exploration.
- **Service-account pattern (recommended for shared integrations).** Create a
  dedicated Procurify user with a tightly-scoped role, then **log in as that
  user** and create the OAuth application from inside its session, so the
  application inherits the service account's identity and role.
- **Treat each Client Secret as a credential for the bound user.** Anyone with
  read access to the profile file (or the matching `PROCURIFY_*` env vars) can
  call the API as the user that owns the application. The on-disk file is
  encrypted at rest (see
  [Profiles and credential storage](#profiles-and-credential-storage)).

---

## Command shape

```
procure <service> <action> [positional path-params] [--filters] [--global-flags]
```

Examples:

```bash
procure ap list-bills --status approved --page-size 50
procure ap get-bill 1f99cf4a8c8d4d4abf5a4d3a2c1e7b88
procure ap get-bill --id 1f99cf4a8c8d4d4abf5a4d3a2c1e7b88
procure vendors list-vendors preferred --page-size 100
procure purchase-orders list-by-role-status approver pending
```

There are also a few top-level commands that aren't `<service> <action>`:

| Command | Purpose |
| --- | --- |
| `procure configure` | Create / edit an encrypted profile |
| `procure login` | Force a fresh OAuth token fetch |
| `procure whoami` | GET `/api/v3/users/me/` for sanity |
| `procure list-services` | List the known service tags |
| `procure list-actions <service>` | List actions for a service |
| `procure list-profiles` | List configured profile names |
| `procure raw <method> <path>` | Arbitrary authenticated request |

---

## Global flags

These flags are available on every action (and most top-level commands):

| Flag | Default | Purpose |
| --- | --- | --- |
| `-p, --profile <name>` | `$PROCURE_PROFILE` or `default` | Profile to use |
| `-o, --output <fmt>` | `json` | Output format: `json`, `jsonl`, `csv`, `tsv`, `table` |
| `-q, --query <expr>` | — | JMESPath expression applied after pagination |
| `--columns <list>` | — | Comma-separated dotted paths to include |
| `--max-items <n>` | unlimited | Stop after N records across all pages |
| `--page-size <n>` | server default | First-request `?page_size=` |
| `--server-format <fmt>` | — | Pass `?format=csv` (server-side CSV) |
| `--api-version <v>` | descriptor default | Override path version segment (e.g. `v3`) |
| `--concurrency <n>` | `4` | Parallel requests when reading IDs from stdin |
| `--debug` | off | Stream debug logs to stderr |
| `--debug-har <path>` | — | Write a HAR 1.2 file of the HTTP exchange |
| `--log-format <fmt>` | `text` | `text` or `json` for debug log lines |
| `--log-file <path>` | — | Mirror debug output to a file (append) |
| `--quiet` | off | Suppress non-error stderr |
| `--no-color` | off | Disable ANSI colour |

---

## Output formats

| Format | Description | Use it for |
| --- | --- | --- |
| `json` (default) | Pretty array of records | Quick inspection, piping into `jq` |
| `jsonl` | One JSON object per line | Streaming, log aggregators, large lists |
| `csv` | Header row + flattened rows | Spreadsheet review, diffing |
| `tsv` | TSV variant of csv | spreadsheet pasting |
| `table` | Pretty ASCII table | Terminal eyeballing |

Nested objects are flattened with dot notation (`meta.dept`). Primitive arrays
are joined with `|`. Object arrays expand by index (`users.0.id`,
`users.1.id`).

---

## Filtering and querying

### Server-side filters (passthrough)

Any unknown `--flag value` is forwarded as a query parameter. Kebab-case is
converted to snake_case to match Procurify's convention:

```bash
procure ap list-bills --status approved --vendor 99 --page-size 50
# → GET /api/v3/ap/bills/?status=approved&vendor=99&page_size=50
```

`--help` for each action lists the filters the registry knows about. Anything
not in that list is still forwarded — Procurify just ignores unknown params.

### Client-side projection / filtering

`--query` is a [JMESPath](https://jmespath.org/) expression applied after all
pages are gathered:

```bash
procure ap list-bills --max-items 200 \
  --query "[?status=='approved'].{id: id, total: total_amount, vendor: vendor.name}"
```

`--columns name1,name2.nested` flattens results to just those paths (mostly
useful with `csv`/`tsv`/`table`).

---

## Pagination

Procurify uses **two** pagination shapes:

1. `metadata.pagination.next` (most v2/v3 endpoints, including `ap.bills`).
2. Top-level `pagination.next` (Pay, receipt items).

Each action's descriptor declares which shape it uses, so the runner follows
the right `next` link automatically. The host portion of `next` URLs is
stripped before the next request is issued.

- `--page-size <n>` — page size for the first request.
- `--max-items <n>` — stop after N records (saves API calls).

Server-side CSV (where supported) is also available via `--server-format csv`,
which streams the raw bytes from the server straight to stdout.

---

## API reference

Every supported service and action is listed below. This block is generated
from `lib/services/`; run `npm run docs` to refresh after editing
descriptors.

<!-- BEGIN AUTO-GENERATED API REFERENCE -->

> Auto-generated from `lib/services/`. Do not edit by hand —
> regenerate with `npm run docs`.

### `permissions` — Procurify permissions and permission groups.

Default API version: `v3`

| Action | Method | Path | API | Path params | Paginated | Common filters |
| --- | --- | --- | --- | --- | --- | --- |
| `list-permissions` | GET | `/api/v3/permissions/` | v3 | — | yes (metadata.pagination) | `--search`, `--order-by`, `--page-size`, `--format` |
| `list-groups` | GET | `/api/v3/permissions/groups/` | v3 | — | yes (metadata.pagination) | `--search`, `--order-by`, `--page-size`, `--format` |

### `users` — Procurify users (people in the tenant).

Default API version: `v3`

| Action | Method | Path | API | Path params | Paginated | Common filters |
| --- | --- | --- | --- | --- | --- | --- |
| `list-users` | GET | `/api/v3/users/` | v3 | — | yes (metadata.pagination) | `--search`, `--order-by`, `--page-size`, `--format`, `--is-active`, `--permission`, `--departments`, `--locations` |
| `get-user` | GET | `/api/v3/users/{id}/` | v3 | `id` (pattern) | no | — |
| `whoami` | GET | `/api/v3/users/me/` | v3 | — | no | — |

### `locations` — Locations (note: v2 endpoints).

Default API version: `v2`

| Action | Method | Path | API | Path params | Paginated | Common filters |
| --- | --- | --- | --- | --- | --- | --- |
| `list-locations` | GET | `/api/v2/locations/` | v2 | — | yes (metadata.pagination) | `--search`, `--order-by`, `--page-size`, `--format`, `--is-active` |
| `get-location` | GET | `/api/v2/locations/{id}/` | v2 | `id` (pattern) | no | — |

### `departments` — Departments / cost centres.

Default API version: `v3`

| Action | Method | Path | API | Path params | Paginated | Common filters |
| --- | --- | --- | --- | --- | --- | --- |
| `list-departments` | GET | `/api/v3/departments/` | v3 | — | yes (metadata.pagination) | `--search`, `--order-by`, `--page-size`, `--format`, `--permission`, `--requestable`, `--location-perm-override`, `--locations`, `--is-active` |

### `account-codes` — Account codes (Procurify GL coding).

Default API version: `v3`

| Action | Method | Path | API | Path params | Paginated | Common filters |
| --- | --- | --- | --- | --- | --- | --- |
| `list-account-codes` | GET | `/api/v3/account-codes/` | v3 | — | yes (metadata.pagination) | `--search`, `--order-by`, `--page-size`, `--format`, `--is-active` |

### `accounts` — Chart-of-accounts (distinct from account-codes).

Default API version: `v3`

| Action | Method | Path | API | Path params | Paginated | Common filters |
| --- | --- | --- | --- | --- | --- | --- |
| `list-accounts` | GET | `/api/v3/accounts/` | v3 | — | yes (metadata.pagination) | `--search`, `--order-by`, `--page-size`, `--format`, `--with-expired-budgets`, `--in-effect`, `--departments`, `--locations`, `--account-code` |

### `budget-categories` — Department/account-code budget categories (the source of the headline budget figures shown in the Procurify UI).

Default API version: `v3`

| Action | Method | Path | API | Path params | Paginated | Common filters |
| --- | --- | --- | --- | --- | --- | --- |
| `list-budget-categories` | GET | `/api/v3/budget-categories/` | v3 | — | yes (metadata.pagination) | `--search`, `--order-by`, `--page-size`, `--format`, `--departments`, `--locations`, `--users`, `--account-codes` |

### `vendors` — Vendor catalog. The list endpoint takes a {vendor_group} path-param enum.

Default API version: `v3`

| Action | Method | Path | API | Path params | Paginated | Common filters |
| --- | --- | --- | --- | --- | --- | --- |
| `list-vendors` | GET | `/api/v3/vendors/{vendor_group}/` | v3 | `vendor_group` (enum: all, default, preferred, purchasable, requestable, other, credit_card_providers) | yes (metadata.pagination) | `--search`, `--order-by`, `--page-size`, `--format` |
| `get-vendor` | GET | `/api/v3/vendors/{id}/` | v3 | `id` (pattern) | no | — |
| `update-vendor` | PATCH | `/api/v3/vendors/{id}/` | v3 | `id` (pattern) | no | — |
| `touch-vendor` | PATCH | `/api/v3/vendors/{id}/` | v3 | `id` (pattern) | no | — |

### `currencies` — Supported currencies (note: v2).

Default API version: `v2`

| Action | Method | Path | API | Path params | Paginated | Common filters |
| --- | --- | --- | --- | --- | --- | --- |
| `list-currencies` | GET | `/api/v2/currencies/` | v2 | — | yes (metadata.pagination) | `--search`, `--order-by`, `--page-size`, `--format` |

### `catalog` — Catalog bundles and items.

Default API version: `v3`

| Action | Method | Path | API | Path params | Paginated | Common filters |
| --- | --- | --- | --- | --- | --- | --- |
| `list-bundles` | GET | `/api/v3/catalog-bundles/` | v3 | — | yes (metadata.pagination) | `--search`, `--order-by`, `--page-size`, `--format` |
| `list-items` | GET | `/api/v3/catalog-items/` | v3 | — | yes (metadata.pagination) | `--search`, `--order-by`, `--page-size`, `--format`, `--vendor`, `--is-active` |

### `requisitions` — Requisitions / global orders (mixed v2 + v3 endpoints).

Default API version: `v2`

| Action | Method | Path | API | Path params | Paginated | Common filters |
| --- | --- | --- | --- | --- | --- | --- |
| `list-orders` | GET | `/api/v2/global/orders/` | v2 | — | yes (metadata.pagination) | `--search`, `--order-by`, `--page-size`, `--format`, `--status`, `--submitter`, `--department`, `--location` |
| `list-order-items` | GET | `/api/v2/global/order_items/` | v2 | — | yes (metadata.pagination) | `--search`, `--order-by`, `--page-size`, `--format`, `--status`, `--department`, `--location` |

### `purchase-orders` — Purchase orders (v3 with v2 legacy endpoints).

Default API version: `v3`

| Action | Method | Path | API | Path params | Paginated | Common filters |
| --- | --- | --- | --- | --- | --- | --- |
| `get-purchase-order` | GET | `/api/v2/purchase_orders/{id}/` | v2 | `id` (pattern) | no | — |
| `list-by-role-status` | GET | `/api/v2/purchase_orders/{role}/{status}/` | v2 | `role` (enum: approver, submitter, purchaser, requester)<br>`status` (enum: pending, approved, denied, received, closed) | yes (metadata.pagination) | `--search`, `--order-by`, `--page-size`, `--format` |
| `get-billing-history` | GET | `/api/v3/purchase-orders/billing-history/` | v3 | — | yes (metadata.pagination) | `--search`, `--order-by`, `--page-size`, `--format`, `--vendor`, `--department`, `--location` |

### `order-items` — Order items (extensive filter set).

Default API version: `v3`

| Action | Method | Path | API | Path params | Paginated | Common filters |
| --- | --- | --- | --- | --- | --- | --- |
| `list-order-items` | GET | `/api/v3/order-items/` | v3 | — | yes (metadata.pagination) | `--search`, `--order-by`, `--page-size`, `--format`, `--status`, `--orderNum--status`, `--departments`, `--locations`, `--vendor`, `--approved-datetime-0`, `--approved-datetime-1`, `--last-modified-0`, `--last-modified-1`, `--purchased-date-0`, `--purchased-date-1` |

### `ap` — Accounts payable: bills, payments, payment methods, items.

Default API version: `v3`

| Action | Method | Path | API | Path params | Paginated | Common filters |
| --- | --- | --- | --- | --- | --- | --- |
| `list-bills` | GET | `/api/v3/ap/bills/` | v3 | — | yes (metadata.pagination) | `--search`, `--order-by`, `--page-size`, `--format`, `--vendor`, `--vendor-group-ids`, `--department`, `--location`, `--status`, `--sync-status`, `--has-payment`, `--exclude-expense-bills`, `--exported-only`, `--last-export-user`, `--posting-date-0`, `--posting-date-1`, `--invoice-date-0`, `--invoice-date-1`, `--last-modified-datetime-0`, `--last-modified-datetime-1`, `--payment-date-0`, `--payment-date-1`, `--submitted-date-0`, `--submitted-date-1`, `--type`, `--account-code` |
| `get-bill` | GET | `/api/v2/ap/bills/{id}/` | v2 | `id` (pattern) | no | — |
| `update-bill` | PATCH | `/api/v3/ap/bills/{id}/` | v3 | `id` (pattern) | no | — |
| `touch-bill` | PATCH | `/api/v3/ap/bills/{id}/` | v3 | `id` (pattern) | no | — |
| `list-items` | GET | `/api/v2/ap/items/` | v2 | — | yes (metadata.pagination) | `--search`, `--order-by`, `--page-size`, `--format` |
| `list-payments` | GET | `/api/v2/ap/payments/` | v2 | — | yes (metadata.pagination) | `--search`, `--order-by`, `--page-size`, `--format`, `--vendor`, `--status`, `--payment-date-0`, `--payment-date-1` |
| `get-payment-approver-choices` | GET | `/api/v2/ap/payments/{id}/approver-choices/` | v2 | `id` (pattern) | no | — |
| `list-company-payment-methods` | GET | `/api/v2/ap/company-payment-methods/` | v2 | — | yes (metadata.pagination) | `--search`, `--order-by`, `--page-size`, `--format` |
| `list-vendor-payment-methods` | GET | `/api/v2/ap/vendor-payment-methods/` | v2 | — | yes (metadata.pagination) | `--search`, `--order-by`, `--page-size`, `--format`, `--vendor` |

### `custom-fields` — Custom field definitions.

Default API version: `v3`

| Action | Method | Path | API | Path params | Paginated | Common filters |
| --- | --- | --- | --- | --- | --- | --- |
| `list-order-item-fields` | GET | `/api/v3/custom-fields/order-items/` | v3 | — | yes (metadata.pagination) | `--search`, `--order-by`, `--page-size`, `--format` |

### `pay` — Procurify Pay (top-level pagination shape).

Default API version: `public/v1`

| Action | Method | Path | API | Path params | Paginated | Common filters |
| --- | --- | --- | --- | --- | --- | --- |
| `list-transactions` | GET | `/api/public/v1/pay/transactions/` | public/v1 | — | yes (pagination) | `--search`, `--order-by`, `--page-size`, `--format`, `--start-date`, `--end-date`, `--reconciliation-status`, `--status` |

### `receipt` — Receipt items (top-level pagination shape).

Default API version: `v3`

| Action | Method | Path | API | Path params | Paginated | Common filters |
| --- | --- | --- | --- | --- | --- | --- |
| `list-items` | GET | `/api/v3/receipt/items/` | v3 | — | yes (pagination) | `--search`, `--order-by`, `--page-size`, `--format`, `--status`, `--created-0`, `--created-1` |

<!-- END AUTO-GENERATED API REFERENCE -->

If you need an action that isn't listed, use `raw`:

```bash
procure raw GET /api/v3/some-new-endpoint/
procure raw POST /api/v3/foo/ --body '{"key":"value"}'
procure raw POST /api/v3/foo/ --body @payload.json
```

---

## Mixed API versions

Procurify's surface mixes `v2`, `v3`, and `public/v1`. The CLI does **not**
require separate installs per version. Every action descriptor pins a full
path including its version segment, so a single install handles all three.

You can also override the version segment per-call when troubleshooting an
endpoint that has both a `v2` and a `v3` form:

```bash
procure locations list-locations --api-version v3   # try the v3 path
procure ap list-bills --api-version v2              # force v2
```

If neither fits, drop down to `raw`.

---

## Common recipes

### List all approved bills as CSV

```bash
procure ap list-bills \
  --status approved \
  --page-size 100 \
  --output csv \
  --columns id,vendor.name,total_amount,posting_date \
  > approved-bills.csv
```

### Stream every active user

```bash
procure users list-users --is-active true --output jsonl > users.ndjson
```

### Server-side CSV export

```bash
procure ap list-bills --server-format csv --status approved > bills.csv
```

### Pipe IDs from a file into get-bill

```bash
cat bill-uuids.txt | procure ap get-bill - --output jsonl > bills.ndjson
```

### Compose with `jq`

```bash
procure ap list-bills --max-items 500 --output jsonl \
  | jq 'select(.sync_status == "failed") | {id, vendor: .vendor.name}'
```

See [docs/examples.md](docs/examples.md) for more recipes.

---

## Path parameters

Every action that has `{name}` placeholders in its path can be invoked **two
equivalent ways**:

```bash
# 1. Positional (preferred, terse)
procure ap get-bill 1f99cf4a8c8d4d4abf5a4d3a2c1e7b88

# 2. Long-form flag (explicit, scriptable)
procure ap get-bill --id 1f99cf4a8c8d4d4abf5a4d3a2c1e7b88
```

Both forms validate the value against the action's pattern (e.g.
hex UUID for `ap.get-bill`) or enum (e.g. `vendor_group` for
`vendors.list-vendors`). Invalid values exit with code `2` and a usage error.

### Stdin batching

For single-id actions, pass `-` as the value to read newline-separated IDs
from stdin and run one request per line (concurrent up to `--concurrency`):

```bash
cat bill-uuids.txt | procure ap get-bill - --output jsonl --concurrency 8 > bills.ndjson
```

### Multiple path params

Some actions take more than one — supply them in declaration order:

```bash
procure purchase-orders list-by-role-status approver pending
# or
procure purchase-orders list-by-role-status --role approver --status pending
```

### Enums

Actions whose path includes an enum (e.g. `vendor_group`) reject unknown
values up-front:

```bash
procure vendors list-vendors all          # ok
procure vendors list-vendors preferred    # ok
procure vendors list-vendors something    # exit 2
```

---

## Mutating actions

A small set of named PATCH actions are available for the two resources that
come up regularly in incident response: vendors and AP bills. The actions are
deliberately minimal — there is no full CRUD scaffold here. Each action takes
the same path-parameter and global-flag shape as its read counterpart, plus
`--body <json>` (or `--body-file <path>` / `--body @-` for stdin).

| Service | Action          | Method | Endpoint                          | Body? | Notes |
| ------- | --------------- | ------ | --------------------------------- | ----- | ----- |
| vendors | `update-vendor` | PATCH  | `/api/v3/vendors/{id}/`           | required (JSON object of fields to change) | Single-field PATCH is accepted; server returns full vendor record |
| vendors | `touch-vendor`  | PATCH  | `/api/v3/vendors/{id}/`           | defaults to `{}` (no field changes) | Advances `dateModified`. Use to invalidate downstream caches keyed on vendor mod-time |
| ap      | `update-bill`   | PATCH  | `/api/v3/ap/bills/{id}/`          | required (JSON, restricted to writable schema) | Writable fields: `vendor`, `currency`, `approver`, `approval_chain`, `invoice_number`, `invoice_date`, `due_date`, `payment_terms`, `payment_method`, `note`, `gl_post_date` |
| ap      | `touch-bill`    | PATCH  | `/api/v3/ap/bills/{id}/`          | defaults to `{}` | Advances `last_modified_datetime` without changing any field |

Examples:

```bash
# Touch a vendor to advance dateModified (no data change)
procure vendors touch-vendor 1067 --profile sandbox

# Patch a single field on a vendor
procure vendors update-vendor 1067 --profile sandbox \
  --body '{"comments":"investigating bill #624"}'

# Patch a bill from a JSON file
procure ap update-bill 847aae0ddda043e3be0b8a0203e4920b --profile sandbox \
  --body-file ./patch.json

# Touch a bill to advance last_modified_datetime
procure ap touch-bill 847aae0ddda043e3be0b8a0203e4920b --profile sandbox
```

### Caveat: a `2xx` response means the change was applied

When you PATCH a bill, the response body may include
`metadata.permissions.can_edit: false` even though the change you sent was
applied and persisted. That flag drives Procurify's UI; it does **not** indicate
server-side rejection. Treat any `2xx` from these endpoints as "applied,
persisted, mod-time advanced", and verify with a follow-up GET if you need
certainty.

### `raw` command (escape hatch)

For one-off mutations on resources that don't have named actions (or for
HTTP methods other than GET/PATCH on supported resources), use `raw`:

```bash
procure raw POST /api/v3/some/resource/ --profile sandbox \
  --body '{"foo":"bar"}'

procure raw DELETE /api/v3/some/resource/123/ --profile sandbox
```

`raw` accepts the same `--body` / `--body-file` flags as the named actions.
`Content-Type: application/json` is set automatically when a body is present.

### What's deliberately not here

The named-mutation surface is intentionally narrow:

- **No vendor/bill creation actions.** Bill creation is not exposed via the API
  (`POST /api/v3/ap/bills/` returns HTTP 405); bills can only be created via the
  Procurify UI.
- **No `delete-vendor` / `delete-bill`.** Bill `DELETE` returns 405, and vendor
  deletion has cross-system implications that should not be a one-line CLI
  invocation.
- **No bulk-mutate actions.** `vendors touch-vendor - < ids.txt` works via the
  stdin-id mechanism for batch operations.

If you need a mutation that isn't here, open an issue and we'll evaluate adding
a named action. In the meantime, `raw` is the escape hatch.

---

## Debug mode and observability

Enable debug logs:

```bash
procure ap list-bills --debug --max-items 1
PROCURE_DEBUG=1 procure ap list-bills --max-items 1
```

Capture the HTTP exchange to a HAR file (open in Chrome DevTools → Network →
Import HAR):

```bash
procure ap list-bills --debug-har bills.har --max-items 5
```

Stream structured JSON logs to stderr (or to a file) for log aggregators:

```bash
procure ap list-bills --debug --log-format json --log-file run.ndjson \
  --max-items 1
```

What the CLI writes to stderr (debug mode):

- profile resolution (`config.resolve`, `config.source`)
- OAuth (`oauth.request`, `oauth.token.fetched`, `oauth.token.cache_hit`/`miss`)
- HTTP requests/responses (`http.request`, `http.response`, `http.retry`)
- pagination (`pagination.page`, `pagination.next`, `pagination.stop`)
- filter passthrough (`filter.passthrough`)

Sensitive data is masked in all logs (Authorization → `Bearer abc...xyz`,
client secret → `***last4`, `password|secret|token|key|authorization` keys
in JSON bodies redacted). HAR exports apply the same masking before writing.

### Stream discipline

- **stdout** — data only (json/jsonl/csv/tsv/table). Safe to redirect / pipe.
- **stderr** — debug logs, warnings, error messages.
- **`--log-file`** — additional sink; doesn't replace stderr.

---

## Profiles and credential storage

Profiles live at `~/.procure/config.json` (override with `PROCURE_HOME`). Each
profile stores:

- `domain` (plaintext — not sensitive)
- `clientId` (plaintext)
- `clientSecret` (AES-256-CBC, machine-local key)
- `accessToken` (AES-256-CBC) — auto-refreshed
- `tokenExpiry` (epoch ms)

The encryption key is at `~/.procure/.encryption-key`, mode `0600`. The CLI
refuses to read it if the permissions have been loosened.

Multiple profiles let you separate sandbox / production / per-tenant credentials:

```bash
procure configure --profile sandbox
procure configure --profile prod
procure ap list-bills --profile prod
```

Or set a default for a shell session:

```bash
export PROCURE_PROFILE=sandbox
procure whoami
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `OAuth error: HTTP 401: invalid_client` | Wrong client id/secret, or revoked | `procure configure --profile X`, paste new creds |
| `API error: 403 Forbidden` | The Procurify role of the user that **owns this OAuth application** doesn't allow this endpoint | Ask a Procurify admin to grant the missing permission to the owning user's role (be aware this widens that user's UI access too), or use a dedicated service-account user — see [How Procurify permissions work](#how-procurify-permissions-work) |
| `API error: 404 …/bills/UUID/` | UUID doesn't exist or wrong tenant | Re-check the UUID |
| `429 Too Many Requests` then retried | Rate limited | Tool retries with backoff; reduce `--concurrency` |
| `5xx Server Error` then retried | Transient Procurify issue | Tool retries idempotent calls; if persistent, file a Procurify ticket |
| `Invalid value '...' for id: does not match expected format` | Path-param failed validation | Check the value against the pattern shown in `--help` |
| Empty list with no error | Filter values typed wrong (case, snake_case) | Try `--debug` to see the URL we built |
| Tokens not cached between runs | Profile saved with env-var override | Env wins; remove env vars or use `--profile` explicitly |
| `Encryption key file ... has insecure permissions` | `chmod` made the key world-readable | `chmod 600 ~/.procure/.encryption-key` |

Run with `--debug` for the full request/response trail, or `--debug-har
trace.har` to capture a redacted HAR file. See
[docs/troubleshooting.md](docs/troubleshooting.md) for more.

---

## Security model

- **Credential at rest**: AES-256-CBC with a per-machine random key, stored at
  `~/.procure/.encryption-key` (mode `0600`).
- **Credential in transit**: TLS to `*.procurify.com`.
- **Logs and HAR**: client secrets, access tokens, cookies, and any field
  whose key matches `secret|password|token|key|authorization` are masked
  before being written anywhere.
- **No telemetry**: the CLI does not phone home.
- **Audit**: every HTTP request emits an `http.response` debug event tagged
  with the Procurify `x-request-id`, suitable for cross-referencing with
  Procurify support tickets.

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for the full
guide. In short:

```bash
git clone https://github.com/Gribbs/procure-cli.git
cd procure-cli
npm install
npm test
npm run lint
npm run docs           # regenerate docs/services.md + README API reference
```

### Adding a new action

1. Edit (or create) the descriptor in `lib/services/<service>.js`. Use an
   existing service (e.g. `lib/services/ap.js`) as a template.
2. Run `npm test` — the registry tests will confirm shape.
3. Run `npm run docs` — commit the regenerated `README.md` + `docs/services.md`.
4. Open a pull request using [Conventional Commits](https://www.conventionalcommits.org/).

### Service descriptor shape

```js
{
  name: 'ap',
  description: '…',
  apiVersion: 'v3',
  actions: {
    'list-bills': {
      method: 'GET',
      path: '/api/v3/ap/bills/',
      apiVersion: 'v3',
      paginate: 'metadata.pagination',  // or 'pagination'
      knownFilters: ['status', 'vendor', '…'],
    },
    'get-bill': {
      method: 'GET',
      path: '/api/v2/ap/bills/{id}/',
      apiVersion: 'v2',
      requiredArgs: {
        id: { pattern: /^[0-9a-f-]+$/i, help: 'Hex UUID.' },
      },
    },
  },
}
```

---

## Testing

```bash
npm test                        # all tests
npm test -- --coverage          # with coverage report
npx jest test/oauth.test.js     # one suite
```

Tests are organised as:

- `test/config.test.js` / `test/oauth.test.js` / `test/debug.test.js` — security-critical unit tests.
- `test/api-client.test.js` — HTTP layer (mocked), retry/reauth.
- `test/pagination.test.js` — both pagination shapes.
- `test/output.test.js` / `test/filters.test.js` — formatting and passthrough.
- `test/registry.test.js` — every descriptor structurally valid.
- `test/runner.test.js` — end-to-end runner with mocked HTTP.
- `test/cli.test.js` — every `--help` parses for every service/action.
- `test/configure.test.js` / `test/har.test.js` — round-trip + HAR integrity.

CI (`.github/workflows/ci.yml`) runs `lint + test --coverage` on pull requests
and also checks that `docs/services.md` and the README API reference are in sync
with the registry (drift = fail).

---

## Release process

Releases are automated with
[semantic-release](https://github.com/semantic-release/semantic-release) on
merge to `main`. Commit messages must follow
[Conventional Commits](https://www.conventionalcommits.org/):

- `fix:` → patch release
- `feat:` → minor release
- `feat!:` / `BREAKING CHANGE:` → major release

On merge, semantic-release determines the version bump, updates `CHANGELOG.md`
and `package.json`, tags the release, publishes to npm, and creates a GitHub
release. There is no manual `npm publish` step.

---

## License

[MIT](LICENSE) © Joel Gribble
