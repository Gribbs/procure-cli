'use strict';

module.exports = {
  name: 'purchase-orders',
  description: 'Purchase orders (v3 with v2 legacy endpoints).',
  apiVersion: 'v3',
  actions: {
    'get-purchase-order': {
      method: 'GET',
      path: '/api/v2/purchase_orders/{id}/',
      apiVersion: 'v2',
      requiredArgs: {
        id: {
          pattern: /^\d+$/,
          help: 'Numeric purchase order id.',
        },
      },
    },
    'list-by-role-status': {
      method: 'GET',
      path: '/api/v2/purchase_orders/{role}/{status}/',
      apiVersion: 'v2',
      paginate: 'metadata.pagination',
      requiredArgs: {
        role: {
          enum: ['approver', 'submitter', 'purchaser', 'requester'],
          help: 'Role filter.',
        },
        status: {
          enum: ['pending', 'approved', 'denied', 'received', 'closed'],
          help: 'Status filter.',
        },
      },
      knownFilters: ['search', 'order_by', 'page_size', 'format'],
    },
    'get-billing-history': {
      method: 'GET',
      path: '/api/v3/purchase-orders/billing-history/',
      apiVersion: 'v3',
      paginate: 'metadata.pagination',
      knownFilters: ['search', 'order_by', 'page_size', 'format', 'vendor', 'department', 'location'],
    },
  },
};
