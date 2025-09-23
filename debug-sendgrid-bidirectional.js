#!/usr/bin/env node

import https from 'https';
import http from 'http';
import querystring from 'querystring';
import dns from 'dns';
import { promisify } from 'util';
import net from 'net';

const resolveMx = promisify(dns.resolveMx);
const resolveTxt = promisify(dns.resolveTxt);

console.log('\n🔍 SENDGRID BIDIRECTIONAL SYNC DEBUGGING TOOL');
console.log('=' .repeat(60));

const args = process.argv.slice(2);
const command = args[0] || 'all';

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

async function checkDNSConfiguration() {
  console.log(`\n${colors.cyan}📡 CHECKING DNS CONFIGURATION${colors.reset}`);
  console.log('-'.repeat(40));

  try {
    // Check MX records
    console.log('\n1. MX Records for reply.cimshare.com:');
    const mxRecords = await resolveMx('reply.cimshare.com');

    const expectedMX = [
      { exchange: 'mx.sendgrid.net', priority: 10 },
      { exchange: 'mx2.sendgrid.net', priority: 20 },
      { exchange: 'mx3.sendgrid.net', priority: 30 }
    ];

    let mxCorrect = true;
    mxRecords.forEach(record => {
      const expected = expectedMX.find(e => e.exchange === record.exchange);
      const status = expected && expected.priority === record.priority;
      console.log(`   ${status ? colors.green + '✓' : colors.red + '✗'} ${record.priority} ${record.exchange}${colors.reset}`);
      if (!status) mxCorrect = false;
    });

    if (mxCorrect) {
      console.log(`   ${colors.green}✓ MX records are configured correctly${colors.reset}`);
    } else {
      console.log(`   ${colors.red}✗ MX records may need adjustment${colors.reset}`);
    }

    // Check TXT records for SPF/DKIM
    console.log('\n2. TXT Records (SPF/DKIM):');
    try {
      const txtRecords = await resolveTxt('reply.cimshare.com');
      txtRecords.forEach(record => {
        const txt = record.join('');
        if (txt.includes('v=spf1')) {
          console.log(`   ${colors.green}✓ SPF record found: ${txt.substring(0, 50)}...${colors.reset}`);
        }
      });
    } catch (e) {
      console.log(`   ${colors.yellow}⚠ No TXT records found (SPF might be on parent domain)${colors.reset}`);
    }

  } catch (error) {
    console.log(`   ${colors.red}✗ DNS lookup failed: ${error.message}${colors.reset}`);
  }
}

async function testWebhookEndpoint() {
  console.log(`\n${colors.cyan}🎯 TESTING WEBHOOK ENDPOINT${colors.reset}`);
  console.log('-'.repeat(40));

  const endpoints = [
    { name: 'Info Endpoint', method: 'GET', path: '/api/webhook/sendgrid/info' },
    { name: 'Test Endpoint', method: 'POST', path: '/api/webhook/sendgrid/test' },
    { name: 'Inbound Endpoint', method: 'POST', path: '/api/webhook/sendgrid/inbound' }
  ];

  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }
}

async function testEndpoint(endpoint) {
  return new Promise((resolve) => {
    console.log(`\nTesting ${endpoint.name}:`);
    console.log(`   URL: https://cimshare.com${endpoint.path}`);

    const testData = endpoint.method === 'POST' ? {
      to: 'thread-test123@reply.cimshare.com',
      from: 'debugger@test.com',
      subject: 'Debug Test',
      text: 'Testing webhook connectivity',
      envelope: JSON.stringify({
        to: ['thread-test123@reply.cimshare.com'],
        from: 'debugger@test.com'
      })
    } : null;

    const postData = testData ? (
      endpoint.path.includes('inbound') ?
        querystring.stringify(testData) :
        JSON.stringify(testData)
    ) : '';

    const options = {
      hostname: 'cimshare.com',
      path: endpoint.path,
      method: endpoint.method,
      headers: endpoint.method === 'POST' ? {
        'Content-Type': endpoint.path.includes('inbound') ?
          'application/x-www-form-urlencoded' :
          'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'SendGrid-Debug-Tool'
      } : {}
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`   ${colors.green}✓ Status: ${res.statusCode} - Endpoint is accessible${colors.reset}`);
          if (endpoint.method === 'GET' && data) {
            try {
              const parsed = JSON.parse(data);
              console.log(`   ${colors.blue}Response: ${JSON.stringify(parsed, null, 2).substring(0, 200)}...${colors.reset}`);
            } catch (e) {
              console.log(`   Response: ${data.substring(0, 100)}...`);
            }
          }
        } else {
          console.log(`   ${colors.yellow}⚠ Status: ${res.statusCode} - ${res.statusMessage}${colors.reset}`);
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      console.log(`   ${colors.red}✗ Connection failed: ${e.message}${colors.reset}`);
      resolve();
    });

    if (endpoint.method === 'POST') {
      req.write(postData);
    }
    req.end();
  });
}

async function testSendGridConnectivity() {
  console.log(`\n${colors.cyan}🌐 TESTING SENDGRID SERVER CONNECTIVITY${colors.reset}`);
  console.log('-'.repeat(40));

  const sendgridServers = [
    { host: 'mx.sendgrid.net', port: 25 },
    { host: 'mx2.sendgrid.net', port: 25 },
    { host: 'mx3.sendgrid.net', port: 25 }
  ];

  for (const server of sendgridServers) {
    await new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        console.log(`   ${colors.yellow}⚠ ${server.host}:${server.port} - Connection timeout${colors.reset}`);
        resolve();
      }, 5000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        console.log(`   ${colors.green}✓ ${server.host}:${server.port} - Reachable${colors.reset}`);
        socket.destroy();
        resolve();
      });

      socket.on('error', (err) => {
        clearTimeout(timeout);
        console.log(`   ${colors.red}✗ ${server.host}:${server.port} - ${err.message}${colors.reset}`);
        resolve();
      });

      socket.connect(server.port, server.host);
    });
  }
}

async function simulateSendGridWebhook() {
  console.log(`\n${colors.cyan}📮 SIMULATING SENDGRID WEBHOOK${colors.reset}`);
  console.log('-'.repeat(40));

  const threadId = args[1] || 'test123';

  // Simulate different scenarios
  const scenarios = [
    {
      name: 'Standard Email Reply',
      data: {
        to: `thread-${threadId}@reply.cimshare.com`,
        from: 'john.doe@example.com',
        subject: 'Re: Your inquiry',
        text: 'This is my response to your inquiry.',
        html: '<p>This is my <b>response</b> to your inquiry.</p>',
        envelope: JSON.stringify({
          to: [`thread-${threadId}@reply.cimshare.com`],
          from: 'john.doe@example.com'
        })
      }
    },
    {
      name: 'Multiple Recipients (CC)',
      data: {
        to: `thread-${threadId}@reply.cimshare.com, other@example.com`,
        from: 'jane.smith@example.com',
        subject: 'Follow up question',
        text: 'I have another question about the CIM.',
        envelope: JSON.stringify({
          to: [`thread-${threadId}@reply.cimshare.com`, 'other@example.com'],
          from: 'jane.smith@example.com'
        })
      }
    },
    {
      name: 'Email with Attachments',
      data: {
        to: `thread-${threadId}@reply.cimshare.com`,
        from: 'bob@company.com',
        subject: 'Documents attached',
        text: 'Please find the requested documents attached.',
        attachments: JSON.stringify([
          { filename: 'document.pdf', content: 'base64content...' }
        ]),
        envelope: JSON.stringify({
          to: [`thread-${threadId}@reply.cimshare.com`],
          from: 'bob@company.com'
        })
      }
    }
  ];

  console.log('\nSelect scenario to test:');
  scenarios.forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.name}`);
  });

  const scenarioIndex = parseInt(args[2]) || 1;
  const scenario = scenarios[scenarioIndex - 1] || scenarios[0];

  console.log(`\nTesting: ${colors.magenta}${scenario.name}${colors.reset}`);
  console.log('Payload:', JSON.stringify(scenario.data, null, 2).substring(0, 300) + '...\n');

  const postData = querystring.stringify(scenario.data);

  return new Promise((resolve) => {
    const options = {
      hostname: 'cimshare.com',
      path: '/api/webhook/sendgrid/inbound',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'SendGrid/Event-Webhook'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`${colors.green}✅ Webhook accepted successfully${colors.reset}`);
        } else {
          console.log(`${colors.red}✗ Webhook returned status ${res.statusCode}${colors.reset}`);
          console.log('Response:', data);
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      console.log(`${colors.red}✗ Request failed: ${e.message}${colors.reset}`);
      resolve();
    });

    req.write(postData);
    req.end();
  });
}

async function checkConfiguration() {
  console.log(`\n${colors.cyan}📋 CONFIGURATION CHECKLIST${colors.reset}`);
  console.log('-'.repeat(40));

  const checks = [
    {
      category: 'SendGrid Settings',
      items: [
        { name: 'Inbound Parse configured', check: 'https://app.sendgrid.com/settings/parse' },
        { name: 'Hostname set to: reply.cimshare.com', check: 'Verify in SendGrid dashboard' },
        { name: 'URL set to: https://cimshare.com/api/webhook/sendgrid/inbound', check: 'Verify in SendGrid dashboard' },
        { name: 'POST raw MIME: UNCHECKED', check: 'Should be OFF for form-data' },
        { name: 'Check incoming email activity', check: 'Check activity feed' }
      ]
    },
    {
      category: 'Application Code',
      items: [
        { name: 'Webhook endpoint registered', check: '/api/webhook/sendgrid/inbound' },
        { name: 'Content-Type handling: form-urlencoded', check: 'express.raw({ type: "*/*" })' },
        { name: 'Thread ID extraction regex', check: '/thread-([a-z0-9]+)@/' },
        { name: 'Reply-To headers in outbound emails', check: 'thread-xxx@reply.cimshare.com' },
        { name: 'Database thread email storage', check: 'threadEmailAddress field' }
      ]
    },
    {
      category: 'Testing Steps',
      items: [
        { name: 'Send test email to thread-xxx@reply.cimshare.com', check: 'Use real email client' },
        { name: 'Check server logs for webhook hits', check: 'Monitor console output' },
        { name: 'Verify message appears in database', check: 'Check messages table' },
        { name: 'Test bidirectional flow', check: 'Reply from message center' }
      ]
    }
  ];

  checks.forEach(section => {
    console.log(`\n${colors.yellow}${section.category}:${colors.reset}`);
    section.items.forEach(item => {
      console.log(`   ☐ ${item.name}`);
      console.log(`     ${colors.cyan}→ ${item.check}${colors.reset}`);
    });
  });
}

async function runAllTests() {
  await checkDNSConfiguration();
  await testWebhookEndpoint();
  await testSendGridConnectivity();
  await checkConfiguration();

  console.log(`\n${colors.cyan}📝 SUMMARY${colors.reset}`);
  console.log('-'.repeat(40));
  console.log('\n1. If MX records are correct but emails aren\'t arriving:');
  console.log('   - Check SendGrid Activity Feed for incoming emails');
  console.log('   - Verify SendGrid Inbound Parse is active');
  console.log('   - Check spam filters aren\'t blocking emails\n');

  console.log('2. If webhooks aren\'t being received:');
  console.log('   - Verify SendGrid has the correct webhook URL');
  console.log('   - Check server logs for any incoming requests');
  console.log('   - Test with the simulation tool (node debug-sendgrid-bidirectional.js simulate)\n');

  console.log('3. To test end-to-end:');
  console.log('   - Get a thread ID from your database');
  console.log('   - Send email to thread-[ID]@reply.cimshare.com');
  console.log('   - Monitor server logs in real-time');
  console.log('   - Check database for new messages\n');
}

// Main execution
(async () => {
  try {
    switch(command) {
      case 'dns':
        await checkDNSConfiguration();
        break;
      case 'webhook':
        await testWebhookEndpoint();
        break;
      case 'sendgrid':
        await testSendGridConnectivity();
        break;
      case 'simulate':
        await simulateSendGridWebhook();
        break;
      case 'config':
        await checkConfiguration();
        break;
      case 'all':
      default:
        await runAllTests();
        break;
    }

    console.log(`\n${colors.green}✓ Debugging complete${colors.reset}\n`);
  } catch (error) {
    console.error(`\n${colors.red}✗ Error: ${error.message}${colors.reset}\n`);
    process.exit(1);
  }
})();