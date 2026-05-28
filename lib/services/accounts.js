'use strict';

module.exports = {
  name: 'accounts',
  description: 'Chart-of-accounts (distinct from account-codes).',
  apiVersion: 'v3',
  actions: {
    'list-accounts': {
      method: 'GET',
      path: '/api/v3/accounts/',
      apiVersion: 'v3',
      paginate: 'metadata.pagination',
      knownFilters: [
        'search',
        'order_by',
        'page_size',
        'format',
        'with_expired_budgets',
        'in_effect',
        'departments',
        'locations',
        'account_code',
      ],
    },
  },
};
