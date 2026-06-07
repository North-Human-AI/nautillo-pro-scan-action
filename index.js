'use strict';

/**
 * Nautillo Pro Security Scan — GitHub Action
 *
 * Pure Node.js (built-ins only). No npm install required.
 * Triggers a Nautillo Pro scan, polls until completion, and exits with
 * the scan's exit_code (0 = pass, 1 = findings at threshold, 2 = error).
 */

const https = require('https');
const fs = require('fs');

/* --------------------------------------------------------------------------
 * GitHub Actions integration helpers
 * -------------------------------------------------------------------------- */

function getInput(name, required) {
  const key = 'INPUT_' + name.replace(/ /g, '_').toUpperCase();
  const val = (process.env[key] || '').trim();
  if (required && !val) {
    console.log(`::error::Input '${name}' is required but was not provided.`);
    process.exit(1);
  }
  return val;
}

function setOutput(name, value) {
  const v = String(value);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${v}\n`);
  } else {
    // Legacy fallback for older GitHub Actions runners
    process.stdout.write(`::set-output name=${name}::${v}\n`);
  }
}

function addJobSummary(markdown) {
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + '\n');
  }
}

function info(msg) {
  console.log(msg);
}

function warn(msg) {
  console.log(`::warning::${msg}`);
}

function fail(msg, exitCode) {
  console.log(`::error::${msg}`);
  process.exit(exitCode !== undefined ? exitCode : 1);
}

/* --------------------------------------------------------------------------
 * HTTP helper — uses only Node.js built-in https module
 * -------------------------------------------------------------------------- */

function jsonRequest(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method,
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, body: raw, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* --------------------------------------------------------------------------
 * Main
 * -------------------------------------------------------------------------- */

async function run() {
  // --- Inputs ---
  const apiKey        = getInput('api-key', true);
  const targetUrl     = getInput('url', true);
  const scanType      = getInput('scan-type') || 'single_url';
  const failOn        = getInput('fail-on') || 'critical';
  const authType      = getInput('auth-type');
  const authToken     = getInput('auth-token');
  const authUser      = getInput('auth-username');
  const authPass      = getInput('auth-password');
  const loginUrl      = getInput('auth-login-url');
  const timeoutSec    = Math.max(60, parseInt(getInput('timeout') || '900', 10));
  const apiBase       = (getInput('api-url') || 'https://api.nautillo.pro/functions/v1').replace(/\/+$/, '');
  const webhookUrl    = getInput('webhook-url');
  const webhookSecret = getInput('webhook-secret');

  const headers = { 'X-API-Key': apiKey };

  // --- Build authentication config ---
  let authentication;
  if (authType === 'bearer' && authToken) {
    authentication = { type: 'bearer', token: authToken };
  } else if (authType === 'basic' && authUser) {
    authentication = { type: 'basic', username: authUser, password: authPass };
  } else if (authType === 'form' && loginUrl && authUser) {
    authentication = { type: 'form', login_url: loginUrl, username: authUser, password: authPass };
  } else if (authType && authType !== '') {
    warn(`auth-type is '${authType}' but required credentials are missing — scanning without authentication.`);
  }

  // --- Build trigger payload ---
  const payload = { target_url: targetUrl, scan_type: scanType, fail_on: failOn };
  if (authentication) payload.authentication = authentication;
  if (webhookUrl) {
    payload.notify_webhook = { url: webhookUrl };
    if (webhookSecret) payload.notify_webhook.secret = webhookSecret;
  }

  // --- Trigger scan ---
  info('');
  info('Nautillo Pro Security Scan');
  info(`  Target:    ${targetUrl}`);
  info(`  Scan type: ${scanType}`);
  info(`  Fail on:   ${failOn}`);
  if (authentication) info(`  Auth:      ${authType}`);

  let triggerRes;
  try {
    triggerRes = await jsonRequest('POST', `${apiBase}/v1-scan-trigger`, headers, payload);
  } catch (e) {
    fail(`Could not reach Nautillo Pro API: ${e.message}`, 2);
  }

  if (triggerRes.status !== 202) {
    const detail =
      typeof triggerRes.body === 'object'
        ? triggerRes.body.message || JSON.stringify(triggerRes.body)
        : String(triggerRes.body);
    fail(`Scan trigger failed (HTTP ${triggerRes.status}): ${detail}`, 2);
  }

  const { scan_id, report_url } = triggerRes.body;
  if (!scan_id) {
    fail(`API did not return a scan_id. Response: ${JSON.stringify(triggerRes.body)}`, 2);
  }

  info(`  Scan ID:   ${scan_id}`);
  info(`  Report:    ${report_url || 'pending'}`);
  setOutput('scan-id', scan_id);
  setOutput('report-url', report_url || '');

  // --- Poll for completion ---
  const POLL_INTERVAL_MS = 20_000;
  const deadline = Date.now() + timeoutSec * 1_000;
  let lastStatus = '';
  let nextPollMs = POLL_INTERVAL_MS;
  let backoffMs = 60_000;

  info(`\nWaiting for scan to complete (timeout: ${timeoutSec}s)…`);

  while (Date.now() < deadline) {
    await sleep(nextPollMs);
    nextPollMs = POLL_INTERVAL_MS;

    let pollRes;
    try {
      pollRes = await jsonRequest(
        'GET',
        `${apiBase}/v1-scan-status?scan_id=${encodeURIComponent(scan_id)}`,
        headers
      );
    } catch (e) {
      warn(`Poll request failed: ${e.message} — retrying`);
      continue;
    }

    if (pollRes.status === 429) {
      const retryAfter = parseInt(((pollRes.headers || {})['retry-after'] || '0'), 10);
      nextPollMs = retryAfter > 0 ? retryAfter * 1_000 : backoffMs;
      backoffMs = Math.min(backoffMs * 2, 300_000);
      warn(`Rate limited (HTTP 429) — retrying in ${Math.round(nextPollMs / 1000)}s`);
      continue;
    }

    backoffMs = 60_000; // reset backoff on successful response

    if (pollRes.status !== 200) {
      warn(`Unexpected poll response (HTTP ${pollRes.status}) — retrying`);
      continue;
    }

    const result = pollRes.body;
    if (result.status && result.status !== lastStatus) {
      info(`  ${new Date().toISOString().slice(11, 19)}  ${result.status}`);
      lastStatus = result.status;
    }

    if (
      result.status === 'completed' ||
      result.status === 'failed' ||
      result.status === 'timeout'
    ) {
      const fc = result.findings_count || {};
      const exitCode =
        result.exit_code !== null && result.exit_code !== undefined
          ? result.exit_code
          : 2;

      // Set all outputs
      setOutput('exit-code', exitCode);
      setOutput('status', exitCode === 0 ? 'passed' : exitCode === 1 ? 'failed' : 'error');
      setOutput('critical', fc.critical != null ? fc.critical : 0);
      setOutput('high',     fc.high     != null ? fc.high     : 0);
      setOutput('medium',   fc.medium   != null ? fc.medium   : 0);
      setOutput('low',      fc.low      != null ? fc.low      : 0);
      setOutput('findings-json', JSON.stringify(fc));

      // Job summary (shown in GitHub Actions UI)
      const summaryLines = [
        '## Nautillo Pro Security Scan',
        '',
        `| | |`,
        `|---|---|`,
        `| **Target** | ${targetUrl} |`,
        `| **Status** | ${result.status} |`,
        `| **Report** | [View full report](${report_url || ''}) |`,
        '',
        '### Findings',
        '',
        '| Severity | Confirmed |',
        '|----------|-----------|',
        `| 🔴 Critical | ${fc.critical ?? 0} |`,
        `| 🟠 High     | ${fc.high     ?? 0} |`,
        `| 🟡 Medium   | ${fc.medium   ?? 0} |`,
        `| 🔵 Low      | ${fc.low      ?? 0} |`,
        '',
      ];
      addJobSummary(summaryLines.join('\n'));

      if (result.status === 'failed') {
        fail(
          `Scan encountered an internal error. Check the report for details: ${report_url || scan_id}`,
          2
        );
      }

      if (result.status === 'timeout') {
        fail(
          `Scan timed out on the server side. Check partial results: ${report_url || scan_id}`,
          2
        );
      }

      // status === 'completed'
      info('');
      info('Scan complete');
      info(`  Critical: ${fc.critical ?? 0}  High: ${fc.high ?? 0}  Medium: ${fc.medium ?? 0}  Low: ${fc.low ?? 0}`);
      info(`  Report:   ${report_url}`);

      if (exitCode === 1) {
        console.log(
          `::error::Confirmed vulnerabilities at or above '${failOn}' threshold. See: ${report_url}`
        );
        process.exit(1);
      }

      info(`\nNo confirmed findings at or above '${failOn}' threshold. Build passes.`);
      return; // exit 0 (process continues to natural end)
    }
  }

  // Client-side timeout
  setOutput('exit-code', 2);
  setOutput('status', 'timeout');
  fail(
    `Scan did not complete within ${timeoutSec}s. ` +
    `Check status: ${apiBase}/v1-scan-status?scan_id=${scan_id}`,
    2
  );
}

run().catch((e) => {
  console.log(`::error::Unexpected error: ${e.message}\n${e.stack || ''}`);
  process.exit(2);
});
