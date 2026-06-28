#!/usr/bin/env node

// Runner pro Postman kolekci pres nativni Node.js https
// Nahrazuje Newman - nema TLS problemy s postman-request

const https = require('https');
const http = require('http');
const fs = require('fs');

// --- Nacti kolekci a environment ---
const collectionFile = process.argv[2] || 'ecommerce-api-collection.postman_collection.json';
const environmentFile = process.argv[3] || 'ecommerce-environment.postman_environment.json';

const collection = JSON.parse(fs.readFileSync(collectionFile, 'utf8'));
const environment = JSON.parse(fs.readFileSync(environmentFile, 'utf8'));

// Nacti environment promenne
const envVars = {};
for (const v of environment.values) {
  if (v.enabled) envVars[v.key] = v.value;
}

// Sdilene promenne mezi requesty (collection + local variables)
const variables = { ...envVars };

// Statistiky
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

// --- Jednoducha implementace pm objektu ---
function createPm(responseCode, responseTime, responseBody, responseHeaders) {
  let parsedJson = null;
  try { parsedJson = JSON.parse(responseBody); } catch (e) {}

  return {
    response: {
      code: responseCode,
      status: responseCode,
      responseTime: responseTime,
      text: () => responseBody,
      json: () => {
        if (parsedJson === null) throw new Error('"undefined" is not valid JSON');
        return parsedJson;
      },
      headers: { get: (h) => responseHeaders[h.toLowerCase()] }
    },
    expect: (val) => chai(val),
    test: (name, fn) => {
      totalTests++;
      try {
        fn();
        passedTests++;
        console.log(`    ✓ ${name}`);
      } catch (e) {
        failedTests++;
        console.log(`    ✗ ${name}`);
        console.log(`      ${e.message}`);
        failures.push({ name, error: e.message });
      }
    },
    variables: {
      set: (k, v) => { variables[k] = v; },
      get: (k) => variables[k]
    },
    collectionVariables: {
      set: (k, v) => { variables[k] = v; },
      get: (k) => variables[k]
    },
    environment: {
      set: (k, v) => { envVars[k] = v; variables[k] = v; },
      get: (k) => envVars[k]
    }
  };
}

// --- Jednoducha implementace Chai expect ---
function chai(val) {
  const obj = {
    _val: val,
    _negated: false,
    get not() { obj._negated = true; return obj; },
    get to() { return obj; },
    get be() { return obj; },
    get been() { return obj; },
    get is() { return obj; },
    get that() { return obj; },
    get which() { return obj; },
    get and() { return obj; },
    get has() { return obj; },
    get have() { return obj; },
    get with() { return obj; },
    get at() { return obj; },
    get of() { return obj; },
    get same() { return obj; },
    get an() { return obj; },
    get empty() {
      const isEmpty = val === '' || val === null || val === undefined ||
        (Array.isArray(val) && val.length === 0) ||
        (typeof val === 'object' && Object.keys(val).length === 0);
      if (!obj._negated && isEmpty) throw new Error(`Expected value to not be empty`);
      if (obj._negated && !isEmpty) throw new Error(`Expected value to be empty`);
      return obj;
    },
    equal: (expected) => {
      if (!obj._negated && val !== expected) throw new Error(`Expected ${JSON.stringify(val)} to equal ${JSON.stringify(expected)}`);
      if (obj._negated && val === expected) throw new Error(`Expected ${JSON.stringify(val)} to not equal ${JSON.stringify(expected)}`);
      return obj;
    },
    eql: (expected) => {
      const a = JSON.stringify(val), b = JSON.stringify(expected);
      if (!obj._negated && a !== b) throw new Error(`Expected ${a} to deeply equal ${b}`);
      return obj;
    },
    above: (n) => {
      if (typeof val !== 'number') throw new Error(`Expected ${val} to be a number`);
      if (!obj._negated && val <= n) throw new Error(`Expected ${val} to be above ${n}`);
      return obj;
    },
    below: (n) => {
      if (typeof val !== 'number') throw new Error(`Expected ${val} to be a number`);
      if (!obj._negated && val >= n) throw new Error(`Expected ${val} to be below ${n}`);
      return obj;
    },
    oneOf: (arr) => {
      if (!obj._negated && !arr.includes(val)) throw new Error(`Expected ${val} to be one of ${JSON.stringify(arr)}`);
      return obj;
    },
    include: (sub) => {
      if (typeof val === 'string' && !val.includes(sub)) throw new Error(`Expected "${val}" to include "${sub}"`);
      if (Array.isArray(val) && !val.includes(sub)) throw new Error(`Expected array to include ${sub}`);
      return obj;
    },
    property: (prop) => {
      if (val === null || val === undefined) throw new Error(`Expected object to have property '${prop}' but got ${val}`);
      if (!obj._negated && !(prop in val)) throw new Error(`Expected object to have property '${prop}'`);
      return obj;
    },
    a: (type) => {
      const actual = Array.isArray(val) ? 'array' : typeof val;
      if (!obj._negated && actual !== type) throw new Error(`Expected ${JSON.stringify(val)} to be a ${type} but got ${actual}`);
      return obj;
    },
    an: (type) => obj.a(type),
    lengthOf: (n) => {
      if (val.length !== n) throw new Error(`Expected length ${val.length} to equal ${n}`);
      return obj;
    },
    ok: (() => {
      if (!val) throw new Error(`Expected ${val} to be truthy`);
      return obj;
    })()
  };
  return obj;
}

// --- Nahrad promenne v textu ---
function replaceVars(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return variables[key] !== undefined ? variables[key] : `{{${key}}}`;
  });
}

// --- HTTP request ---
function makeRequest(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const lib = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: method.toUpperCase(),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const startTime = Date.now();
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          responseTime: Date.now() - startTime,
          body: data,
          headers: res.headers
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// --- Spust pre-request script ---
function runPreRequest(scripts) {
  if (!scripts) return;
  const code = scripts.join('\n').replace(/\r/g, '');
  try {
    const pm = createPm(null, null, null, {});
    const fn = new Function('pm', 'console', code);
    fn(pm, console);
  } catch (e) {
    // pre-request chyby ignoruj - nejsou fatalni
  }
}

// --- Spust test scripts ---
function runTests(scripts, statusCode, responseTime, body, headers, requestName) {
  if (!scripts) return;
  const code = scripts.join('\n').replace(/\r/g, '');
  try {
    const pm = createPm(statusCode, responseTime, body, headers);
    const fn = new Function('pm', 'console', code);
    fn(pm, console);
  } catch (e) {
    // chyba v samotnem test scriptu (ne assertion)
    totalTests++;
    failedTests++;
    failures.push({ name: `[script error] ${requestName}`, error: e.message });
    console.log(`    ✗ [script error]: ${e.message}`);
  }
}

// --- Hlavni funkce ---
async function runCollection() {
  console.log(`\necommerce-api-collection`);
  console.log('='.repeat(50));

  for (const item of collection.item) {
    const name = item.name;
    const request = item.request;
    const events = item.event || [];

    // Pre-request script
    const preReqEvent = events.find(e => e.listen === 'prerequest');
    if (preReqEvent) {
      runPreRequest(preReqEvent.script.exec);
    }

    // Sestav URL
    const rawUrl = replaceVars(request.url.raw);
    const method = request.method;

    // Sestav body
    let body = null;
    if (request.body && request.body.raw) {
      body = replaceVars(request.body.raw);
    }

    console.log(`\n→ ${name}`);
    console.log(`  ${method} ${rawUrl}`);

    try {
      const result = await makeRequest(method, rawUrl, {}, body);
      console.log(`  Status: ${result.statusCode} | ${result.responseTime}ms`);

      // Test scripts
      const testEvent = events.find(e => e.listen === 'test');
      if (testEvent) {
        runTests(
          testEvent.script.exec,
          result.statusCode,
          result.responseTime,
          result.body,
          result.headers,
          name
        );
      }
    } catch (e) {
      console.log(`  [errored] ${e.message}`);
      totalTests += (events.find(ev => ev.listen === 'test')?.script?.exec?.join('').match(/pm\.test/g) || []).length;
      failedTests += (events.find(ev => ev.listen === 'test')?.script?.exec?.join('').match(/pm\.test/g) || []).length;
      failures.push({ name, error: e.message });
    }
  }

  // Souhrn
  console.log('\n' + '='.repeat(50));
  console.log(`Celkem testů:  ${totalTests}`);
  console.log(`Prošlo:        ${passedTests}`);
  console.log(`Selhalo:       ${failedTests}`);

  if (failures.length > 0) {
    console.log('\nSelhané testy:');
    failures.forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.name}`);
      console.log(`     ${f.error}`);
    });
  }

  // Exit code pro CI
  process.exit(failedTests > 0 ? 1 : 0);
}

runCollection().catch(e => {
  console.error('Fatální chyba:', e);
  process.exit(1);
});
