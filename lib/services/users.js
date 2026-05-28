'use strict';

module.exports = {
  name: 'users',
  description: 'Procurify users (people in the tenant).',
  apiVersion: 'v3',
  actions: {
    'list-users': {
      method: 'GET',
      path: '/api/v3/users/',
      apiVersion: 'v3',
      paginate: 'metadata.pagination',
      knownFilters: ['search', 'order_by', 'page_size', 'format', 'is_active', 'permission', 'departments', 'locations'],
    },
    'get-user': {
      method: 'GET',
      path: '/api/v3/users/{id}/',
      apiVersion: 'v3',
      requiredArgs: {
        id: {
          pattern: /^\d+$/,
          help: 'Numeric user id.',
        },
      },
    },
    'whoami': {
      method: 'GET',
      path: '/api/v3/users/me/',
      apiVersion: 'v3',
    },
  },
};
