'use strict';

const debug = require('./debug');

function selectPagination(body, selector) {
  if (!body || typeof body !== 'object') return null;
  if (selector === 'metadata.pagination') {
    return body.metadata && body.metadata.pagination ? body.metadata.pagination : null;
  }
  if (selector === 'pagination') {
    return body.pagination || null;
  }
  return body.metadata?.pagination || body.pagination || null;
}

function extractData(body) {
  if (!body || typeof body !== 'object') return [];
  if (Array.isArray(body)) return body;
  if (Array.isArray(body.data)) return body.data;
  if (Array.isArray(body.results)) return body.results;
  return [];
}

function nextPathFromUrl(nextUrl) {
  if (!nextUrl || typeof nextUrl !== 'string') return null;
  const apiIdx = nextUrl.indexOf('/api/');
  if (apiIdx >= 0) return nextUrl.slice(apiIdx);
  try {
    const u = new URL(nextUrl);
    return u.pathname + u.search;
  } catch {
    return nextUrl.startsWith('/') ? nextUrl : null;
  }
}

async function* paginate({ client, method = 'GET', path, query = {}, paginate: paginateSelector = 'metadata.pagination', maxItems = Infinity, pageSize = null }) {
  const firstQuery = { ...query };
  if (pageSize && !('page_size' in firstQuery)) {
    firstQuery.page_size = pageSize;
  }

  let currentPath = path;
  let currentQuery = firstQuery;
  let pageNum = 1;
  let total = 0;

  while (currentPath) {
    const res = await client.request({
      method,
      path: currentPath,
      query: currentQuery,
    });

    const data = extractData(res.body);
    const pagination = selectPagination(res.body, paginateSelector);

    debug.emit('pagination.page', {
      page: pageNum,
      records: data.length,
      cumulativeCount: total + data.length,
    });

    for (const record of data) {
      if (total >= maxItems) {
        debug.emit('pagination.stop', { reason: 'max-items', total });
        return;
      }
      yield record;
      total += 1;
    }

    if (total >= maxItems) {
      debug.emit('pagination.stop', { reason: 'max-items', total });
      return;
    }

    const nextUrl = pagination && pagination.next ? pagination.next : null;
    if (!nextUrl) {
      debug.emit('pagination.stop', { reason: 'complete', total });
      return;
    }

    const nextPath = nextPathFromUrl(nextUrl);
    if (!nextPath || nextPath === currentPath) {
      debug.emit('pagination.stop', { reason: 'no-next-path', total });
      return;
    }

    debug.emit('pagination.next', { page: pageNum + 1, nextPath });

    currentPath = nextPath;
    currentQuery = {};
    pageNum += 1;
  }
}

async function collectAll(opts) {
  const out = [];
  for await (const record of paginate(opts)) {
    out.push(record);
  }
  return out;
}

module.exports = {
  paginate,
  collectAll,
  selectPagination,
  extractData,
  nextPathFromUrl,
};
