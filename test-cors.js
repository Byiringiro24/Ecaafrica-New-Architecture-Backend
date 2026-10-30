#!/usr/bin/env node

/**
 * CORS Testing Script
 * Usage: node test-cors.js [backend-url] [frontend-origin]
 * Example: node test-cors.js https://backend.ecareafrica.net https://ecareafrica.net
 */

const https = require('https');
const http = require('http');

const backendUrl = process.argv[2] || 'https://backend.ecareafrica.net';
const frontendOrigin = process.argv[3] || 'https://ecareafrica.net';

console.log('\n🔍 CORS Configuration Test\n');
console.log(`Backend URL: ${backendUrl}`);
console.log(`Frontend Origin: ${frontendOrigin}\n`);
console.log('═'.repeat(60));

// Test 1: Health Check
console.log('\n📍 Test 1: Health Check (GET)');
testRequest(backendUrl + '/api/health', {
  method: 'GET',
  headers: {
    'Origin': frontendOrigin
  }
}, 'Health Check');

// Test 2: Preflight Request for Login
console.log('\n📍 Test 2: Preflight Request for Login (OPTIONS)');
testRequest(backendUrl + '/api/v1/auth/login', {
  method: 'OPTIONS',
  headers: {
    'Origin': frontendOrigin,
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type,authorization'
  }
}, 'Login Preflight');

// Test 3: Actual Login Request
setTimeout(() => {
  console.log('\n📍 Test 3: Login Request (POST)');
  testRequest(backendUrl + '/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'Origin': frontendOrigin,
      'Content-Type': 'application/json'
    }
  }, 'Login POST', JSON.stringify({
    email: 'test@example.com',
    password: 'test123'
  }));
}, 1000);

function testRequest(url, options, testName, body = null) {
  const urlObj = new URL(url);
  const client = urlObj.protocol === 'https:' ? https : http;

  const req = client.request(url, options, (res) => {
    console.log(`\n✓ ${testName} Response:`);
    console.log(`  Status: ${res.statusCode} ${res.statusMessage}`);
    console.log(`  Headers:`);
    
    const importantHeaders = [
      'access-control-allow-origin',
      'access-control-allow-methods',
      'access-control-allow-headers',
      'access-control-allow-credentials',
      'access-control-max-age'
    ];

    let hasAnyCorHeader = false;
    importantHeaders.forEach(header => {
      if (res.headers[header]) {
        console.log(`    ${header}: ${res.headers[header]}`);
        hasAnyCorHeader = true;
      }
    });

    if (!hasAnyCorHeader) {
      console.log('    ❌ NO CORS HEADERS FOUND!');
      console.log('\n  This indicates the backend is not sending CORS headers.');
      console.log('  Possible causes:');
      console.log('    1. Backend server not running');
      console.log('    2. Nginx/proxy not forwarding requests to backend');
      console.log('    3. Backend CORS middleware not configured');
      console.log('    4. Environment variables not loaded');
    }

    let data = '';
    res.on('data', chunk => {
      data += chunk;
    });

    res.on('end', () => {
      if (data && testName.includes('Health')) {
        try {
          const json = JSON.parse(data);
          console.log(`  Body:`, json);
        } catch {
          console.log(`  Body (first 200 chars): ${data.substring(0, 200)}`);
        }
      }
    });
  });

  req.on('error', (error) => {
    console.log(`\n✗ ${testName} Error:`);
    console.log(`  ${error.message}`);
  });

  if (body) {
    req.write(body);
  }
  
  req.end();
}

setTimeout(() => {
  console.log('\n' + '═'.repeat(60));
  console.log('\n📋 Diagnosis:\n');
  console.log('If you see "NO CORS HEADERS FOUND":');
  console.log('  1. Check if backend is running: pm2 list');
  console.log('  2. Check backend logs: pm2 logs ecareafrica-backend');
  console.log('  3. Verify .env file has correct CORS_ORIGIN');
  console.log('  4. Restart backend: pm2 restart ecareafrica-backend --update-env\n');
  console.log('If you see CORS headers but wrong origin:');
  console.log('  1. Update CORS_ORIGIN in .env');
  console.log('  2. Restart backend with --update-env flag\n');
  console.log('If you see correct CORS headers:');
  console.log('  ✓ Backend CORS is configured correctly!');
  console.log('  - Check browser console for specific errors');
  console.log('  - Verify frontend is using correct API URL\n');
}, 3000);
