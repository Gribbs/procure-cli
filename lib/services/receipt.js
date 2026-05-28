'use strict';

module.exports = {
  name: 'receipt',
  description: 'Receipt items (top-level pagination shape).',
  apiVersion: 'v3',
  actions: {
    'list-items': {
      method: 'GET',
      path: '/api/v3/receipt/items/',
      apiVersion: 'v3',
      paginate: 'pagination',
      knownFilters: ['search', 'order_by', 'page_size', 'format', 'status', 'created_0', 'created_1'],
    },
  },
};
