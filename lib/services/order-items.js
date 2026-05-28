'use strict';

module.exports = {
  name: 'order-items',
  description: 'Order items (extensive filter set).',
  apiVersion: 'v3',
  actions: {
    'list-order-items': {
      method: 'GET',
      path: '/api/v3/order-items/',
      apiVersion: 'v3',
      paginate: 'metadata.pagination',
      knownFilters: [
        'search',
        'order_by',
        'page_size',
        'format',
        'status',
        'orderNum__status',
        'departments',
        'locations',
        'vendor',
        'approved_datetime_0',
        'approved_datetime_1',
        'last_modified_0',
        'last_modified_1',
        'purchased_date_0',
        'purchased_date_1',
      ],
    },
  },
};
