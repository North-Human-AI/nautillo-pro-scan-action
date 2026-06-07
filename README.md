# Nautillo Pro Security Scan

Automated web application security testing for your CI/CD pipeline. Triggers a [Nautillo Pro](https://nautillo.pro) scan, waits for results, and fails the build when confirmed vulnerabilities are found above your chosen severity threshold.

- **No curl, no polling scripts** — single `uses:` step
- **Confirmed exploit paths only** — not theoretical findings
- **Structured outputs** — use finding counts in downstream steps
- **Zero dependencies** — pure Node.js, no `npm install`

## Usage

```yaml
- name: Security scan
  uses: North-Human-AI/nautillo-pro-scan-action@v1
  with:
    api-key: ${{ secrets.NAUTILLO_API_KEY }}
    url: https://your-app.com
```

> **Requires a Nautillo Pro account and API key.** Sign up at [nautillo.pro](https://nautillo.pro).

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `api-key` | Yes | — | Nautillo Pro API key. Store as a repository secret. |
| `url` | Yes | — | Target URL to scan. Must match a verified domain in your account. |
| `scan-type` | No | `single_url` | `single_url` or `full_domain`. Full domain crawls up to 2,000 pages (Business plan). |
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

### Full domain scan (Business plan)

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
