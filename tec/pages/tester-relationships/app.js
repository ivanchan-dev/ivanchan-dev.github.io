(() => {
  "use strict";

  const DATA_URL = "./data/tickets.json";

  const CLUSTER_META = {
    "member-data": {
      id: "member-data",
      label: "Member Data",
      caption: "Hub DEV1-2709 Parent-Child / subtask tree, plus Member Data epic DEV1-2339 orphans.",
      hubKey: "DEV1-2709",
      filterIds: ["member-data"],
    },
    asknicely: {
      id: "asknicely",
      label: "AskNicely",
      caption: "Hub DEV1-2737 tree. Epic DEV1-2 peers without a link to 2737 are listed as AskNicely · epic peers.",
      hubKey: "DEV1-2737",
      filterIds: ["asknicely", "asknicely-epic-peers"],
    },
    ai: {
      id: "ai",
      label: "AI",
      caption: "Epic DEV1-1321 (Parent-Child / subtasks under that epic).",
      hubKey: "DEV1-2379",
      epicKey: "DEV1-1321",
      filterIds: ["ai"],
    },
    standalone: {
      id: "standalone",
      label: "Standalone",
      caption: "Tester-sprint tickets outside the Member Data, AskNicely, and AI hubs — epic shown as secondary label.",
      hubKey: null,
      filterIds: ["standalone"],
    },
  };

  const SECTION_ORDER = ["member-data", "asknicely", "ai", "standalone"];

  const state = {
    data: null,
    cluster: "all",
    status: "open",
  };

  const el = {
    fetchedAt: document.getElementById("fetched-at"),
    ticketCount: document.getElementById("ticket-count"),
    clusterFilter: document.getElementById("cluster-filter"),
    statusFilter: document.getElementById("status-filter"),
    uatCallout: document.getElementById("uat-callout"),
    uatList: document.getElementById("uat-list"),
    sections: document.getElementById("cluster-sections"),
    detailList: document.getElementById("detail-list"),
    emptyState: document.getElementById("empty-state"),
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function dash(value) {
    const v = (value ?? "").toString().trim();
    return v ? v : "—";
  }

  function isUatLike(status) {
    return /uat|ready for deployment/i.test(status || "");
  }

  function statusClass(ticket) {
    if (isUatLike(ticket.status)) return "uat";
    if (ticket.statusCategory === "Done") return "done";
    if (ticket.statusCategory === "In Progress") return "progress";
    return "todo";
  }

  function matchesClusterFilter(ticket, clusterFilter) {
    if (clusterFilter === "all") return true;
    const meta = CLUSTER_META[clusterFilter];
    if (!meta) return ticket.cluster === clusterFilter;
    return meta.filterIds.includes(ticket.cluster);
  }

  function matchesStatusFilter(ticket, statusFilter) {
    if (statusFilter === "all") return true;
    return ticket.statusCategory !== "Done";
  }

  function filteredTickets() {
    return (state.data?.tickets || []).filter(
      (t) => matchesClusterFilter(t, state.cluster) && matchesStatusFilter(t, state.status)
    );
  }

  function byKey(tickets) {
    const map = new Map();
    for (const t of tickets) map.set(t.key, t);
    return map;
  }

  function setActiveSegment(container, attr, value) {
    for (const btn of container.querySelectorAll(".seg")) {
      const active = btn.dataset[attr] === value;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  function formatFetchedAt(iso) {
    if (!iso) return "Fetched: unknown";
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return `Fetched: ${iso}`;
      return `Fetched: ${iso} (Asia/Hong_Kong)`;
    } catch {
      return `Fetched: ${iso}`;
    }
  }

  function renderUat(allVisible) {
    const uat = allVisible
      .filter((t) => isUatLike(t.status))
      .sort((a, b) => a.key.localeCompare(b.key));
    if (!uat.length) {
      el.uatCallout.hidden = true;
      el.uatList.innerHTML = "";
      return;
    }
    el.uatCallout.hidden = false;
    el.uatList.innerHTML = uat
      .map(
        (t) =>
          `<li><a href="${escapeHtml(t.url)}" target="_blank" rel="noopener">${escapeHtml(t.key)}</a> · ${escapeHtml(t.status)} · ${escapeHtml(t.summary)}</li>`
      )
      .join("");
  }

  function renderTree(hubKey, tickets) {
    if (!hubKey) return "";
    const map = byKey(tickets);
    const hub = map.get(hubKey) || (state.data.tickets || []).find((t) => t.key === hubKey);
    if (!hub) return "";

    // Prefer visible tickets for children; fall back to full set for structure labels
    const fullMap = byKey(state.data.tickets || []);

    function childKeys(ticket) {
      const keys = [];
      for (const k of ticket.parentChildChildren || []) keys.push({ key: k, kind: "child" });
      for (const k of ticket.subtasks || []) keys.push({ key: k, kind: "subtask" });
      return keys;
    }

    function renderNode(key, depth, visited) {
      if (visited.has(key)) return "";
      visited.add(key);
      const ticket = map.get(key) || fullMap.get(key);
      if (!ticket) return "";
      // Skip nodes filtered out unless they are the hub itself
      if (key !== hubKey && !map.has(key)) {
        // Still walk children that might be visible? Prefer only visible leaves.
        const kids = childKeys(fullMap.get(key) || ticket)
          .map((c) => renderNode(c.key, depth + 1, visited))
          .filter(Boolean)
          .join("");
        return kids;
      }
      const label = `${escapeHtml(ticket.type)} <span class="node-key"><a href="${escapeHtml(ticket.url)}" target="_blank" rel="noopener">${escapeHtml(ticket.key)}</a></span> — ${escapeHtml(ticket.summary)} <span class="status-chip ${statusClass(ticket)}">${escapeHtml(ticket.status)}</span>`;
      const kids = childKeys(ticket)
        .map((c) => renderNode(c.key, depth + 1, visited))
        .filter(Boolean)
        .join("");
      if (!kids) return `<li>${label}</li>`;
      return `<li>${label}<ul>${kids}</ul></li>`;
    }

    const body = renderNode(hubKey, 0, new Set());
    if (!body) return "";
    return `<div class="tree" aria-label="Relationship tree"><ul>${body}</ul></div>`;
  }

  function renderTable(tickets) {
    if (!tickets.length) {
      return `<p class="muted">No tickets in this section for the current filters.</p>`;
    }
    const rows = tickets
      .slice()
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((t) => {
        const epicNote =
          t.cluster === "standalone" && t.epicKey
            ? `<div class="muted">Epic ${escapeHtml(t.epicKey)}${t.epicSummary ? ` · ${escapeHtml(t.epicSummary)}` : ""}</div>`
            : t.cluster === "asknicely-epic-peers"
              ? `<div class="muted">AskNicely · epic peers${t.epicKey ? ` (${escapeHtml(t.epicKey)})` : ""}</div>`
              : "";
        return `<tr>
          <td>${escapeHtml(t.type)}</td>
          <td><a href="${escapeHtml(t.url)}" target="_blank" rel="noopener">${escapeHtml(t.key)}</a></td>
          <td>${escapeHtml(t.summary)}${epicNote}</td>
          <td>${escapeHtml(dash(t.assignee))}</td>
          <td>${escapeHtml(dash(t.tester))}</td>
          <td>${escapeHtml(dash(t.reporter))}</td>
          <td><span class="status-chip ${statusClass(t)}">${escapeHtml(t.status)}</span></td>
        </tr>`;
      })
      .join("");
    return `<div class="table-wrap"><table class="tickets">
      <thead>
        <tr>
          <th>Type</th>
          <th>Key</th>
          <th>Name</th>
          <th>Assignee</th>
          <th>Tester</th>
          <th>Reporter</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  }

  function ticketsForSection(sectionId, allVisible) {
    const meta = CLUSTER_META[sectionId];
    return allVisible.filter((t) => meta.filterIds.includes(t.cluster));
  }

  function renderSections(allVisible) {
    const show = SECTION_ORDER.filter((id) => {
      if (state.cluster === "all") return true;
      return state.cluster === id;
    });

    const html = show
      .map((id) => {
        const meta = CLUSTER_META[id];
        const tickets = ticketsForSection(id, allVisible);
        const hubTickets = tickets; // tree uses filtered set
        const tree =
          id === "standalone"
            ? ""
            : renderTree(meta.hubKey, hubTickets.length ? hubTickets : tickets);

        // For AskNicely, split peers caption in table via cluster label already
        return `<section class="panel cluster-section" data-cluster="${escapeHtml(id)}">
          <div class="cluster-head">
            <span class="cluster-badge ${escapeHtml(id)}">${escapeHtml(meta.label)}</span>
            <h2>${escapeHtml(meta.label)}</h2>
            <span class="count-chip">${tickets.length} ticket${tickets.length === 1 ? "" : "s"}</span>
          </div>
          <p class="muted">${escapeHtml(meta.caption)}</p>
          ${tree}
          ${id === "asknicely" && tickets.some((t) => t.cluster === "asknicely-epic-peers")
            ? `<p class="peer-note">Rows tagged “AskNicely · epic peers” share epic DEV1-2 but are not linked to hub DEV1-2737.</p>`
            : ""}
          ${renderTable(tickets)}
        </section>`;
      })
      .join("");

    el.sections.innerHTML = html;
  }

  function renderDetail(allVisible) {
    const sorted = allVisible.slice().sort((a, b) => a.key.localeCompare(b.key));
    if (!sorted.length) {
      el.detailList.innerHTML = "";
      return;
    }
    el.detailList.innerHTML = sorted
      .map((t) => {
        // Linkify the bare URL already present in displayLine
        const line = escapeHtml(t.displayLine || "");
        const linked = line.replace(
          /(https:\/\/executivecentre\.atlassian\.net\/browse\/DEV1-\d+)/g,
          '<a href="$1" target="_blank" rel="noopener">$1</a>'
        );
        return `<li>${linked}</li>`;
      })
      .join("");
  }

  function render() {
    if (!state.data) return;
    const visible = filteredTickets();
    el.fetchedAt.textContent = formatFetchedAt(state.data.fetchedAt);
    el.ticketCount.textContent = `${visible.length} shown · ${state.data.tickets.length} in feed`;
    el.emptyState.hidden = visible.length > 0;
    renderUat(visible);
    renderSections(visible);
    renderDetail(visible);
  }

  function wireFilters() {
    el.clusterFilter.addEventListener("click", (e) => {
      const btn = e.target.closest(".seg");
      if (!btn) return;
      state.cluster = btn.dataset.cluster;
      setActiveSegment(el.clusterFilter, "cluster", state.cluster);
      render();
    });
    el.statusFilter.addEventListener("click", (e) => {
      const btn = e.target.closest(".seg");
      if (!btn) return;
      state.status = btn.dataset.status;
      setActiveSegment(el.statusFilter, "status", state.status);
      render();
    });
  }

  async function boot() {
    wireFilters();
    try {
      const res = await fetch(DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      state.data = await res.json();
      render();
    } catch (err) {
      el.fetchedAt.textContent = "Failed to load tickets.json";
      el.ticketCount.textContent = "";
      el.sections.innerHTML = `<section class="panel"><p>Could not load <code>./data/tickets.json</code>. Serve this folder over HTTP (GitHub Pages or a local static server). ${escapeHtml(err.message || err)}</p></section>`;
    }
  }

  boot();
})();
