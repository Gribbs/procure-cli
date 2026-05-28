# Procurify API Reference

> Auto-generated from `lib/services/`. Run `npm run docs` to refresh.


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
