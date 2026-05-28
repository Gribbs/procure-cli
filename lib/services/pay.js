'use strict';

module.exports = {
  name: 'pay',
  description: 'Procurify Pay (top-level pagination shape).',
  apiVersion: 'public/v1',
  actions: {
    'list-transactions': {
      method: 'GET',
      path: '/api/public/v1/pay/transactions/',
      apiVersion: 'public/v1',
      paginate: 'pagination',
      knownFilters: [
        'search',
        'order_by',
        'page_size',
        'format',
        'start_date',
        'end_date',
        'reconciliation_status',
        'status',
      ],
    },
  },
};
