# Nautillo Pro Security Scan

Automated penetration testing (DAST) in your CI/CD pipeline. Triggers a [Nautillo Pro](https://nautillo.pro) scan, waits for results, and fails the build when confirmed vulnerabilities are found at or above your chosen severity. Every finding comes with proof: the exact request and response.

- **No curl, no polling scripts** — single `uses:` step
- **Proof for every finding** — confirmed exploit paths with the request and response, not theoretical findings
- **Structured outputs** — use finding counts in downstream steps
- **Zero dependencies** — pure Node.js, no `npm install`

## Requirements

This action requires a **paid Nautillo Pro plan**. CI/CD API access is not available on the free Starter plan.

| Plan | CI/CD API access | Scan types available |
|---|---|---|
| Starter (Free) | Not available | — |
| Professional (€69/mo) | 5,000 API triggers per day | `single_url` and `full_domain` (4/month, up to 1,000 pages) |
| Business (€149/mo) | Unlimited API triggers | `single_url` and `full_domain` (30/month, up to 5,000 pages) |

To upgrade, go to [nautillo.pro/pricing](https://nautillo.pro/pricing) and select Professional or Business.

## Getting started

### 1. Create a Nautillo Pro account

Sign up at [nautillo.pro](https://nautillo.pro). Start on the free Starter plan to explore the dashboard, then upgrade to Professional or Business to enable CI/CD access.

### 2. Verify your domain

CI/CD scans run unattended, so the target's domain must be verified in your account. In the dashboard, go to **Settings → Domains**, add the domain you want to scan, and verify it with a DNS TXT record. Scans of unverified domains are rejected with `403 Domain is not verified`.

### 3. Generate an API key

In the dashboard, go to **Settings → API Keys → Generate new key**. Copy the key — you will only see it once.

### 4. Add the key to your GitHub repository

1. Open your repository on GitHub
2. Go to **Settings → Secrets and variables → Actions**
3. Click **New repository secret**
4. Name: `NAUTILLO_API_KEY`
5. Value: paste your API key
6. Click **Add secret**

### 5. Add the workflow step

```yaml
- name: Security scan
  uses: North-Human-AI/nautillo-pro-scan-action@v1
  with:
    api-key: ${{ secrets.NAUTILLO_API_KEY }}
    url: https://your-app.com
```

The action will trigger a scan, wait for results, and fail the build if confirmed vulnerabilities are found at or above the `fail-on` threshold (default: `critical`).

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `api-key` | Yes | — | Nautillo Pro API key. Store as a repository secret. |
| `url` | Yes | — | Target URL to scan. Its domain must be verified in your account. |
| `scan-type` | No | `single_url` | `single_url` or `full_domain`. `full_domain` is available on **Professional** (4/month, up to 1,000 pages) and **Business** (30/month, up to 5,000 pages). |
| `fail-on` | No | `critical` | Minimum severity that fails the build: `critical`, `high`, `medium`, `low`, or `none`. |
| `timeout` | No | `900` | Seconds to wait for the result, or `auto` to wait while the scan keeps progressing (up to 5h 45m). See [Long-running scans](#long-running-full-domain-scans). |
| `wait` | No | `true` | `false` starts the scan and finishes the job immediately — for scheduled `full_domain` scans. |
| `auth-type` | No | — | Authentication method for protected pages: `bearer`, `basic`, or `form`. |
| `auth-token` | No | — | Bearer token (when `auth-type` is `bearer`). Store as a secret. |
| `auth-username` | No | — | Username (when `auth-type` is `basic` or `form`). Store as a secret. |
| `auth-password` | No | — | Password (when `auth-type` is `basic` or `form`). Store as a secret. |
| `auth-login-url` | No | — | Login form URL (when `auth-type` is `form`). |
| `webhook-url` | No | — | Webhook URL to receive a signed POST when the scan completes. |
| `webhook-secret` | No | — | HMAC secret for webhook signature verification. |
| `api-url` | No | `https://api.nautillo.pro/functions/v1` | Override the API base URL. Leave as default unless directed by support. |

## Outputs

| Output | Description |
|---|---|
| `scan-id` | UUID of the triggered scan. |
| `report-url` | URL to the full scan report on nautillo.pro. |
| `status` | Scan outcome: `passed`, `failed`, `error`, `timeout`, or `started` (with `wait: false`). |
| `exit-code` | `0` = no findings at threshold, `1` = findings found, `2` = scan error or timeout. |
| `critical` | Number of confirmed Critical severity findings. |
| `high` | Number of confirmed High severity findings. |
| `medium` | Number of confirmed Medium severity findings. |
| `low` | Number of confirmed Low severity findings. |
| `findings-json` | JSON object with all counts: `{"critical":0,"high":2,"medium":3,"low":1}` |

## Examples

### Fail on critical findings (default)

```yaml
steps:
  - name: Security scan
    uses: North-Human-AI/nautillo-pro-scan-action@v1
    with:
      api-key: ${{ secrets.NAUTILLO_API_KEY }}
      url: https://staging.your-app.com
```

### Use outputs in later steps

```yaml
steps:
  - name: Security scan
    id: scan
    uses: North-Human-AI/nautillo-pro-scan-action@v1
    with:
      api-key: ${{ secrets.NAUTILLO_API_KEY }}
      url: https://staging.your-app.com
      fail-on: high

  - name: Post report link
    if: always()
    run: echo "Report ${{ steps.scan.outputs.report-url }}"
```

### Authenticated scanning (form login)

```yaml
steps:
  - name: Security scan (authenticated)
    uses: North-Human-AI/nautillo-pro-scan-action@v1
    with:
      api-key: ${{ secrets.NAUTILLO_API_KEY }}
      url: https://staging.your-app.com
      auth-type: form
      auth-login-url: https://staging.your-app.com/login
      auth-username: ${{ secrets.SCAN_TEST_EMAIL }}
      auth-password: ${{ secrets.SCAN_TEST_PASSWORD }}
```

### Full domain scan (Professional or Business)

```yaml
steps:
  - name: Full domain security scan
    uses: North-Human-AI/nautillo-pro-scan-action@v1
    with:
      api-key: ${{ secrets.NAUTILLO_API_KEY }}
      url: https://your-app.com
      scan-type: full_domain
      fail-on: high
      timeout: 'auto'
```

### Long-running full domain scans

`full_domain` scans test every discovered page and can take **from under an hour to several hours**, depending on the size of the site. While waiting, the action prints progress and an estimated time left:

```
  02:14:05  820 of 2,400 tests (34%) · about 55m left
```

Pick how the job should wait:

| Option | When to use |
|---|---|
| `wait: 'false'` | **Recommended for scheduled full-domain scans.** Starts the scan and finishes the job in seconds. Results appear in the report, your dashboard and your webhook. |
| `timeout: 'auto'` | Wait as long as the scan keeps progressing (up to 5h 45m, just under GitHub's 6-hour job limit). The server stops scans that make no progress for 20 minutes. |
| `timeout: '<seconds>'` | A fixed wait. If the estimate shows the scan won't finish in time, the action warns you. The scan keeps running on the server either way. |

**Recommended setup — gate every deploy with a quick scan, run the full domain on a schedule:**

```yaml
# .github/workflows/security-scan.yml — every push: minutes, blocks the build on findings
on:
  push:
    branches: [main]
jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: North-Human-AI/nautillo-pro-scan-action@v1
        with:
          api-key: ${{ secrets.NAUTILLO_API_KEY }}
          url: https://staging.your-app.com
          fail-on: high
```

```yaml
# .github/workflows/security-scan-full.yml — full domain on a schedule
on:
  schedule:
    - cron: '0 2 * * 0'     # weekly, Sundays 02:00 UTC
    # - cron: '0 2 * * *'   # daily   (Business)
    # - cron: '0 2 1 * *'   # monthly
  workflow_dispatch:
jobs:
  full-domain-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: North-Human-AI/nautillo-pro-scan-action@v1
        with:
          api-key: ${{ secrets.NAUTILLO_API_KEY }}
          url: https://your-app.com
          scan-type: full_domain
          wait: 'false'
          webhook-url: ${{ secrets.SCAN_WEBHOOK_URL }}
          webhook-secret: ${{ secrets.SCAN_WEBHOOK_SECRET }}
```

Full-domain scans count toward your plan's monthly allowance (Professional: 4, Business: 30), so choose a schedule that fits — weekly or monthly on Professional, up to daily on Business.

**Webhook payload:** the POST body contains `scan_id`, `status`, `exit_code`, `findings_count` and `report_url`. Verify the signature using the `X-Nautillo-Signature` header (HMAC-SHA256 of the raw body with your `webhook-secret`).

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Scan completed — no confirmed findings at or above the `fail-on` threshold |
| `1` | Scan completed — confirmed findings found at or above the `fail-on` threshold |
| `2` | Scan error, internal failure, or timeout |

## Exit code 2: common causes

| Message | Fix |
|---|---|
| `Domain "…" is not verified` | Verify the domain in **Settings → Domains** (see step 2). |
| `Daily rate limit reached` | Professional allows 5,000 triggers per API key per 24 hours. |
| `target_url must be a publicly reachable host` | Private IPs, `localhost` and internal hosts can't be scanned — use a public staging or preview URL. |

## License

[MIT](LICENSE) © NØRTH HŪMAN OÜ
