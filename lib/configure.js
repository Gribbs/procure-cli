'use strict';

const inquirer = require('inquirer');
const config = require('./config');

const prompt = inquirer.default?.prompt || inquirer.createPromptModule();

function maskValue(value) {
  if (!value || typeof value !== 'string' || value.length === 0) return '****';
  if (value.length <= 4) return '****';
  return '*'.repeat(Math.max(8, Math.min(value.length - 4, 16))) + value.slice(-4);
}

function normaliseSubdomain(input) {
  if (!input) return '';
  return String(input)
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\.procurify\.com\/?.*$/i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

async function configure(profileName = 'default') {
  const exists = config.profileExists(profileName);
  let existing = null;

  if (exists) {
    const raw = config.getProfile(profileName);
    existing = config.decryptProfile(raw);
    console.log(`\nEditing profile: ${profileName}`);
    console.log('Current configuration:');
    console.log(`  Domain:       ${existing.domain}.procurify.com`);
    console.log(`  Client ID:    ${maskValue(existing.clientId)}`);
    console.log(`  Client Secret: ${maskValue(existing.clientSecret)}`);
    if (existing.tokenExpiry) {
      console.log(`  Token expires: ${new Date(existing.tokenExpiry).toLocaleString()}`);
    }
    console.log('\nPress Enter to keep the existing value.\n');
  } else {
    console.log(`\nCreating profile: ${profileName}`);
    console.log(
      'You will need OAuth client-credentials from Procurify:\n' +
        '  Procurify → Settings → Integrations → Procurify API → Create Application\n' +
        '(The Client Secret is shown only once — capture it now.)\n'
    );
  }

  const answers = await prompt([
    {
      type: 'input',
      name: 'domain',
      message: `Procurify subdomain${existing ? ` [${existing.domain}]` : ' (e.g. acme-sandbox; full URLs are accepted and stripped)'}:`,
      default: '',
      filter: (v) => normaliseSubdomain(v) || (existing ? existing.domain : ''),
      validate: (v) => {
        const value = normaliseSubdomain(v) || (existing ? existing.domain : '');
        if (!value) return 'Subdomain is required';
        if (!/^[a-z0-9-]+$/.test(value)) return 'Subdomain must contain only letters, digits, or hyphens';
        return true;
      },
    },
    {
      type: 'input',
      name: 'clientId',
      message: `Client ID${existing ? ` [${maskValue(existing.clientId)}]` : ''}:`,
      default: '',
      filter: (v) => (v.trim() || (existing ? existing.clientId : '')).trim(),
      validate: (v) => {
        const value = (v.trim() || (existing ? existing.clientId : '')).trim();
        return value.length > 0 || 'Client ID is required';
      },
    },
    {
      type: 'password',
      name: 'clientSecret',
      message: `Client Secret${existing ? ` [${maskValue(existing.clientSecret)}]` : ''}:`,
      mask: '*',
      default: '',
      filter: (v) => (v.trim() || (existing ? existing.clientSecret : '')).trim(),
      validate: (v) => {
        const value = (v.trim() || (existing ? existing.clientSecret : '')).trim();
        return value.length > 0 || 'Client Secret is required';
      },
    },
  ]);

  config.saveProfile(profileName, {
    domain: answers.domain,
    clientId: answers.clientId,
    clientSecret: answers.clientSecret,
  });

  console.log(`\nProfile '${profileName}' saved to ${config.CONFIG_FILE}.`);
  console.log(`Run: procure login --profile ${profileName}`);
  console.log(`Then: procure whoami --profile ${profileName}\n`);
}

module.exports = { configure, maskValue, normaliseSubdomain };
