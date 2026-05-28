'use strict';

module.exports = {
  name: 'account-codes',
  description: 'Account codes (Procurify GL coding).',
  apiVersion: 'v3',
  actions: {
    'list-account-codes': {
      method: 'GET',
      path: '/api/v3/account-codes/',
      apiVersion: 'v3',
      paginate: 'metadata.pagination',
      knownFilters: ['search', 'order_by', 'page_size', 'format', 'is_active'],
    },
  },
};
