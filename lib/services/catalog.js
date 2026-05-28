'use strict';

module.exports = {
  name: 'catalog',
  description: 'Catalog bundles and items.',
  apiVersion: 'v3',
  actions: {
    'list-bundles': {
      method: 'GET',
      path: '/api/v3/catalog-bundles/',
      apiVersion: 'v3',
      paginate: 'metadata.pagination',
      knownFilters: ['search', 'order_by', 'page_size', 'format'],
    },
    'list-items': {
      method: 'GET',
      path: '/api/v3/catalog-items/',
      apiVersion: 'v3',
      paginate: 'metadata.pagination',
      knownFilters: ['search', 'order_by', 'page_size', 'format', 'vendor', 'is_active'],
    },
  },
};
