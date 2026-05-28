'use strict';

module.exports = {
  name: 'custom-fields',
  description: 'Custom field definitions.',
  apiVersion: 'v3',
  actions: {
    'list-order-item-fields': {
      method: 'GET',
      path: '/api/v3/custom-fields/order-items/',
      apiVersion: 'v3',
      paginate: 'metadata.pagination',
      knownFilters: ['search', 'order_by', 'page_size', 'format'],
    },
  },
};
