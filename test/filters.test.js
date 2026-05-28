'use strict';

const filters = require('../lib/filters');

describe('lib/filters', () => {
  describe('parseUnknownArgs', () => {
    it('collects --foo bar style flags as snake_case keys', () => {
      const out = filters.parseUnknownArgs(['--vendor-group-ids', '1,2', '--status', 'approved']);
      expect(out).toEqual({ vendor_group_ids: '1,2', status: 'approved' });
    });

    it('handles --foo=bar style', () => {
      const out = filters.parseUnknownArgs(['--status=approved']);
      expect(out).toEqual({ status: 'approved' });
    });

    it('treats valueless flags as boolean true', () => {
      const out = filters.parseUnknownArgs(['--exported-only']);
      expect(out).toEqual({ exported_only: 'true' });
    });

    it('ignores reserved flags (profile, page-size, debug, etc)', () => {
      const out = filters.parseUnknownArgs(['--profile', 'sb', '--page-size', '50', '--debug', '--status', 'approved']);
      expect(out).toEqual({ status: 'approved' });
    });

    it('combines repeated flags into arrays', () => {
      const out = filters.parseUnknownArgs(['--vendor', '1', '--vendor', '2']);
      expect(out).toEqual({ vendor: ['1', '2'] });
    });
  });

  describe('applyApiVersion', () => {
    it('rewrites the v3 segment to v2 (or vice versa)', () => {
      expect(filters.applyApiVersion('/api/v3/users/', 'v2')).toBe('/api/v2/users/');
      expect(filters.applyApiVersion('/api/v2/users/', 'v3')).toBe('/api/v3/users/');
    });

    it('returns unchanged when no version override given', () => {
      expect(filters.applyApiVersion('/api/v3/users/', null)).toBe('/api/v3/users/');
    });

    it('handles public/v1 paths', () => {
      expect(filters.applyApiVersion('/api/public/v1/pay/transactions/', 'v3')).toBe('/api/v3/pay/transactions/');
    });
  });
});
