'use strict';

module.exports = {
  name: 'currencies',
  description: 'Supported currencies (note: v2).',
  apiVersion: 'v2',
  actions: {
    'list-currencies': {
      method: 'GET',
      path: '/api/v2/currencies/',
      apiVersion: 'v2',
      paginate: 'metadata.pagination',
      knownFilters: ['search', 'order_by', 'page_size', 'format'],
    },
  },
};
