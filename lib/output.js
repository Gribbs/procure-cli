'use strict';

const Table = require('cli-table3');
const jmespath = require('jmespath');

function flatten(obj, prefix = '', out = {}) {
  if (obj == null) {
    if (prefix) out[prefix] = '';
    return out;
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      out[prefix] = '';
      return out;
    }
    if (obj.every((v) => v == null || typeof v !== 'object')) {
      out[prefix] = obj.join('|');
      return out;
    }
    obj.forEach((item, idx) => {
      flatten(item, prefix ? `${prefix}.${idx}` : String(idx), out);
    });
    return out;
  }
  if (typeof obj !== 'object') {
    out[prefix] = obj;
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v == null) {
      out[next] = '';
    } else if (typeof v === 'object') {
      flatten(v, next, out);
    } else {
      out[next] = v;
    }
  }
  return out;
}

function csvEscape(value) {
  if (value == null) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function pickColumns(record, columns) {
  if (!columns || columns.length === 0) return record;
  const out = {};
  for (const col of columns) {
    out[col] = getPath(record, col);
  }
  return out;
}

function getPath(obj, dottedPath) {
  if (!obj || !dottedPath) return undefined;
  const parts = dottedPath.split('.');
  let cur = obj;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

function applyQuery(records, query) {
  if (!query) return records;
  return jmespath.search(records, query);
}

function formatJson(records, { pretty = true } = {}) {
  return pretty ? JSON.stringify(records, null, 2) : JSON.stringify(records);
}

function formatJsonl(records) {
  if (!Array.isArray(records)) return JSON.stringify(records);
  return records.map((r) => JSON.stringify(r)).join('\n');
}

function formatCsv(records, { columns = null, delimiter = ',' } = {}) {
  if (!Array.isArray(records) || records.length === 0) return '';
  const flatRecords = records.map((r) => (typeof r === 'object' && r !== null ? flatten(r) : { value: r }));
  const headerSet = columns && columns.length > 0 ? columns : uniqueKeys(flatRecords);
  const lines = [headerSet.map(csvEscape).join(delimiter)];
  for (const rec of flatRecords) {
    lines.push(headerSet.map((h) => csvEscape(rec[h])).join(delimiter));
  }
  return lines.join('\n');
}

function formatTsv(records, opts = {}) {
  return formatCsv(records, { ...opts, delimiter: '\t' });
}

function uniqueKeys(records) {
  const seen = new Set();
  const ordered = [];
  for (const rec of records) {
    for (const k of Object.keys(rec)) {
      if (!seen.has(k)) {
        seen.add(k);
        ordered.push(k);
      }
    }
  }
  return ordered;
}

function formatTable(records, { columns = null, maxColumns = 8 } = {}) {
  if (!Array.isArray(records) || records.length === 0) return '(no records)';

  const flatRecords = records.map((r) => (typeof r === 'object' && r !== null ? flatten(r) : { value: r }));
  let headers = columns && columns.length > 0 ? columns : uniqueKeys(flatRecords);
  if (!columns && headers.length > maxColumns) {
    headers = headers.slice(0, maxColumns);
  }

  const table = new Table({
    head: headers,
    style: { head: [], border: [] },
    wordWrap: true,
    wrapOnWordBoundary: true,
  });
  for (const rec of flatRecords) {
    table.push(headers.map((h) => formatCell(rec[h])));
  }
  return table.toString();
}

function formatCell(v) {
  if (v == null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  const str = String(v);
  if (str.length > 80) return str.slice(0, 77) + '...';
  return str;
}

function format(records, opts = {}) {
  const { output = 'json', columns = null, query = null } = opts;
  let result = records;
  if (query) result = applyQuery(result, query);
  if (!Array.isArray(result)) {
    if (result == null) result = [];
    else if (typeof result === 'object') result = [result];
  }
  const cols = columns ? columns.split(',').map((s) => s.trim()).filter(Boolean) : null;

  if (cols && (output === 'json' || output === 'jsonl')) {
    result = result.map((r) => pickColumns(r, cols));
  }

  switch (output) {
    case 'json':
      return formatJson(result);
    case 'jsonl':
      return formatJsonl(result);
    case 'csv':
      return formatCsv(result, { columns: cols });
    case 'tsv':
      return formatTsv(result, { columns: cols });
    case 'table':
      return formatTable(result, { columns: cols });
    default:
      throw new Error(`Unknown output format: ${output}. Use: json, jsonl, csv, tsv, table.`);
  }
}

module.exports = {
  format,
  formatJson,
  formatJsonl,
  formatCsv,
  formatTsv,
  formatTable,
  applyQuery,
  flatten,
  pickColumns,
  getPath,
};
