'use strict';

module.exports = {
  name: 'locations',
  description: 'Locations (note: v2 endpoints).',
  apiVersion: 'v2',
  actions: {
    'list-locations': {
      method: 'GET',
      path: '/api/v2/locations/',
      apiVersion: 'v2',
      paginate: 'metadata.pagination',
      knownFilters: ['search', 'order_by', 'page_size', 'format', 'is_active'],
    },
    'get-location': {
      method: 'GET',
      path: '/api/v2/locations/{id}/',
      apiVersion: 'v2',
      requiredArgs: {
        id: {
          pattern: /^\d+$/,
          help: 'Numeric location id.',
        },
      },
    },
  },
};
