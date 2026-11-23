# postmortem-lens

A Claude Code plugin that uses a stock of recent major outages to help you notice the **weak spots** in your own service or OSS project, and how **important** each one is.

Stock list: https://k-kudo-hub.github.io/postmortem-lens/

## Who it is for

Developers, SREs and product leads who run a public service or OSS project and want to know whether it could go down the same way another company's major outage did.

## What it does

- Run `/postmortem-lens:check` in the repository you want to inspect. Claude reads the code and the infrastructure settings (Kubernetes manifests, Helm charts, Terraform, docker-compose, CI/CD workflows) and lists the weak spots that could fail the same way as an outage in the stock
- Each weak spot gets one of four verdicts: "applies", "already mitigated", "does not apply" or "cannot be determined". The weak spots that apply are listed in order of importance, and each comes with:
  - A severity (high, medium or low) and the reason for it (how wide the impact would be and how easily the conditions line up)
  - The file and line that serve as evidence
  - The outage that failed the same way, with a quote from its report (and a quote of the fixes the report lists, if any)
  - Countermeasures you can take now, and a first step you can start today (postmortem-lens generalizes the report's fixes for your repository)
- It also lists the spots that are already mitigated, do not apply or cannot be determined, and anything it noticed outside the stock

Example run: [the result of inspecting GoogleCloudPlatform/microservices-demo](examples/microservices-demo.md)

### How it differs from Dependabot

| | Dependabot | postmortem-lens |
|---|---|---|
| What it looks at | Names and versions of dependency packages | How the code and infrastructure settings are built (routing, retries, health checks, bulkheads, rollback paths) |
| What it compares against | A database of known vulnerabilities | How real major outages at other companies happened |
| What it finds | Library versions with reported vulnerabilities | Spots that could fail the same way another company did |

Known vulnerabilities in libraries (CVEs) are out of scope. Use it together with a vulnerability scanner such as Dependabot.

## Usage

On Claude Code v2.1.275 or later, install the plugin with:

```text
/plugin install postmortem-lens --marketplace k-kudo-hub/postmortem-lens
```

On earlier versions, run it in two steps:

```text
/plugin marketplace add k-kudo-hub/postmortem-lens
/plugin install postmortem-lens@postmortem-lens
```

Open Claude Code in the repository you want to inspect and run:

```text
/postmortem-lens:check
```

- The check runs inside your own Claude Code. The files it reads are sent to Claude (Anthropic), the same as when you normally use Claude Code. The skill instructs Claude not to send them anywhere else on the web. postmortem-lens has no server. The cost fits within your Claude Code usage
- The skill instructs Claude to only read files, and not to modify them or send anything to the web (it may run read-only commands such as `git ls-files` to list files)
- The stock grows every week. The plugin does not pin a version, so updating it lets you check against the new stock

## The outage stock

`plugin/stock/` holds one JSON file per outage. Each outage has the source and a summary of its primary report, and the weak spots that caused it. Each weak spot has a viewpoint, what happened, quotes from the report, the fixes the report lists (quoted), what to look for in a repository, and countermeasures you can take now (generalized by postmortem-lens). The shape is defined in [`src/stock/schema.ts`](src/stock/schema.ts), and the list of viewpoints is in [`src/lens/viewpoints.ts`](src/lens/viewpoints.ts).

- Only primary reports that the provider published itself, and that can be read on the provider's site without logging in, are collected. Reports that can only be read in an admin console are not included, even if a third party has reposted them
- Quotes are mechanically matched against the text of the primary report, and only those found verbatim are kept. The report text itself is copyrighted, so it is not stored in this repository
- Every week, a cloud Claude Code routine looks for new primary reports following [`routine/add-incidents.md`](routine/add-incidents.md) and opens a PR that adds them to the stock

### How a weekly PR is verified and merged

1. The routine opens a PR that adds outages to the stock on a `claude/stock-{date}` branch
2. CI (`.github/workflows/ci.yml`) runs the tests, type check, lint and build, and, for only the outages added or changed in that PR, fetches the primary report text from the source URL and matches the quotes against it (`scripts/verify-changed-quotes.py`). The text is kept only in CI's temporary directory and never stored in the repository. Existing outages are not re-matched
3. If every check passes and the PR changes only the stock (`plugin/stock/*.json`), `.github/workflows/auto-merge.yml` squash-merges the PR, updates the published page and deletes the branch. No human review is involved. This workflow runs from its definition on `main`, so a PR cannot rewrite the decision
4. A PR whose checks fail is left unmerged. The log of the failed check shows why. A PR that changes files outside the stock gets a comment explaining why it was not merged automatically

## Known limitations

- The weak-spot verdicts and severities are written by Claude. Open the evidence file and line to confirm they are correct
- If the infrastructure settings live in another repository, that part is reported as "cannot be determined"
- It does not find weak spots that fail in a way not covered by the stock
- The report the check produces, the stock list page and the example run are written in Japanese

## Development

Runs on Node.js 22 or later (CI and publishing use Node.js 24).

```bash
npm install
npm run dev      # open the stock list page at http://localhost:5173/
```

| Command | What it does |
|----------|----------|
| `npm test` | Tests (Vitest). Also checks that the stock matches the schema |
| `SOURCES_DIR=… npm run verify-quotes` | Matches the stock's quotes against the primary report text. Put the text at `{SOURCES_DIR}/{outage id}.txt` before running. `INCIDENT_IDS` (comma-separated outage ids) narrows the targets |
| `python3 scripts/verify-changed-quotes.py origin/main` | For only the outages added or changed since `origin/main`, fetches the primary report text and matches the quotes (reports in PDF need `pdftotext`) |
| `python3 -m unittest discover -s scripts` | Tests for the scripts |
| `npm run typecheck` | Type check |
| `npm run lint` | Lint and format check (Biome) |
| `npm run build` | Builds the stock list page into `dist/` |
| `claude plugin validate ./plugin` | Validates the plugin settings |

To try the plugin locally, run `claude --plugin-dir {this repository}/plugin` in the repository you want to inspect, then run `/postmortem-lens:check`.

### How publishing works

Pushing to `main` makes GitHub Actions (`.github/workflows/deploy.yml`) publish the stock list page to GitHub Pages. When a weekly PR is merged automatically, `auto-merge.yml` triggers the same workflow.
GitHub Free does not allow GitHub Pages on private repositories, so it only works while the repository is public.
When publishing for the first time, set Source to "GitHub Actions" under Settings → Pages in the repository.

## License

MIT (the copyright of the quoted report text belongs to each provider)
