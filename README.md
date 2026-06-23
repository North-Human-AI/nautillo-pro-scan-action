# Nautillo Pro Security Scan

Automated web application security testing for your CI/CD pipeline. Triggers a [Nautillo Pro](https://nautillo.pro) scan, waits for results, and fails the build when confirmed vulnerabilities are found above your chosen severity threshold.

- **No curl, no polling scripts** — single `uses:` step
- **Confirmed exploit paths only** — not theoretical findings
- **Structured outputs** — use finding counts in downstream steps
- **Zero dependencies** — pure Node.js, no `npm install`

## Requirements

This action requires a **paid Nautillo Pro plan**. CI/CD API access is not available on the free Starter plan.

| Plan | CI/CD API access | Scan types available |
|---|---|---|
| Starter (Free) | Not available | — |
| Professional (€69/mo) | 5,000 API triggers per day | `single_url` and `full_domain` (4/month, up to 500 pages) |
| Business (€149/mo) | Unlimited API triggers | `single_url` and `full_domain` (30/month, up to 2,000 pages) |

To upgrade, go to [nautillo.pro/pricing](https://nautillo.pro/pricing) and select Professional or Business.

## Getting started

### 1. Create a Nautillo Pro account

Sign up at [nautillo.pro](https://nautillo.pro). Start on the free Starter plan to explore the dashboard, then upgrade to Professional or Business to enable CI/CD access.

### 2. Generate an API key

In the dashboard, go to **Settings → API Keys → Generate new key**. Copy the key — you will only see it once.

### 3. Add the key to your GitHub repository

1. Open your repository on GitHub
2. Go to **Settings → Secrets and variables → Actions**
3. Click **New repository secret**
4. Name: `NAUTILLO_API_KEY`
5. Value: paste your API key
6. Click **Add secret**

### 4. Add the workflow step

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
| `url` | Yes | — | Target URL to scan. |
| `scan-type` | No | `single_url` | `single_url` or `full_domain`. `full_domain` is available on **Professional** (4/month, up to 500 pages) and **Business** (30/month, up to 2,000 pages). |
| `fail-on` | No | `critical` | Minimum severity that fails the build: `critical`, `high`, `medium`, `low`, or `none`. |
| `timeout` | No | `900` | Seconds to wait before the action times out. Use `3600` for full domain scans. |
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
| `status` | Scan outcome: `passed`, `failed`, or `error`. |
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
      timeout: '3600'
```

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Scan completed — no confirmed findings at or above the `fail-on` threshold |
| `1` | Scan completed — confirmed findings found at or above the `fail-on` threshold |
| `2` | Scan error, internal failure, or timeout |

## License

MIT
