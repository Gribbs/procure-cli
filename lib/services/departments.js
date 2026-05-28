'use strict';

module.exports = {
  name: 'departments',
  description: 'Departments / cost centres.',
  apiVersion: 'v3',
  actions: {
    'list-departments': {
      method: 'GET',
      path: '/api/v3/departments/',
      apiVersion: 'v3',
      paginate: 'metadata.pagination',
      knownFilters: [
        'search',
        'order_by',
        'page_size',
        'format',
        'permission',
        'requestable',
        'location_perm_override',
        'locations',
        'is_active',
      ],
    },
  },
};
