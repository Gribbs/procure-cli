'use strict';

const output = require('../lib/output');

describe('lib/output', () => {
  const records = [
    { id: 1, name: 'Alice', meta: { dept: 'Sales' } },
    { id: 2, name: 'Bob', meta: { dept: 'Eng' } },
  ];

  describe('flatten', () => {
    it('flattens nested objects with dotted keys', () => {
      expect(output.flatten({ a: { b: { c: 1 } }, d: 2 })).toEqual({ 'a.b.c': 1, d: 2 });
    });

    it('joins primitive arrays with |', () => {
      expect(output.flatten({ tags: ['x', 'y'] })).toEqual({ tags: 'x|y' });
    });

    it('expands object arrays by index', () => {
      expect(output.flatten({ users: [{ id: 1 }, { id: 2 }] })).toEqual({ 'users.0.id': 1, 'users.1.id': 2 });
    });
  });

  describe('format json', () => {
    it('returns pretty json by default', () => {
      const out = output.format(records, { output: 'json' });
      expect(JSON.parse(out)).toEqual(records);
      expect(out).toContain('\n');
    });
  });

  describe('format jsonl', () => {
    it('writes one record per line', () => {
      const out = output.format(records, { output: 'jsonl' });
      const lines = out.split('\n');
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0])).toEqual(records[0]);
      expect(JSON.parse(lines[1])).toEqual(records[1]);
    });
  });

  describe('format csv', () => {
    it('writes a header row and flattens nested values', () => {
      const out = output.format(records, { output: 'csv' });
      const lines = out.split('\n');
      expect(lines[0]).toBe('id,name,meta.dept');
      expect(lines[1]).toBe('1,Alice,Sales');
      expect(lines[2]).toBe('2,Bob,Eng');
    });

    it('quotes values containing commas or quotes', () => {
      const out = output.format([{ a: 'x,y' }, { a: 'has "quotes"' }], { output: 'csv' });
      expect(out).toContain('"x,y"');
      expect(out).toContain('"has ""quotes"""');
    });

    it('respects --columns ordering', () => {
      const out = output.format(records, { output: 'csv', columns: 'name,id' });
      expect(out.split('\n')[0]).toBe('name,id');
    });
  });

  describe('format tsv', () => {
    it('uses tab delimiter', () => {
      const out = output.format([{ a: 1, b: 2 }], { output: 'tsv' });
      expect(out.split('\n')[0]).toBe('a\tb');
    });
  });

  describe('format table', () => {
    it('renders a table with headers', () => {
      const out = output.format(records, { output: 'table' });
      expect(out).toContain('id');
      expect(out).toContain('Alice');
    });
  });

  describe('--query JMESPath', () => {
    it('filters records before formatting', () => {
      const out = output.format(records, {
        output: 'json',
        query: '[?id == `2`].name',
      });
      expect(JSON.parse(out)).toEqual(['Bob']);
    });

    it('supports projection of fields', () => {
      const out = output.format(records, { output: 'jsonl', query: '[].{id: id, dept: meta.dept}' });
      const lines = out.split('\n').map(JSON.parse);
      expect(lines).toEqual([
        { id: 1, dept: 'Sales' },
        { id: 2, dept: 'Eng' },
      ]);
    });
  });

  describe('errors', () => {
    it('throws on unknown format', () => {
      expect(() => output.format(records, { output: 'xml' })).toThrow(/Unknown output format/);
    });
  });
});
