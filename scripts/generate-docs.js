#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const registry = require('../lib/services/_registry');

const README_PATH = path.join(__dirname, '..', 'README.md');
const SERVICES_DOC_PATH = path.join(__dirname, '..', 'docs', 'services.md');

const BEGIN_MARKER = '<!-- BEGIN AUTO-GENERATED API REFERENCE -->';
const END_MARKER = '<!-- END AUTO-GENERATED API REFERENCE -->';

function buildApiReferenceMarkdown() {
  const lines = [];
  lines.push('');
  lines.push('> Auto-generated from `lib/services/`. Do not edit by hand —');
  lines.push('> regenerate with `npm run docs`.');
  lines.push('');

  for (const serviceName of registry.SERVICE_TAG_ORDER) {
    const svc = registry.getService(serviceName);
    lines.push(`### \`${serviceName}\` — ${escapeMd(svc.description)}`);
    lines.push('');
    lines.push(`Default API version: \`${svc.apiVersion}\``);
    lines.push('');
    lines.push('| Action | Method | Path | API | Path params | Paginated | Common filters |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- |');
    for (const [actionName, descriptor] of Object.entries(svc.actions)) {
      const pathParams = registry.extractPathParams(descriptor.path);
      const requiredArgs = descriptor.requiredArgs || {};
      const paramsCol = pathParams.length === 0
        ? '—'
        : pathParams
            .map((p) => {
              const spec = requiredArgs[p];
              if (!spec) return `\`${p}\``;
              if (spec.enum) return `\`${p}\` (enum: ${spec.enum.join(', ')})`;
              if (spec.pattern) return `\`${p}\` (pattern)`;
              return `\`${p}\``;
            })
            .join('<br>');
      const filtersCol =
        descriptor.knownFilters && descriptor.knownFilters.length > 0
          ? descriptor.knownFilters.map((f) => `\`--${f.replace(/_/g, '-')}\``).join(', ')
          : '—';
      lines.push(
        `| \`${actionName}\` | ${descriptor.method} | \`${descriptor.path}\` | ${descriptor.apiVersion || svc.apiVersion} | ${paramsCol} | ${descriptor.paginate ? `yes (${descriptor.paginate})` : 'no'} | ${filtersCol} |`
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}

function escapeMd(s) {
  return String(s).replace(/\|/g, '\\|');
}

function injectIntoReadme(readmeText, generated) {
  const beginIdx = readmeText.indexOf(BEGIN_MARKER);
  const endIdx = readmeText.indexOf(END_MARKER);
  if (beginIdx === -1 || endIdx === -1) {
    throw new Error(
      `README.md is missing markers. Add ${BEGIN_MARKER} and ${END_MARKER} where the API reference should appear.`
    );
  }
  const before = readmeText.slice(0, beginIdx + BEGIN_MARKER.length);
  const after = readmeText.slice(endIdx);
  return `${before}\n${generated}\n${after}`;
}

function buildServicesDoc() {
  const lines = [];
  lines.push('# Procurify API Reference');
  lines.push('');
  lines.push('> Auto-generated from `lib/services/`. Run `npm run docs` to refresh.');
  lines.push('');
  lines.push(buildApiReferenceMarkdown());
  return lines.join('\n');
}

function main() {
  const generated = buildApiReferenceMarkdown();

  fs.mkdirSync(path.dirname(SERVICES_DOC_PATH), { recursive: true });
  fs.writeFileSync(SERVICES_DOC_PATH, buildServicesDoc(), 'utf8');

  const readme = fs.readFileSync(README_PATH, 'utf8');
  const updated = injectIntoReadme(readme, generated);
  if (updated !== readme) {
    fs.writeFileSync(README_PATH, updated, 'utf8');
  }

  process.stdout.write(`Wrote ${SERVICES_DOC_PATH}\n`);
  process.stdout.write(`Updated API reference inside ${README_PATH}\n`);
}

main();
