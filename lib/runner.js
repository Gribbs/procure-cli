'use strict';

const apiClient = require('./api-client');
const pagination = require('./pagination');
const output = require('./output');
const filters = require('./filters');
const registry = require('./services/_registry');
const debug = require('./debug');
const { HarRecorder } = require('./har');
const fs = require('fs');
const readline = require('readline');

class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
    this.exitCode = 2;
  }
}

function validateArg(name, value, spec) {
  if (spec.enum) {
    if (!spec.enum.includes(value)) {
      throw new UsageError(
        `Invalid value '${value}' for ${name}. Allowed values: ${spec.enum.join(', ')}.`
      );
    }
  }
  if (spec.pattern && !spec.pattern.test(value)) {
    throw new UsageError(`Invalid value '${value}' for ${name}: does not match expected format. ${spec.help || ''}`.trim());
  }
}

function resolvePathParam(name, providedValue, spec) {
  let value = providedValue;
  if (value == null || value === '') {
    if (spec.default != null) value = spec.default;
    else throw new UsageError(`Missing required argument: ${name}. ${spec.help || ''}`.trim());
  }
  validateArg(name, String(value), spec);
  return String(value);
}

function buildPathFromTemplate(template, params) {
  return template.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (match, key) => {
    if (params[key] == null) {
      throw new UsageError(`Missing required path parameter: ${key}`);
    }
    return encodeURIComponent(String(params[key]));
  });
}

async function readStdinLines() {
  return new Promise((resolve, reject) => {
    const lines = [];
    const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (trimmed) lines.push(trimmed);
    });
    rl.on('close', () => resolve(lines));
    rl.on('error', reject);
  });
}

function resolveBody({ body, bodyFile, defaultBody }) {
  let raw = null;
  if (bodyFile != null && bodyFile !== '') {
    raw = bodyFile === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(bodyFile, 'utf8');
  } else if (body != null && body !== '') {
    if (typeof body === 'string' && body.startsWith('@')) {
      const file = body.slice(1);
      raw = file === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(file, 'utf8');
    } else {
      raw = body;
    }
  } else if (defaultBody != null) {
    raw = defaultBody;
  }
  return raw;
}

async function runAction({ serviceName, actionName, positionalArgs = [], rawArgv = [], globalOpts = {}, body = null, bodyFile = null }) {
  const action = registry.getAction(serviceName, actionName);
  if (!action) {
    throw new UsageError(`Unknown action '${actionName}' for service '${serviceName}'.`);
  }

  const pathParams = registry.extractPathParams(action.path);
  const requiredArgs = action.requiredArgs || {};

  const filterParams = filters.parseUnknownArgs(rawArgv);

  const resolvedPathParams = {};
  let stdinIdValues = null;
  let resolvedBody = null;
  if (action.acceptsBody) {
    resolvedBody = resolveBody({ body, bodyFile, defaultBody: action.defaultBody });
    if (resolvedBody == null && !action.defaultBody) {
      throw new UsageError(
        `Action '${serviceName} ${actionName}' requires a request body. Use --body '<json>' or --body-file <path> (use '-' for stdin).`
      );
    }
  } else if (body != null || bodyFile != null) {
    throw new UsageError(`Action '${serviceName} ${actionName}' does not accept a request body.`);
  }

  for (let idx = 0; idx < pathParams.length; idx += 1) {
    const argName = pathParams[idx];
    const spec = requiredArgs[argName] || { help: `${argName} path parameter.` };

    let raw = positionalArgs[idx];
    if (raw == null) {
      raw = filterParams[argName];
    }
    delete filterParams[argName];

    if (raw === '-' && pathParams.length === 1) {
      stdinIdValues = await readStdinLines();
      if (stdinIdValues.length === 0) {
        throw new UsageError('Stdin (-) was empty: no ids to process.');
      }
      resolvedPathParams[argName] = stdinIdValues[0];
      continue;
    }

    resolvedPathParams[argName] = resolvePathParam(argName, raw, spec);
  }

  const apiVersionOverride = globalOpts.apiVersion;
  const harRecorder = globalOpts.debugHar ? new HarRecorder() : null;

  const client = apiClient.createClient({
    profile: globalOpts.profile,
    harRecorder,
  });

  const isPaginatedList = Boolean(action.paginate);

  const baseQuery = { ...filterParams };
  if (globalOpts.serverFormat) {
    baseQuery.format = globalOpts.serverFormat;
  }

  const runOnce = async (pathParamsForCall) => {
    let resolvedPath = buildPathFromTemplate(action.path, pathParamsForCall);
    if (apiVersionOverride) {
      resolvedPath = filters.applyApiVersion(resolvedPath, apiVersionOverride);
    }

    if (globalOpts.serverFormat === 'csv') {
      const res = await client.request({
        method: action.method,
        path: resolvedPath,
        query: baseQuery,
        body: resolvedBody,
        parseJson: false,
      });
      process.stdout.write(res.text);
      if (!res.text.endsWith('\n')) process.stdout.write('\n');
      return;
    }

    if (isPaginatedList) {
      const records = await pagination.collectAll({
        client,
        method: action.method,
        path: resolvedPath,
        query: baseQuery,
        paginate: action.paginate,
        maxItems: globalOpts.maxItems,
        pageSize: globalOpts.pageSize,
      });
      const formatted = output.format(records, {
        output: globalOpts.output || 'json',
        columns: globalOpts.columns,
        query: globalOpts.query,
      });
      process.stdout.write(formatted + '\n');
      return;
    }

    const res = await client.request({
      method: action.method,
      path: resolvedPath,
      query: baseQuery,
      body: resolvedBody,
    });
    const formatted = output.format(res.body, {
      output: globalOpts.output || 'json',
      columns: globalOpts.columns,
      query: globalOpts.query,
    });
    process.stdout.write(formatted + '\n');
  };

  if (stdinIdValues && stdinIdValues.length > 0) {
    const idArgName = pathParams[0];
    const spec = requiredArgs[idArgName] || {};
    const failures = [];
    const concurrency = Math.max(1, Number(globalOpts.concurrency) || 4);

    const queue = [...stdinIdValues];
    const workers = [];

    const runWorker = async () => {
      while (queue.length > 0) {
        const id = queue.shift();
        try {
          validateArg(idArgName, id, spec);
          await runOnce({ ...resolvedPathParams, [idArgName]: id });
        } catch (err) {
          failures.push({ id, message: err.message });
          process.stderr.write(`[error] ${idArgName}=${id}: ${err.message}\n`);
        }
      }
    };

    for (let i = 0; i < concurrency; i += 1) workers.push(runWorker());
    await Promise.all(workers);

    if (harRecorder && globalOpts.debugHar) {
      harRecorder.writeFile(globalOpts.debugHar);
      debug.emit('har.written', { path: globalOpts.debugHar, entries: harRecorder.entries.length });
    }

    if (failures.length > 0) {
      throw new Error(`${failures.length}/${stdinIdValues.length} requests failed`);
    }
    return;
  }

  await runOnce(resolvedPathParams);

  if (harRecorder && globalOpts.debugHar) {
    harRecorder.writeFile(globalOpts.debugHar);
    debug.emit('har.written', { path: globalOpts.debugHar, entries: harRecorder.entries.length });
  }
}

async function runRaw({ method, path, body, bodyFile, globalOpts }) {
  const harRecorder = globalOpts.debugHar ? new HarRecorder() : null;
  const client = apiClient.createClient({ profile: globalOpts.profile, harRecorder });

  const resolvedBody = resolveBody({ body, bodyFile });

  const res = await client.request({
    method: method.toUpperCase(),
    path,
    body: resolvedBody,
  });

  if (harRecorder && globalOpts.debugHar) {
    harRecorder.writeFile(globalOpts.debugHar);
  }

  if (res.body == null) {
    process.stdout.write(res.text + (res.text.endsWith('\n') ? '' : '\n'));
  } else {
    const formatted = output.format(res.body, {
      output: globalOpts.output || 'json',
      columns: globalOpts.columns,
      query: globalOpts.query,
    });
    process.stdout.write(formatted + '\n');
  }
}

module.exports = {
  runAction,
  runRaw,
  UsageError,
  buildPathFromTemplate,
  validateArg,
  resolveBody,
};
