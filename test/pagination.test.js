'use strict';

const pagination = require('../lib/pagination');

function makeClient(pages) {
  let i = 0;
  return {
    requests: [],
    async request(opts) {
      this.requests.push(opts);
      if (i >= pages.length) throw new Error('Unexpected extra request');
      const p = pages[i];
      i += 1;
      return { status: 200, body: p, text: JSON.stringify(p), headers: new Map(), requestId: null };
    },
  };
}

describe('lib/pagination', () => {
  describe('selectPagination', () => {
    it('finds metadata.pagination', () => {
      const out = pagination.selectPagination({ metadata: { pagination: { next: '/n' } } }, 'metadata.pagination');
      expect(out).toEqual({ next: '/n' });
    });

    it('finds top-level pagination', () => {
      const out = pagination.selectPagination({ pagination: { next: '/n' } }, 'pagination');
      expect(out).toEqual({ next: '/n' });
    });

    it('returns null when missing', () => {
      expect(pagination.selectPagination({}, 'metadata.pagination')).toBeNull();
    });
  });

  describe('extractData', () => {
    it('returns body.data', () => {
      expect(pagination.extractData({ data: [1, 2, 3] })).toEqual([1, 2, 3]);
    });

    it('returns body.results when no .data', () => {
      expect(pagination.extractData({ results: [1, 2] })).toEqual([1, 2]);
    });

    it('returns top-level array', () => {
      expect(pagination.extractData([1, 2])).toEqual([1, 2]);
    });

    it('returns [] when no records', () => {
      expect(pagination.extractData(null)).toEqual([]);
      expect(pagination.extractData({})).toEqual([]);
    });
  });

  describe('nextPathFromUrl', () => {
    it('strips host before /api/', () => {
      expect(pagination.nextPathFromUrl('https://acme.procurify.com/api/v3/users/?page=2')).toBe(
        '/api/v3/users/?page=2'
      );
    });

    it('returns relative path unchanged', () => {
      expect(pagination.nextPathFromUrl('/api/v3/users/?page=2')).toBe('/api/v3/users/?page=2');
    });

    it('returns null for null/empty', () => {
      expect(pagination.nextPathFromUrl(null)).toBeNull();
      expect(pagination.nextPathFromUrl('')).toBeNull();
    });
  });

  describe('paginate (metadata.pagination shape)', () => {
    it('follows next links across multiple pages', async () => {
      const client = makeClient([
        { data: [{ id: 1 }, { id: 2 }], metadata: { pagination: { next: 'https://acme.procurify.com/api/v3/things/?page=2' } } },
        { data: [{ id: 3 }, { id: 4 }], metadata: { pagination: { next: 'https://acme.procurify.com/api/v3/things/?page=3' } } },
        { data: [{ id: 5 }], metadata: { pagination: { next: null } } },
      ]);
      const out = await pagination.collectAll({
        client,
        path: '/api/v3/things/',
        paginate: 'metadata.pagination',
      });
      expect(out).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]);
      expect(client.requests).toHaveLength(3);
    });

    it('follows next from top-level pagination shape', async () => {
      const client = makeClient([
        { data: [{ id: 'a' }], pagination: { next: '/api/public/v1/pay/transactions/?page=2' } },
        { data: [{ id: 'b' }], pagination: { next: null } },
      ]);
      const out = await pagination.collectAll({
        client,
        path: '/api/public/v1/pay/transactions/',
        paginate: 'pagination',
      });
      expect(out).toEqual([{ id: 'a' }, { id: 'b' }]);
    });

    it('respects max-items', async () => {
      const client = makeClient([
        { data: [{ id: 1 }, { id: 2 }, { id: 3 }], metadata: { pagination: { next: '/api/v3/things/?page=2' } } },
        { data: [{ id: 4 }, { id: 5 }], metadata: { pagination: { next: null } } },
      ]);
      const out = await pagination.collectAll({
        client,
        path: '/api/v3/things/',
        paginate: 'metadata.pagination',
        maxItems: 2,
      });
      expect(out).toEqual([{ id: 1 }, { id: 2 }]);
      expect(client.requests).toHaveLength(1);
    });

    it('honours pageSize on first request', async () => {
      const client = makeClient([{ data: [], metadata: { pagination: { next: null } } }]);
      await pagination.collectAll({
        client,
        path: '/api/v3/things/',
        paginate: 'metadata.pagination',
        pageSize: 50,
      });
      expect(client.requests[0].query).toEqual({ page_size: 50 });
    });

    it('does not loop on identical next path', async () => {
      const client = makeClient([
        { data: [{ id: 1 }], metadata: { pagination: { next: '/api/v3/things/' } } },
      ]);
      const out = await pagination.collectAll({
        client,
        path: '/api/v3/things/',
        paginate: 'metadata.pagination',
      });
      expect(out).toEqual([{ id: 1 }]);
    });
  });
});
