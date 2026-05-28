'use strict';

const permissions = require('./permissions');
const users = require('./users');
const locations = require('./locations');
const departments = require('./departments');
const accountCodes = require('./account-codes');
const accounts = require('./accounts');
const budgetCategories = require('./budget-categories');
const vendors = require('./vendors');
const currencies = require('./currencies');
const catalog = require('./catalog');
const requisitions = require('./requisitions');
const purchaseOrders = require('./purchase-orders');
const orderItems = require('./order-items');
const ap = require('./ap');
const customFields = require('./custom-fields');
const pay = require('./pay');
const receipt = require('./receipt');

const SERVICES = Object.freeze({
  permissions,
  users,
  locations,
  departments,
  'account-codes': accountCodes,
  accounts,
  'budget-categories': budgetCategories,
  vendors,
  currencies,
  catalog,
  requisitions,
  'purchase-orders': purchaseOrders,
  'order-items': orderItems,
  ap,
  'custom-fields': customFields,
  pay,
  receipt,
});

const SERVICE_TAG_ORDER = [
  'permissions',
  'users',
  'locations',
  'departments',
  'account-codes',
  'accounts',
  'budget-categories',
  'vendors',
  'currencies',
  'catalog',
  'requisitions',
  'purchase-orders',
  'order-items',
  'ap',
  'custom-fields',
  'pay',
  'receipt',
];

function getService(name) {
  return SERVICES[name] || null;
}

function listServices() {
  return SERVICE_TAG_ORDER.map((name) => ({
    name,
    description: SERVICES[name].description,
    apiVersion: SERVICES[name].apiVersion,
    actionCount: Object.keys(SERVICES[name].actions).length,
  }));
}

function listActions(serviceName) {
  const svc = getService(serviceName);
  if (!svc) return null;
  return Object.entries(svc.actions).map(([action, descriptor]) => ({
    action,
    method: descriptor.method,
    path: descriptor.path,
    apiVersion: descriptor.apiVersion || svc.apiVersion,
    requiredArgs: descriptor.requiredArgs ? Object.keys(descriptor.requiredArgs) : [],
    paginated: Boolean(descriptor.paginate),
  }));
}

function getAction(serviceName, actionName) {
  const svc = getService(serviceName);
  if (!svc) return null;
  return svc.actions[actionName] || null;
}

function extractPathParams(path) {
  const re = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  const out = [];
  let m;
  while ((m = re.exec(path)) !== null) {
    out.push(m[1]);
  }
  return out;
}

module.exports = {
  SERVICES,
  SERVICE_TAG_ORDER,
  getService,
  listServices,
  listActions,
  getAction,
  extractPathParams,
};
