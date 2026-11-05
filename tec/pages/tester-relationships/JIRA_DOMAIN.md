# Jira domain pack (from Jiro, verified 5 Nov 2026)

## Site / IDs
- Host: https://executivecentre.atlassian.net
- cloudId: bca0e21d-64fb-4dc5-92e1-2ee259961ff6
- Project: DEV1
- Board: 268
- Sprint: name "2026 Nov", id 3326, state active
- Ivan (Tester): accountId 712020:9556c036-6acf-4d45-bf4f-b39fbbca9aa4, displayName Ivan Chan

## Custom fields
- Tester → customfield_11310 (user)
- Epic Link → customfield_10016 (string key)
- Sprint → customfield_10020 (array)

## JQL incomplete
project = DEV1 AND cf[11310] = "712020:9556c036-6acf-4d45-bf4f-b39fbbca9aa4" AND sprint = 3326 AND statusCategory != Done ORDER BY key ASC

## JQL include Done
project = DEV1 AND cf[11310] = "712020:9556c036-6acf-4d45-bf4f-b39fbbca9aa4" AND sprint = 3326 ORDER BY key ASC

## Hub expansion seeds
GET hubs DEV1-2709, DEV1-2737, DEV1-2766, DEV1-2745 (+ any Parent-Child parent) and union outward Parent-Child / subtasks even if they fail Tester/sprint JQL.

## REST fields
summary,issuetype,status,assignee,reporter,parent,subtasks,issuelinks,customfield_11310,customfield_10016,customfield_10020

## Clusters
1. Member Data — hub DEV1-2709 tree + Epic Link/parent epic DEV1-2339 orphans
2. AskNicely — hub DEV1-2737 tree; epic DEV1-2 peers with no link to 2737 stay under AskNicely (epic peers)
3. AI — Epic Link/parent epic DEV1-1321
4. Standalone — everything else (show their epic as secondary label)

Hub seeds: DEV1-2709, DEV1-2737. Epic seeds: DEV1-1321, DEV1-2339. Epic DEV1-2 is BAU peers only.

## Display
{Type} {Key} ({browseUrl}) - {Name} · {Assignee} · {Tester} · Report to {Reporter}

## Auth
Jira Cloud Basic email:api_token as GitHub Actions secret only.
