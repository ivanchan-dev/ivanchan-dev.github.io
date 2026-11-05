#!/usr/bin/env node
/**
 * Fetch Ivan Chan Tester tickets for the 2026 Nov board and write
 * tec/pages/tester-relationships/tickets.json
 *
 * Auth via env only (GitHub Actions secrets). Zero npm dependencies.
 */
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const OUT_PATH = path.join(
  REPO_ROOT,
  "tec/pages/tester-relationships/tickets.json"
);

const JIRA_BASE_URL = (process.env.JIRA_BASE_URL || "https://executivecentre.atlassian.net").replace(/\/$/, "");
const JIRA_EMAIL = process.env.JIRA_EMAIL || "";
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || "";
const JIRA_SPRINT_ID = Number(process.env.JIRA_SPRINT_ID || 3326);
const IVAN_ACCOUNT_ID =
  process.env.IVAN_ACCOUNT_ID || "712020:9556c036-6acf-4d45-bf4f-b39fbbca9aa4";

const FIELDS = [
  "summary",
  "issuetype",
  "status",
  "assignee",
  "reporter",
  "parent",
  "subtasks",
  "issuelinks",
  "customfield_11310",
  "customfield_10016",
  "customfield_10020",
].join(",");

const HUB_SEEDS = ["DEV1-2709", "DEV1-2737", "DEV1-2766", "DEV1-2745"];
const MEMBER_HUB = "DEV1-2709";
const ASKN_HUB = "DEV1-2737";
const MEMBER_EPIC = "DEV1-2339";
const ASKN_EPIC = "DEV1-2";
const AI_EPIC = "DEV1-1321";

if (!JIRA_EMAIL || !JIRA_API_TOKEN) {
  console.error("Missing JIRA_EMAIL or JIRA_API_TOKEN env vars.");
  process.exit(1);
}

const AUTH = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function requestJson(method, urlPath, query) {
  const url = new URL(urlPath, JIRA_BASE_URL);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${AUTH}`,
          "Content-Type": "application/json",
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", async () => {
          const body = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode === 429) {
            const retryAfter = Number(res.headers["retry-after"] || 5);
            console.warn(`429 rate limited; waiting ${retryAfter}s`);
            await sleep(retryAfter * 1000);
            try {
              resolve(await requestJson(method, urlPath, query));
            } catch (e) {
              reject(e);
            }
            return;
          }
          if (res.statusCode && res.statusCode >= 400) {
            reject(
              new Error(
                `Jira ${res.statusCode} ${url.pathname}: ${body.slice(0, 500)}`
              )
            );
            return;
          }
          try {
            resolve(body ? JSON.parse(body) : {});
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function searchAll(jql) {
  const issues = [];
  let startAt = 0;
  const maxResults = 100;
  for (;;) {
    let page;
    try {
      page = await requestJson("GET", "/rest/api/3/search", {
        jql,
        startAt,
        maxResults,
        fields: FIELDS,
      });
    } catch (err) {
      // Fallback to enhanced search if classic path is disabled
      console.warn(`Classic search failed (${err.message}); trying /search/jql`);
      page = await searchJqlEnhanced(jql);
      return page;
    }
    const batch = page.issues || [];
    issues.push(...batch);
    const total = page.total ?? issues.length;
    startAt += batch.length;
    if (!batch.length || startAt >= total) break;
  }
  return issues;
}

async function searchJqlEnhanced(jql) {
  const issues = [];
  let nextPageToken = undefined;
  for (;;) {
    const query = { jql, maxResults: 100, fields: FIELDS };
    if (nextPageToken) query.nextPageToken = nextPageToken;
    const page = await requestJson("GET", "/rest/api/3/search/jql", query);
    const batch = page.issues || [];
    issues.push(...batch);
    if (!page.nextPageToken || !batch.length) break;
    nextPageToken = page.nextPageToken;
  }
  return issues;
}

async function getIssue(key) {
  return requestJson("GET", `/rest/api/3/issue/${encodeURIComponent(key)}`, {
    fields: FIELDS,
  });
}

function userName(user) {
  if (!user) return null;
  return user.displayName || user.emailAddress || null;
}

function userId(user) {
  if (!user) return null;
  return user.accountId || null;
}

function statusCategoryName(status) {
  return status?.statusCategory?.name || status?.statusCategory?.key || null;
}

function epicKeyOf(issue) {
  const f = issue.fields || {};
  if (f.customfield_10016) return f.customfield_10016;
  if (f.parent?.fields?.issuetype?.name === "Epic") return f.parent.key;
  if (f.parent?.key && /epic/i.test(f.parent?.fields?.issuetype?.name || "")) {
    return f.parent.key;
  }
  return f.parent?.key || null;
}

function parentChildRelations(issue) {
  const children = [];
  const parents = [];
  for (const link of issue.fields?.issuelinks || []) {
    const typeName = link.type?.name || "";
    if (typeName !== "Parent-Child") continue;
    if (link.outwardIssue?.key) children.push(link.outwardIssue.key);
    if (link.inwardIssue?.key) parents.push(link.inwardIssue.key);
  }
  return { children, parents };
}

function subtaskKeys(issue) {
  return (issue.fields?.subtasks || []).map((s) => s.key).filter(Boolean);
}

function inSprint(issue, sprintId) {
  const sprints = issue.fields?.customfield_10020;
  if (!Array.isArray(sprints)) return false;
  return sprints.some((s) => s && Number(s.id) === Number(sprintId));
}

function displayLine(ticket) {
  return `${ticket.type} ${ticket.key} (${ticket.url}) - ${ticket.summary} · ${ticket.assignee || "—"} · ${ticket.tester || "—"} · Report to ${ticket.reporter || "—"}`;
}

function hongKongNowIso() {
  // Format as Asia/Hong_Kong offset (+08:00) ISO-like stamp
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+08:00`;
}

function normaliseRaw(issue, source) {
  const f = issue.fields || {};
  const { children, parents } = parentChildRelations(issue);
  const epicKey = epicKeyOf(issue);
  const tester = f.customfield_11310;
  return {
    key: issue.key,
    url: `${JIRA_BASE_URL}/browse/${issue.key}`,
    type: f.issuetype?.name || "Unknown",
    summary: f.summary || "",
    status: f.status?.name || "",
    statusCategory: statusCategoryName(f.status) || "",
    assignee: userName(f.assignee),
    tester: userName(tester),
    reporter: userName(f.reporter),
    assigneeAccountId: userId(f.assignee),
    testerAccountId: userId(tester),
    reporterAccountId: userId(f.reporter),
    epicKey,
    epicSummary: null, // filled later if we have the epic in set; optional
    parentKey: f.parent?.key || null,
    hubKey: parents[0] || null,
    subtaskOf: null, // filled via reverse index
    parentChildChildren: children,
    subtasks: subtaskKeys(issue),
    _parentChildParents: parents,
    inSprint3326: inSprint(issue, JIRA_SPRINT_ID),
    inTesterSet: userId(tester) === IVAN_ACCOUNT_ID,
    source,
  };
}

function assignClusters(tickets) {
  const byKey = new Map(tickets.map((t) => [t.key, t]));

  // Reverse subtask index
  for (const t of tickets) {
    for (const sk of t.subtasks || []) {
      const child = byKey.get(sk);
      if (child && !child.subtaskOf) child.subtaskOf = t.key;
    }
  }

  // Build Member / AskNicely hub trees via Parent-Child + subtasks
  function collectTree(rootKey) {
    const out = new Set();
    const stack = [rootKey];
    while (stack.length) {
      const k = stack.pop();
      if (!k || out.has(k)) continue;
      out.add(k);
      const node = byKey.get(k);
      if (!node) continue;
      for (const c of node.parentChildChildren || []) stack.push(c);
      for (const c of node.subtasks || []) stack.push(c);
      for (const other of tickets) {
        if (other.hubKey === k || other.subtaskOf === k) {
          stack.push(other.key);
        }
      }
    }
    return out;
  }

  const memberTree = collectTree(MEMBER_HUB);
  const askTree = collectTree(ASKN_HUB);

  for (const t of tickets) {
    delete t.cluster;
  }

  for (const t of tickets) {
    if (memberTree.has(t.key) || t.epicKey === MEMBER_EPIC) {
      t.cluster = "member-data";
      continue;
    }
    if (askTree.has(t.key)) {
      t.cluster = "asknicely";
      continue;
    }
    if (t.epicKey === AI_EPIC) {
      t.cluster = "ai";
      continue;
    }
    if (t.epicKey === ASKN_EPIC) {
      t.cluster = "asknicely-epic-peers";
      continue;
    }
    t.cluster = "standalone";
  }

  if (byKey.get(MEMBER_HUB)) byKey.get(MEMBER_HUB).cluster = "member-data";
  if (byKey.get(ASKN_HUB)) byKey.get(ASKN_HUB).cluster = "asknicely";
}

async function main() {
  const jql = `project = DEV1 AND cf[11310] = "${IVAN_ACCOUNT_ID}" AND sprint = ${JIRA_SPRINT_ID} ORDER BY key ASC`;
  console.log("JQL:", jql);

  const jqlIssues = await searchAll(jql);
  console.log(`JQL returned ${jqlIssues.length} issues`);

  const byKey = new Map();
  for (const issue of jqlIssues) {
    byKey.set(issue.key, normaliseRaw(issue, "jql"));
  }

  // Hub expansion: seeds + any Parent-Child parents discovered
  const toFetch = new Set(HUB_SEEDS);
  for (const t of byKey.values()) {
    for (const p of t._parentChildParents || []) toFetch.add(p);
    if (t.hubKey) toFetch.add(t.hubKey);
  }

  // Iteratively expand outward children / subtasks not yet in set
  const queue = [...toFetch];
  const fetchedExtra = new Set();

  while (queue.length) {
    const key = queue.shift();
    if (!key) continue;
    if (byKey.has(key) && fetchedExtra.has(key)) continue;

    let raw;
    if (byKey.has(key) && !HUB_SEEDS.includes(key) && !toFetch.has(key)) {
      // already from JQL; still walk its children into queue
      raw = null;
    }

    if (!byKey.has(key) || HUB_SEEDS.includes(key) || toFetch.has(key)) {
      if (!fetchedExtra.has(key)) {
        process.stdout.write(`GET ${key}… `);
        try {
          const issue = await getIssue(key);
          const source = byKey.has(key) ? byKey.get(key).source : "hub-expand";
          const norm = normaliseRaw(issue, byKey.has(key) ? source : "hub-expand");
          // Prefer richer hub-expand for relationship fields if already present
          if (byKey.has(key)) {
            const prev = byKey.get(key);
            norm.source = prev.source;
            norm.inTesterSet = prev.inTesterSet || norm.inTesterSet;
            norm.inSprint3326 = prev.inSprint3326 || norm.inSprint3326;
          }
          byKey.set(key, norm);
          fetchedExtra.add(key);
          console.log("ok");
        } catch (err) {
          console.warn(`failed: ${err.message}`);
          fetchedExtra.add(key);
          continue;
        }
        await sleep(120); // gentle serial pacing
      }
    }

    const node = byKey.get(key);
    if (!node) continue;
    for (const c of node.parentChildChildren || []) {
      if (!byKey.has(c)) queue.push(c);
    }
    for (const c of node.subtasks || []) {
      if (!byKey.has(c)) queue.push(c);
    }
  }

  const tickets = [...byKey.values()].map((t) => {
    const { _parentChildParents, ...rest } = t;
    return rest;
  });

  assignClusters(tickets);

  // Fill displayLine + tidy nullables to match sample
  for (const t of tickets) {
    t.assignee = t.assignee || null;
    t.tester = t.tester || null;
    t.reporter = t.reporter || null;
    t.displayLine = displayLine({
      ...t,
      assignee: t.assignee || "—",
      tester: t.tester || "—",
      reporter: t.reporter || "—",
    });
    // Sample uses real names in displayLine with — for missing; keep that
  }

  tickets.sort((a, b) => a.key.localeCompare(b.key));

  const payload = {
    fetchedAt: hongKongNowIso(),
    meta: {
      site: JIRA_BASE_URL,
      project: "DEV1",
      boardId: 268,
      sprint: {
        id: JIRA_SPRINT_ID,
        name: "2026 Nov",
      },
      testerAccountId: IVAN_ACCOUNT_ID,
      jql,
      fields: {
        tester: "customfield_11310",
        epicLink: "customfield_10016",
        sprint: "customfield_10020",
      },
    },
    tickets,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`Wrote ${tickets.length} tickets → ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
