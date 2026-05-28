'use strict';

module.exports = {
  name: 'ap',
  description: 'Accounts payable: bills, payments, payment methods, items.',
  apiVersion: 'v3',
  actions: {
    'list-bills': {
      method: 'GET',
      path: '/api/v3/ap/bills/',
      apiVersion: 'v3',
      paginate: 'metadata.pagination',
      knownFilters: [
        'search',
        'order_by',
        'page_size',
        'format',
        'vendor',
        'vendor_group_ids',
        'department',
        'location',
        'status',
        'sync_status',
        'has_payment',
        'exclude_expense_bills',
        'exported_only',
        'last_export_user',
        'posting_date_0',
        'posting_date_1',
        'invoice_date_0',
        'invoice_date_1',
        'last_modified_datetime_0',
        'last_modified_datetime_1',
        'payment_date_0',
        'payment_date_1',
        'submitted_date_0',
        'submitted_date_1',
        'type',
        'account_code',
      ],
    },
    'get-bill': {
      method: 'GET',
      path: '/api/v2/ap/bills/{id}/',
      apiVersion: 'v2',
      requiredArgs: {
        id: {
          pattern: /^[0-9a-f-]+$/i,
          help: 'Bill UUID (hex).',
        },
      },
    },
    'update-bill': {
      method: 'PATCH',
      path: '/api/v3/ap/bills/{id}/',
      apiVersion: 'v3',
      acceptsBody: true,
      requiredArgs: {
        id: {
          pattern: /^[0-9a-f-]+$/i,
          help: 'Bill UUID (hex). Writable fields per Procurify v3 edit schema: vendor, currency, approver, approval_chain, invoice_number, invoice_date, due_date, payment_terms, payment_method, note, gl_post_date.',
        },
      },
    },
    'touch-bill': {
      method: 'PATCH',
      path: '/api/v3/ap/bills/{id}/',
      apiVersion: 'v3',
      acceptsBody: true,
      defaultBody: '{}',
      requiredArgs: {
        id: {
          pattern: /^[0-9a-f-]+$/i,
          help: 'Bill UUID (hex). Sends an empty PATCH which advances last_modified_datetime without changing field values.',
        },
      },
    },
    'list-items': {
      method: 'GET',
      path: '/api/v2/ap/items/',
      apiVersion: 'v2',
      paginate: 'metadata.pagination',
      knownFilters: ['search', 'order_by', 'page_size', 'format'],
    },
    'list-payments': {
      method: 'GET',
      path: '/api/v2/ap/payments/',
      apiVersion: 'v2',
      paginate: 'metadata.pagination',
      knownFilters: ['search', 'order_by', 'page_size', 'format', 'vendor', 'status', 'payment_date_0', 'payment_date_1'],
    },
    'get-payment-approver-choices': {
      method: 'GET',
      path: '/api/v2/ap/payments/{id}/approver-choices/',
      apiVersion: 'v2',
      requiredArgs: {
        id: {
          pattern: /^\d+$/,
          help: 'Numeric payment id.',
        },
      },
    },
    'list-company-payment-methods': {
      method: 'GET',
      path: '/api/v2/ap/company-payment-methods/',
      apiVersion: 'v2',
      paginate: 'metadata.pagination',
      knownFilters: ['search', 'order_by', 'page_size', 'format'],
    },
    'list-vendor-payment-methods': {
      method: 'GET',
      path: '/api/v2/ap/vendor-payment-methods/',
      apiVersion: 'v2',
      paginate: 'metadata.pagination',
      knownFilters: ['search', 'order_by', 'page_size', 'format', 'vendor'],
    },
  },
};
