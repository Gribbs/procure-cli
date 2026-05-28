'use strict';

module.exports = {
  name: 'permissions',
  description: 'Procurify permissions and permission groups.',
  apiVersion: 'v3',
  actions: {
    'list-permissions': {
      method: 'GET',
      path: '/api/v3/permissions/',
      apiVersion: 'v3',
      paginate: 'metadata.pagination',
      knownFilters: ['search', 'order_by', 'page_size', 'format'],
    },
    'list-groups': {
      method: 'GET',
      path: '/api/v3/permissions/groups/',
      apiVersion: 'v3',
      paginate: 'metadata.pagination',
      knownFilters: ['search', 'order_by', 'page_size', 'format'],
    },
  },
};
