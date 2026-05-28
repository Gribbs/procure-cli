# Troubleshooting

A focused guide for the errors you're most likely to hit. The README has a
shorter table; this doc adds context.

---

## Authentication

### `OAuth error: HTTP 401: invalid_client`

The Client ID or Client Secret stored in the profile is wrong, has been
revoked, or has been rotated in Procurify.

```bash
procure configure --profile <name>     # paste the new credentials
procure login --profile <name>         # force a fresh token
```

If the failure repeats with what you believe are correct credentials, verify
the subdomain is right (`<subdomain>.procurify.com` must reach the tenant).

### `API error: HTTP 403 Forbidden`

The OAuth credential is valid but the Procurify *role* of the user that
**owns this OAuth application** doesn't permit this endpoint.

Important context: Procurify OAuth applications are *per-user-owned*. Each
application's effective permissions are determined by the role of the user who
created it. There is no read-only toggle, no per-endpoint scope grid on the
application itself — only the bound user's role.

To diagnose first, confirm whose user the application is bound to:

```bash
procure whoami --profile <name>
```

Then act based on whose user it is:

**Application bound to your personal user account**

1. In Procurify → **Settings → Users / Roles**, ask a Procurify admin to
   grant your role the missing permission.
2. Caveat: that change widens your *human UI access* too, not just the
   CLI's.
3. If it is acceptable, re-run the failing CLI command. No re-authentication is
   needed — Procurify reads the role on each request.
4. If it isn't acceptable, switch to a dedicated service-account application
   (see the [README](../README.md#how-procurify-permissions-work)).

**Application bound to a service-account user**

1. In Procurify → **Settings → Users / Roles**, edit the *service account's*
   role and grant the missing permission.
2. This won't affect any human user's UI access.
3. Re-run the failing CLI command.

**Neither path acceptable**

- Use `procure raw GET /api/...` against an endpoint the existing role allows.
- Fall back to the Procurify UI.

### `Encryption key file ~/.procure/.encryption-key has insecure permissions`

You (or some tool) chmodded the file. Fix it and try again:

```bash
chmod 600 ~/.procure/.encryption-key
```

If you no longer have access to the original file (e.g. moved machines), the
encrypted profile is unrecoverable — `rm -rf ~/.procure` and reconfigure.

### Tokens not being cached / refetched on every call

Most often this means env vars are taking precedence over the profile. Env
vars never persist tokens (only the on-disk profile does). Either remove the
env vars:

```bash
unset PROCURIFY_DOMAIN PROCURIFY_CLIENT_ID PROCURIFY_CLIENT_SECRET
```

or accept that env-mode is for ephemeral use only.

---

## HTTP

### `429 Too Many Requests` (after retries)

The CLI already retries idempotent calls with exponential backoff up to 3
times. If you still see 429:

- reduce `--concurrency` (default 4) when batching ids from stdin,
- add a `sleep` between calls in shell loops,
- pull a larger `--page-size` so you make fewer requests overall.

### `5xx Server Error` (after retries)

Procurify returned a server error 3 times in a row. Capture a HAR:

```bash
procure <…> --debug-har trouble.har --log-format json --log-file run.ndjson
```

and file a Procurify support ticket attaching `trouble.har` plus the
`x-request-id` from the last `http.response` event in `run.ndjson`. The HAR
is automatically redacted.

### `Network error: …`

Local connectivity issue. The CLI retries on idempotent methods. Check
`ping <subdomain>.procurify.com`, VPN, corporate proxy.

---

## Validation

### `Usage error: Invalid value '...' for id: does not match expected format`

The path-param value didn't match the action's pattern (e.g. `ap.get-bill`
expects a hex UUID like `1f99cf4a8c8d4d4abf5a4d3a2c1e7b88`).

```bash
procure ap get-bill --help     # see the exact pattern expected
```

Note: there is **no API lookup by UI bill number**. You must already have the
bill's UUID.

### `Usage error: Missing required argument: id`

You called an action that has a path param without supplying it positionally
or with `--id`.

```bash
procure ap get-bill 1f99cf4a8c8d4d4abf5a4d3a2c1e7b88   # positional
procure ap get-bill --id 1f99cf4a8c8d4d4abf5a4d3a2c1e7b88   # flag
```

### `Usage error: Invalid value 'wat' for vendor_group. Allowed values: ...`

The action's path includes an enum and you typed something not on the list.
The error message lists the valid values.

---

## Data

### Empty results / unexpected filtering

Run with `--debug` to see the URL the CLI built. Common causes:

- Filter values with the wrong case (Procurify is sometimes case-sensitive).
- Forgot the trailing `Z` on date filters.
- Used a UI label rather than the underlying numeric id (`--department "AP"`
  vs `--department 42`).

```bash
procure ap list-bills --status APPROVED --debug --max-items 1
# vs
procure ap list-bills --status approved --debug --max-items 1
```

### CSV columns missing

`--output csv` flattens nested objects with dot notation. If a column you
expect is missing, use `--columns` to specify it explicitly:

```bash
procure ap list-bills --output csv --columns id,vendor.name,total_amount
```

---

## Output

### "where is my data going?"

| Stream | What | Redirect |
| --- | --- | --- |
| stdout | The actual records (json/jsonl/csv/tsv/table) | `> data.json` |
| stderr | Debug logs, warnings, error messages | `2> debug.log` |
| `--log-file` | Mirror of debug events (additive, doesn't replace stderr) | n/a |

Common gotcha: `procure --debug ap list-bills > out.json` works because the
data goes to stdout (`> out.json`) and the debug logs to stderr (still on the
terminal). If you want both:

```bash
procure --debug ap list-bills > out.json 2> debug.log
```

### `cli-table3 looks awful in CI`

Use `--no-color`, or switch to `--output csv` / `jsonl` for non-interactive
contexts.

---

## CLI itself

### `procure: command not found`

```bash
npm install -g procure-cli
```

If install was correct, either the global install didn't put `procure` on your
`PATH`, or you have multiple Node versions. Check `which procure`,
`npm prefix -g`, and `echo $PATH`. If using `nvm`, make sure you installed
under the active Node version.

### `Unknown command: foo`

You're either misspelling a service / action, or trying to use an action that
hasn't been registered yet. Use:

```bash
procure list-services
procure list-actions <service>
procure raw GET /api/...    # for unregistered endpoints
```

---

## Procurify SaaS UI

### `the page you're looking for is lost in space` (Procurify 404)

The Procurify UI is a **hash-routed SPA**. Many routes live after `#`, and the
server only resolves the bare host — anything path-like before the `#` may
return the "lost in space" 404 even when the destination exists.

When in doubt, navigate from the home page and copy the URL out of the address
bar — the URL slug is not derivable from the API.

### External status

[status.procurify.com](https://status.procurify.com) is worth checking in
parallel when something looks wrong server-side; many transient issues are
invisible there, but major outages are not.
