#!/usr/bin/env node
'use strict';

const { Command, Option } = require('commander');
const fs = require('fs');

const { configure } = require('./lib/configure');
const config = require('./lib/config');
const oauth = require('./lib/oauth');
const debug = require('./lib/debug');
const registry = require('./lib/services/_registry');
const { runAction, runRaw, UsageError } = require('./lib/runner');
const apiClient = require('./lib/api-client');

const { version } = require('./package.json');

function parseGlobalOptions(opts) {
  const globalOpts = {
    profile: opts.profile || process.env.PROCURE_PROFILE || 'default',
    output: opts.output || 'json',
    query: opts.query || null,
    columns: opts.columns || null,
    maxItems: opts.maxItems != null ? Number(opts.maxItems) : Infinity,
    pageSize: opts.pageSize != null ? Number(opts.pageSize) : null,
    serverFormat: opts.serverFormat || null,
    apiVersion: opts.apiVersion || null,
    concurrency: opts.concurrency != null ? Number(opts.concurrency) : 4,
    debugHar: opts.debugHar || null,
    logFormat: opts.logFormat || 'text',
    logFile: opts.logFile || null,
    quiet: Boolean(opts.quiet),
    noColor: Boolean(opts.noColor),
  };

  if (opts.debug || globalOpts.debugHar || globalOpts.logFile) debug.enable();
  if (globalOpts.logFormat === 'json') debug.setLogFormat('json');
  if (globalOpts.logFile) {
    const stream = fs.createWriteStream(globalOpts.logFile, { flags: 'a' });
    debug.setLogFileStream(stream);
  }

  return globalOpts;
}

function attachGlobalOptions(cmd) {
  return cmd
    .option('-p, --profile <name>', 'Profile name (default: $PROCURE_PROFILE or "default")')
    .option('-o, --output <format>', 'Output format: json | jsonl | csv | tsv | table', 'json')
    .option('-q, --query <jmespath>', 'JMESPath expression applied after pagination, before format')
    .option('--columns <list>', 'Comma-separated dotted paths to include (csv/tsv/table/json)')
    .option('--max-items <n>', 'Maximum total records returned across all pages', (v) => Number(v))
    .option('--page-size <n>', 'Server-side ?page_size= for the first request', (v) => Number(v))
    .addOption(new Option('--server-format <fmt>', 'Pass ?format= to the server (csv | json)').choices(['csv', 'json']))
    .option('--api-version <v>', 'Override the API version segment of the registered path (e.g. v3)')
    .option('--concurrency <n>', 'Parallel requests when reading ids from stdin', (v) => Number(v))
    .option('--debug', 'Enable debug logging to stderr')
    .option('--debug-har <path>', 'Write a HAR 1.2 file of the HTTP exchange')
    .addOption(new Option('--log-format <fmt>', 'Log line format').choices(['text', 'json']).default('text'))
    .option('--log-file <path>', 'Mirror debug output to this file (append mode)')
    .option('--quiet', 'Suppress non-error stderr')
    .option('--no-color', 'Disable ANSI colors in output');
}

const program = new Command();

program
  .name('procure')
  .description('Unofficial command-line client for the Procurify REST API.')
  .version(version)
  .showHelpAfterError(true);

attachGlobalOptions(
  program
    .command('configure')
    .description('Create or edit a profile (encrypted client credentials).')
).action(async (opts) => {
  parseGlobalOptions(opts);
  try {
    await configure(opts.profile || 'default');
  } catch (err) {
    handleError(err);
  }
});

attachGlobalOptions(
  program
    .command('login')
    .description('Force a fresh OAuth 2.0 token fetch and cache it.')
).action(async (opts) => {
  const globalOpts = parseGlobalOptions(opts);
  try {
    const tok = await oauth.getValidToken(globalOpts.profile, { force: true });
    console.log(`Profile '${globalOpts.profile}' authenticated.`);
    console.log(`  Domain: ${tok.domain}.procurify.com`);
    console.log(`  Token expires: ${new Date(tok.tokenExpiry).toLocaleString()}`);
  } catch (err) {
    handleError(err);
  }
});

attachGlobalOptions(
  program
    .command('whoami')
    .description('GET /api/v3/users/me/ for the current profile.')
).action(async (opts) => {
  const globalOpts = parseGlobalOptions(opts);
  try {
    const client = apiClient.createClient({ profile: globalOpts.profile });
    const res = await client.request({ method: 'GET', path: '/api/v3/users/me/' });
    process.stdout.write(JSON.stringify(res.body, null, 2) + '\n');
  } catch (err) {
    handleError(err);
  }
});

program
  .command('list-services')
  .description('List all known service tags.')
  .action(() => {
    const services = registry.listServices();
    console.log(JSON.stringify(services, null, 2));
  });

program
  .command('list-actions <service>')
  .description('List all actions for a given service.')
  .action((serviceName) => {
    const actions = registry.listActions(serviceName);
    if (!actions) {
      console.error(`Unknown service: ${serviceName}`);
      console.error(`Run: procure list-services`);
      process.exit(2);
    }
    console.log(JSON.stringify(actions, null, 2));
  });

program
  .command('list-profiles')
  .description('List all configured profile names.')
  .action(() => {
    const profiles = config.getAllProfiles();
    console.log(JSON.stringify(profiles, null, 2));
  });

attachGlobalOptions(
  program
    .command('raw <method> <path>')
    .description('Make an arbitrary authenticated request to the Procurify API.')
    .option('--body <data>', 'Request body. Use @file or @- to read from a file or stdin.')
    .option('--body-file <path>', "Read request body from file path. Use '-' for stdin.")
).action(async (method, requestPath, opts) => {
  const globalOpts = parseGlobalOptions(opts);
  try {
    await runRaw({ method, path: requestPath, body: opts.body, bodyFile: opts.bodyFile, globalOpts });
  } catch (err) {
    handleError(err);
  }
});

for (const serviceName of registry.SERVICE_TAG_ORDER) {
  const svc = registry.getService(serviceName);
  if (!svc) continue;

  const serviceCmd = program
    .command(serviceName)
    .description(svc.description);

  for (const [actionName, actionDescriptor] of Object.entries(svc.actions)) {
    const pathParams = registry.extractPathParams(actionDescriptor.path);
    const positionalSpec = pathParams.length > 0 ? ' ' + pathParams.map((p) => `[${p}]`).join(' ') : '';
    const desc = `${actionDescriptor.method} ${actionDescriptor.path}` +
      (actionDescriptor.apiVersion ? ` (api: ${actionDescriptor.apiVersion})` : '');

    const actionCmd = serviceCmd
      .command(`${actionName}${positionalSpec}`)
      .description(desc)
      .allowUnknownOption(true)
      .allowExcessArguments(true);

    if (pathParams.length === 1) {
      actionCmd.option(`--${pathParams[0].replace(/_/g, '-')} <value>`, `Path parameter: ${pathParams[0]} (or use positional). Use '-' to read ids from stdin.`);
    } else {
      for (const p of pathParams) {
        actionCmd.option(`--${p.replace(/_/g, '-')} <value>`, `Path parameter: ${p} (or use positional).`);
      }
    }

    if (actionDescriptor.knownFilters && actionDescriptor.knownFilters.length > 0) {
      const helpFilters = actionDescriptor.knownFilters
        .map((f) => `--${f.replace(/_/g, '-')}`)
        .join(', ');
      actionCmd.addHelpText('after', `\nCommon filters (passthrough; any --flag is sent as a query param):\n  ${helpFilters}\n`);
    }

    if (actionDescriptor.acceptsBody) {
      actionCmd.option(
        '--body <data>',
        actionDescriptor.defaultBody
          ? `Request body (JSON). Use @file or @- to read from a file or stdin. Defaults to ${actionDescriptor.defaultBody} (touch-only PATCH).`
          : 'Request body (JSON). Use @file or @- to read from a file or stdin.'
      );
      actionCmd.option('--body-file <path>', "Read request body from file path. Use '-' for stdin.");
    }

    attachGlobalOptions(actionCmd);

    actionCmd.action(async (...allArgs) => {
      const opts = allArgs[allArgs.length - 2];
      const positionalArgs = allArgs.slice(0, allArgs.length - 2).map((v) => (v == null ? null : v));
      const globalOpts = parseGlobalOptions(opts);
      try {
        await runAction({
          serviceName,
          actionName,
          positionalArgs,
          rawArgv: process.argv.slice(2),
          globalOpts,
          body: opts.body,
          bodyFile: opts.bodyFile,
        });
      } catch (err) {
        handleError(err);
      }
    });
  }
}

function handleError(err) {
  if (err instanceof UsageError) {
    process.stderr.write(`Usage error: ${err.message}\n`);
    process.exit(2);
  }
  if (err && err.name === 'ApiError') {
    process.stderr.write(`API error: ${err.message}\n`);
    if (err.requestId) process.stderr.write(`  request_id: ${err.requestId}\n`);
    if (err.url) process.stderr.write(`  url: ${err.url}\n`);
    process.exit(1);
  }
  if (err && err.name === 'OAuthError') {
    process.stderr.write(`OAuth error: ${err.message}\n`);
    process.exit(1);
  }
  process.stderr.write(`Error: ${err && err.message ? err.message : String(err)}\n`);
  if (debug.isEnabled() && err && err.stack) {
    process.stderr.write(err.stack + '\n');
  }
  process.exit(1);
}

program.on('command:*', (operands) => {
  console.error(`Unknown command: ${operands.join(' ')}`);
  console.error('See --help for available commands.');
  process.exit(2);
});

program.parseAsync(process.argv).catch(handleError);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
