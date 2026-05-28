'use strict';

module.exports = {
  name: 'budget-categories',
  description: 'Department/account-code budget categories (the source of the headline budget figures shown in the Procurify UI).',
  apiVersion: 'v3',
  actions: {
    'list-budget-categories': {
      method: 'GET',
      path: '/api/v3/budget-categories/',
      apiVersion: 'v3',
      paginate: 'metadata.pagination',
      knownFilters: [
        'search',
        'order_by',
        'page_size',
        'format',
        'departments',
        'locations',
        'users',
        'account_codes',
      ],
    },
  },
};
