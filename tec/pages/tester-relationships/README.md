# 2026 Nov · Tester relationships

Static board for Ivan Chan’s DEV1 Tester tickets (sprint **2026 Nov**), hosted inside the existing site repo `ivanchan-dev/ivanchan-dev.github.io` and served at:

**https://pages.ichkdev.com/tec/pages/tester-relationships/**

Data is refreshed by GitHub Actions into `data/tickets.json`. The browser only loads that JSON — **no Atlassian token ever ships to the client**.

## Layout in the site repo

```
tec/pages/tester-relationships/
  index.html
  app.js
  styles.css
  data/tickets.json
  JIRA_DOMAIN.md
  README.md
  pages.json.entry.json   # fragment to merge into the site nav
scripts/fetch-jira-tester-relationships.mjs
.github/workflows/refresh-jira-tester-relationships.yml
```

Copy these paths into the GitHub Pages repo root (merge; do not replace the whole site).

## Merge into `pages.json`

Add (or merge) this entry into the site’s `pages.json` (or equivalent nav catalogue):

```json
{
  "path": "tec/pages/tester-relationships/index.html",
  "label": "2026 Nov Tester relationships"
}
```

A copy of that object lives beside this README as `pages.json.entry.json`.

If `pages.json` is an array:

```json
[
  …existing entries…,
  {
    "path": "tec/pages/tester-relationships/index.html",
    "label": "2026 Nov Tester relationships"
  }
]
```

## Enable / verify Pages

This folder assumes the repo already publishes from **branch `main`**, **site root `/`** (custom domain `pages.ichkdev.com`). No project-site `docs/` or `/tec` base-href rewrite is required — asset paths are relative (`./app.js`, `./data/tickets.json`).

After the first push, open:

`https://pages.ichkdev.com/tec/pages/tester-relationships/`

## GitHub Actions secrets

Repo → Settings → Secrets and variables → Actions:

| Secret | Purpose |
|--------|---------|
| `JIRA_EMAIL` | Atlassian account email used for API Basic auth |
| `JIRA_API_TOKEN` | [Atlassian API token](https://id.atlassian.com/manage-profile/security/api-tokens) |

Optional env overrides (workflow defaults are fine): `JIRA_BASE_URL`, `JIRA_SPRINT_ID`, `IVAN_ACCOUNT_ID`.

**Never** commit tokens, put them in `tickets.json`, or reference them from `app.js`.

## Manual refresh

Actions → **Refresh Jira Tester relationships** → **Run workflow**.

Or locally (from the site repo root), with env vars set:

```bash
export JIRA_EMAIL='you@example.com'
export JIRA_API_TOKEN='…'
node scripts/fetch-jira-tester-relationships.mjs
```

The script writes `tec/pages/tester-relationships/data/tickets.json`.

## Local preview

Because the page `fetch`es JSON, open via HTTP — not `file://`:

```bash
# from the GitHub Pages repo root (or this scaffold root)
python3 -m http.server 8080
# then visit http://127.0.0.1:8080/tec/pages/tester-relationships/
```

## UI behaviour

- **Cluster filter:** All / Member Data / AskNicely / AI / Standalone. AskNicely includes `asknicely-epic-peers` (epic `DEV1-2` peers not linked to hub `DEV1-2737`).
- **Status filter:** Open only (hides `statusCategory === Done`) vs Include Done.
- **Trees:** Parent-Child / subtask nests for Member Data (`DEV1-2709`), AskNicely (`DEV1-2737`), AI (via `DEV1-2379` when present).
- **UAT callout:** any ticket whose status matches UAT, Ready for UAT, or Ready for deployment (derived from data, not hardcoded keys).
- **Display line:** `{Type} {Key} ({browseUrl}) - {Name} · {Assignee} · {Tester} · Report to {Reporter}`

## Domain notes

See `JIRA_DOMAIN.md` for JQL, field IDs, hub seeds, and cluster rules (from Jiro).

## Schedule

Workflow cron: every 30 minutes + `workflow_dispatch`. Commits only when `tickets.json` changes (`github-actions[bot]`).
