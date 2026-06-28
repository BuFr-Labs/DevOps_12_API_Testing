#!/usr/bin/env node

// Runner pro Postman kolekci pres nativni Node.js https
// Nahrazuje Newman - nema TLS problemy s postman-request

const https = require('https');
const http = require('http');
const fs = require('fs');

const collectionFile = process.argv[2] || 'ecommerce-api-collection.postman_collection.json';
const environmentFile = process.argv[3] || 'ecommerce-environment.postman_environment.json';

const collection = JSON.parse(fs.readFileSync(collectionFile, 'utf8'));
const environment = JSON.parse(fs.readFileSync(environmentFile, 'utf8'));

const envVars = {};
for (const v of environment.values) {
  if (v.enabled) envVars[v.key] = v.value;
}

const variables = { ...envVars };

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

// --- pm objekt ---
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
    expect: (val) => createChain(val, false),
    test: (name, fn) => {
      totalTests++;
      try {
        fn();
        passedTests++;
        console.log('    \u2713 ' + name);
      } catch (e) {
        failedTests++;
        console.log('    \u2717 ' + name);
        console.log('      ' + e.message);
        failures.push({ name: name, error: e.message });
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

// --- Chai implementace ---
function createChain(val, negated) {
  function assert(condition, msgTrue, msgFalse) {
    if (!negated && !condition) throw new Error(msgTrue);
    if (negated && condition) throw new Error(msgFalse || msgTrue);
  }

  const chain = {
    get not() { return createChain(val, true); },
    get to() { return chain; },
    get be() { return chain; },
    get been() { return chain; },
    get is() { return chain; },
    get that() { return chain; },
    get which() { return chain; },
    get and() { return chain; },
    get has() { return chain; },
    get have() { return chain; },
    get with() { return chain; },
    get at() { return chain; },
    get of() { return chain; },
    get same() { return chain; },
    get empty() {
      const isEmpty = val === '' || val === null || val === undefined ||
        (Array.isArray(val) && val.length === 0) ||
        (typeof val === 'object' && val !== null && Object.keys(val).length === 0);
      assert(!isEmpty, 'Expected value to not be empty', 'Expected value to be empty');
      return chain;
    },
    equal(expected) {
      assert(val === expected,
        'Expected ' + JSON.stringify(val) + ' to equal ' + JSON.stringify(expected),
        'Expected ' + JSON.stringify(val) + ' to not equal ' + JSON.stringify(expected));
      return chain;
    },
    eql(expected) {
      assert(JSON.stringify(val) === JSON.stringify(expected),
        'Expected ' + JSON.stringify(val) + ' to deeply equal ' + JSON.stringify(expected));
      return chain;
    },
    above(n) {
      if (typeof val !== 'number') throw new Error('Expected ' + val + ' to be a number');
      assert(val > n, 'Expected ' + val + ' to be above ' + n);
      return chain;
    },
    below(n) {
      if (typeof val !== 'number') throw new Error('Expected ' + val + ' to be a number');
      assert(val < n, 'Expected ' + val + ' to be below ' + n);
      return chain;
    },
    oneOf(arr) {
      assert(arr.includes(val),
        'Expected ' + val + ' to be one of ' + JSON.stringify(arr));
      return chain;
    },
    include(sub) {
      if (typeof val === 'string') assert(val.includes(sub), 'Expected "' + val + '" to include "' + sub + '"');
      if (Array.isArray(val)) assert(val.includes(sub), 'Expected array to include ' + sub);
      return chain;
    },
    property(prop) {
      if (val === null || val === undefined) throw new Error("Expected object to have property '" + prop + "' but got " + val);
      assert(prop in val, "Expected object to have property '" + prop + "'");
      return chain;
    },
    a(type) {
      const actual = Array.isArray(val) ? 'array' : typeof val;
      assert(actual === type,
        'Expected ' + JSON.stringify(val) + ' to be a ' + type + ' but got ' + actual);
      return chain;
    },
    an(type) { return chain.a(type); },
    lengthOf(n) {
      assert(val.length === n, 'Expected length ' + val.length + ' to equal ' + n);
      return chain;
    },
    ok() {
      assert(!!val, 'Expected ' + val + ' to be truthy');
      return chain;
    }
  };
  return chain;
}

function replaceVars(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/\{\{(\w+)\}\}/g, function(_, key) {
    return variables[key] !== undefined ? variables[key] : '{{' + key + '}}';
  });
}

function makeRequest(method, url, body) {
  return new Promise(function(resolve, reject) {
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    const startTime = Date.now();
    const req = lib.request(options, function(res) {
      let data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
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

function runPreRequest(scripts) {
  if (!scripts) return;
  const code = scripts.join('\n').replace(/\r/g, '');
  try {
    const pm = createPm(null, null, '{}', {});
    const fn = new Function('pm', 'console', code);
    fn(pm, console);
  } catch (e) {
    // ignoruj
  }
}

function runTests(scripts, statusCode, responseTime, body, headers, requestName) {
  if (!scripts) return;
  const code = scripts.join('\n').replace(/\r/g, '');
  try {
    const pm = createPm(statusCode, responseTime, body, headers);
    const fn = new Function('pm', 'console', code);
    fn(pm, console);
  } catch (e) {
    totalTests++;
    failedTests++;
    failures.push({ name: '[script error] ' + requestName, error: e.message });
    console.log('    \u2717 [script error]: ' + e.message);
  }
}

async function runCollection() {
  console.log('\necommerce-api-collection');
  console.log('='.repeat(50));

  for (const item of collection.item) {
    const name = item.name;
    const request = item.request;
    const events = item.event || [];

    const preReqEvent = events.find(function(e) { return e.listen === 'prerequest'; });
    if (preReqEvent) runPreRequest(preReqEvent.script.exec);

    const rawUrl = replaceVars(request.url.raw);
    const method = request.method;

    let body = null;
    if (request.body && request.body.raw) {
      body = replaceVars(request.body.raw);
    }

    console.log('\n\u2192 ' + name);
    console.log('  ' + method + ' ' + rawUrl);

    try {
      const result = await makeRequest(method, rawUrl, body);
      console.log('  Status: ' + result.statusCode + ' | ' + result.responseTime + 'ms');

      const testEvent = events.find(function(e) { return e.listen === 'test'; });
      if (testEvent) {
        runTests(testEvent.script.exec, result.statusCode, result.responseTime, result.body, result.headers, name);
      }
    } catch (e) {
      console.log('  [errored] ' + e.message);
      const testEvent = events.find(function(ev) { return ev.listen === 'test'; });
      const count = testEvent ? (testEvent.script.exec.join('').match(/pm\.test/g) || []).length : 0;
      totalTests += count;
      failedTests += count;
      failures.push({ name: name, error: e.message });
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('Celkem testu:  ' + totalTests);
  console.log('Proslo:        ' + passedTests);
  console.log('Selhalo:       ' + failedTests);

  if (failures.length > 0) {
    console.log('\nSelhane testy:');
    failures.forEach(function(f, i) {
      console.log('  ' + (i + 1) + '. ' + f.name);
      console.log('     ' + f.error);
    });
  }

  process.exit(failedTests > 0 ? 1 : 0);
}

runCollection().catch(function(e) {
  console.error('Fatalni chyba:', e);
  process.exit(1);
});
