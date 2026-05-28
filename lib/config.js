'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const debug = require('./debug');

const CONFIG_DIR = process.env.PROCURE_HOME || path.join(os.homedir(), '.procure');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const KEY_FILE = path.join(CONFIG_DIR, '.encryption-key');

const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

function readConfig() {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_FILE)) return {};
  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to read config file at ${CONFIG_FILE}: ${error.message}`);
  }
}

function writeConfig(config) {
  ensureConfigDir();
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { encoding: 'utf8', mode: 0o600 });
  } catch (error) {
    throw new Error(`Failed to write config file at ${CONFIG_FILE}: ${error.message}`);
  }
}

function getProfile(profileName = 'default') {
  const config = readConfig();
  return config[profileName] || null;
}

function profileExists(profileName) {
  const config = readConfig();
  return profileName in config;
}

function getAllProfiles() {
  const config = readConfig();
  return Object.keys(config);
}

function deleteProfile(profileName) {
  const config = readConfig();
  if (!(profileName in config)) return false;
  delete config[profileName];
  writeConfig(config);
  return true;
}

function getEncryptionKey() {
  ensureConfigDir();
  if (fs.existsSync(KEY_FILE)) {
    const stat = fs.statSync(KEY_FILE);
    const mode = stat.mode & 0o777;
    if (mode !== 0o600) {
      throw new Error(
        `Encryption key file ${KEY_FILE} has insecure permissions (${mode.toString(8)}). ` +
          `Run: chmod 600 "${KEY_FILE}"`
      );
    }
    return fs.readFileSync(KEY_FILE, 'utf8').trim();
  }
  const key = crypto.randomBytes(32).toString('hex').slice(0, 32);
  fs.writeFileSync(KEY_FILE, key, { mode: 0o600 });
  return key;
}

function encrypt(text) {
  if (!text) return text;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, Buffer.from(key, 'utf8'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  if (!text || typeof text !== 'string' || !text.includes(':')) return text;
  const key = getEncryptionKey();
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encrypted = parts.join(':');
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, Buffer.from(key, 'utf8'), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function saveProfile(profileName, profileData) {
  const required = ['domain', 'clientId', 'clientSecret'];
  for (const field of required) {
    if (!profileData[field] || typeof profileData[field] !== 'string') {
      throw new Error(`Invalid profile: missing required field '${field}'`);
    }
  }
  const config = readConfig();
  config[profileName] = {
    domain: profileData.domain,
    clientId: profileData.clientId,
    clientSecret: encrypt(profileData.clientSecret),
    accessToken: null,
    tokenExpiry: null,
  };
  writeConfig(config);
}

function saveTokens(profileName, tokens) {
  const config = readConfig();
  const profile = config[profileName];
  if (!profile) {
    throw new Error(`Profile '${profileName}' not found. Run: procure configure --profile ${profileName}`);
  }
  profile.accessToken = encrypt(tokens.accessToken);
  profile.tokenExpiry = tokens.tokenExpiry;
  writeConfig(config);
}

function decryptProfile(profile) {
  if (!profile) return null;
  return {
    ...profile,
    clientSecret: profile.clientSecret ? decrypt(profile.clientSecret) : null,
    accessToken: profile.accessToken ? decrypt(profile.accessToken) : null,
  };
}

function isTokenExpired(profile) {
  if (!profile || !profile.tokenExpiry || !profile.accessToken) return true;
  return Date.now() >= profile.tokenExpiry - TOKEN_EXPIRY_BUFFER_MS;
}

function getEnvCredentials() {
  const env = {
    domain: process.env.PROCURIFY_DOMAIN,
    clientId: process.env.PROCURIFY_CLIENT_ID,
    clientSecret: process.env.PROCURIFY_CLIENT_SECRET,
  };
  const allSet = Object.values(env).every((v) => v && String(v).trim().length > 0);
  return allSet
    ? {
        domain: env.domain.trim(),
        clientId: env.clientId.trim(),
        clientSecret: env.clientSecret.trim(),
      }
    : null;
}

function resolveCredentials(profileName) {
  const name = profileName || process.env.PROCURE_PROFILE || 'default';
  debug.emit('config.resolve', { profile: name });

  const env = getEnvCredentials();
  if (env) {
    debug.emit('config.source', { source: 'environment', clientId: debug.maskSecret(env.clientId) });
    return {
      profile: name,
      source: 'environment',
      domain: env.domain,
      clientId: env.clientId,
      clientSecret: env.clientSecret,
      accessToken: null,
      tokenExpiry: null,
    };
  }

  const profile = getProfile(name);
  if (!profile) {
    return { profile: name, source: null, error: `Profile '${name}' not found` };
  }
  const decrypted = decryptProfile(profile);
  debug.emit('config.source', {
    source: 'profile',
    domain: decrypted.domain,
    clientId: debug.maskSecret(decrypted.clientId),
  });
  return {
    profile: name,
    source: 'profile',
    domain: decrypted.domain,
    clientId: decrypted.clientId,
    clientSecret: decrypted.clientSecret,
    accessToken: decrypted.accessToken,
    tokenExpiry: decrypted.tokenExpiry,
  };
}

module.exports = {
  CONFIG_DIR,
  CONFIG_FILE,
  KEY_FILE,
  ensureConfigDir,
  readConfig,
  writeConfig,
  getProfile,
  profileExists,
  getAllProfiles,
  deleteProfile,
  saveProfile,
  saveTokens,
  decryptProfile,
  isTokenExpired,
  getEnvCredentials,
  resolveCredentials,
  encrypt,
  decrypt,
  getEncryptionKey,
};
