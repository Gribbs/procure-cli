'use strict';

module.exports = {
  name: 'requisitions',
  description: 'Requisitions / global orders (mixed v2 + v3 endpoints).',
  apiVersion: 'v2',
  actions: {
    'list-orders': {
      method: 'GET',
      path: '/api/v2/global/orders/',
      apiVersion: 'v2',
      paginate: 'metadata.pagination',
      knownFilters: ['search', 'order_by', 'page_size', 'format', 'status', 'submitter', 'department', 'location'],
    },
    'list-order-items': {
      method: 'GET',
      path: '/api/v2/global/order_items/',
      apiVersion: 'v2',
      paginate: 'metadata.pagination',
      knownFilters: ['search', 'order_by', 'page_size', 'format', 'status', 'department', 'location'],
    },
  },
};
