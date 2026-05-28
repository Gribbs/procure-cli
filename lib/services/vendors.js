'use strict';

const VENDOR_GROUPS = [
  'all',
  'default',
  'preferred',
  'purchasable',
  'requestable',
  'other',
  'credit_card_providers',
];

module.exports = {
  name: 'vendors',
  description: 'Vendor catalog. The list endpoint takes a {vendor_group} path-param enum.',
  apiVersion: 'v3',
  actions: {
    'list-vendors': {
      method: 'GET',
      path: '/api/v3/vendors/{vendor_group}/',
      apiVersion: 'v3',
      paginate: 'metadata.pagination',
      requiredArgs: {
        vendor_group: {
          enum: VENDOR_GROUPS,
          default: 'all',
          help: `Vendor grouping. One of: ${VENDOR_GROUPS.join(', ')}.`,
        },
      },
      knownFilters: ['search', 'order_by', 'page_size', 'format'],
    },
    'get-vendor': {
      method: 'GET',
      path: '/api/v3/vendors/{id}/',
      apiVersion: 'v3',
      requiredArgs: {
        id: {
          pattern: /^\d+$/,
          help: 'Numeric vendor id.',
        },
      },
    },
    'update-vendor': {
      method: 'PATCH',
      path: '/api/v3/vendors/{id}/',
      apiVersion: 'v3',
      acceptsBody: true,
      requiredArgs: {
        id: {
          pattern: /^\d+$/,
          help: 'Numeric vendor id.',
        },
      },
    },
    'touch-vendor': {
      method: 'PATCH',
      path: '/api/v3/vendors/{id}/',
      apiVersion: 'v3',
      acceptsBody: true,
      defaultBody: '{}',
      requiredArgs: {
        id: {
          pattern: /^\d+$/,
          help: 'Numeric vendor id.',
        },
      },
    },
  },
};
