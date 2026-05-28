'use strict';

const registry = require('../lib/services/_registry');

describe('lib/services/_registry', () => {
  it('exposes 17 services in the canonical order', () => {
    const services = registry.listServices();
    expect(services).toHaveLength(17);
    expect(services.map((s) => s.name)).toEqual([
      'permissions',
      'users',
      'locations',
      'departments',
      'account-codes',
      'accounts',
      'budget-categories',
      'vendors',
      'currencies',
      'catalog',
      'requisitions',
      'purchase-orders',
      'order-items',
      'ap',
      'custom-fields',
      'pay',
      'receipt',
    ]);
  });

  it('every action has a method, path and apiVersion', () => {
    for (const tag of registry.SERVICE_TAG_ORDER) {
      const svc = registry.getService(tag);
      for (const [actionName, descriptor] of Object.entries(svc.actions)) {
        expect(typeof descriptor.method).toBe('string');
        expect(typeof descriptor.path).toBe('string');
        expect(descriptor.path.startsWith('/api/')).toBe(true);
        const version = descriptor.apiVersion || svc.apiVersion;
        expect(typeof version).toBe('string');
        if (descriptor.path.includes('{') && (!descriptor.requiredArgs || Object.keys(descriptor.requiredArgs).length === 0)) {
          throw new Error(`Action ${tag}/${actionName} has path-params but no requiredArgs`);
        }
      }
    }
  });

  it('extractPathParams returns ordered placeholders', () => {
    expect(registry.extractPathParams('/api/v3/foo/{id}/')).toEqual(['id']);
    expect(registry.extractPathParams('/api/v2/purchase_orders/{role}/{status}/')).toEqual(['role', 'status']);
    expect(registry.extractPathParams('/api/v3/foo/')).toEqual([]);
  });

  it('listActions returns paginated flag and required args', () => {
    const apActions = registry.listActions('ap');
    const listBills = apActions.find((a) => a.action === 'list-bills');
    expect(listBills.paginated).toBe(true);
    const getBill = apActions.find((a) => a.action === 'get-bill');
    expect(getBill.requiredArgs).toEqual(['id']);
    expect(getBill.paginated).toBe(false);
  });

  it('returns null for unknown service / action', () => {
    expect(registry.getService('made-up')).toBeNull();
    expect(registry.listActions('nope')).toBeNull();
    expect(registry.getAction('ap', 'made-up')).toBeNull();
  });

  it('ap.get-bill validates hex UUID pattern', () => {
    const action = registry.getAction('ap', 'get-bill');
    expect(action.requiredArgs.id.pattern.test('1f99cf4a8c8d4d4abf5a4d3a2c1e7b88')).toBe(true);
    expect(action.requiredArgs.id.pattern.test('1f99cf4a-8c8d-4d4a-bf5a-4d3a2c1e7b88')).toBe(true);
    expect(action.requiredArgs.id.pattern.test('not-a-uuid-xyz')).toBe(false);
  });

  describe('budget-categories service', () => {
    const svc = registry.getService('budget-categories');

    it('is registered with a v3 default API version', () => {
      expect(svc).not.toBeNull();
      expect(svc.apiVersion).toBe('v3');
    });

    it('exposes list-budget-categories as a paginated GET against /api/v3/budget-categories/', () => {
      const action = svc.actions['list-budget-categories'];
      expect(action).toBeDefined();
      expect(action.method).toBe('GET');
      expect(action.path).toBe('/api/v3/budget-categories/');
      expect(action.apiVersion).toBe('v3');
      expect(action.paginate).toBe('metadata.pagination');
    });

    it('declares the filters used to scope a budget query', () => {
      const filters = svc.actions['list-budget-categories'].knownFilters;
      expect(filters).toEqual(expect.arrayContaining([
        'search',
        'order_by',
        'page_size',
        'format',
        'departments',
        'locations',
        'users',
        'account_codes',
      ]));
    });

    it('has no required path params (list endpoint only)', () => {
      const action = svc.actions['list-budget-categories'];
      expect(registry.extractPathParams(action.path)).toEqual([]);
      expect(action.requiredArgs || {}).toEqual({});
    });
  });
});
