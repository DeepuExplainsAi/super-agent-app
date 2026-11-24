# THIRD_PARTY

| Name | URL | License | Commit | Changes |
|---|---|---|---|---|
| OpenMausBot (base app) | https://github.com/milind-soni/OpenMausBot | Apache-2.0 (LICENSE verified) | 9066604de2be664c7819403d9d8aed94b827f5eb | Copied whole. `enterprise/` excluded (proprietary). Renaming/cloud removal pending (Part 2). |

## Vendored in `third_party/` (came with OpenMausBot; LICENSE files verified present unless noted)
| Folder | License |
|---|---|
| cache-tax | MIT |
| cua-driver | MIT |
| hermes-agent | MIT |
| minimock | MIT |
| models-dev | MIT |
| onepassword-sdk | MIT |
| opencode | MIT |
| orca | MIT |
| playwright-injected | Apache-2.0 |
| provider-icons | MIT (Lobe Icons) |
| puppeteer | Apache-2.0 |
| t3-code | MIT |
| vexa | Apache-2.0 |
| browser | contains axe-core notice (MPL-2.0): VERIFY |
| cloudflared, hpke-js, scrcpy | NO LICENSE FILE: VERIFY before shipping |

## Dependencies by reference (not copied)
| Package | License | Where |
|---|---|---|
| @playwright/mcp 0.0.86 | Apache-2.0 | packages/automation (run via npx, pinned) |
| playwright 1.65.1 | Apache-2.0 | browser download on first run |
| @crawlee/cheerio 3.18.2 | Apache-2.0 | packages/automation/src/crawlee.ts; bundled into the server (needs header-generator data_files beside the bundle). Dependency tree audited: no GPL |
| @browserbasehq/stagehand 4.4.0 | MIT | packages/automation/src/stagehand.ts; lazy import, user's own model key, local browser only (no Browserbase cloud) |

## Excluded on purpose
- `enterprise/` (OpenMausBot Enterprise License, source-available, not permissive).
