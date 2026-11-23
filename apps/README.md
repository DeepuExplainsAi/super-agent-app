# App profiles

The repo root is the main app (the forked OpenMausBot, now Super Agent). `apps/<name>/app.json` lists which `packages/*`
each app loads: `main-app` loads all, the others a subset (ARCHITECTURE.md Phase 8).

Set `SA_APP=bot-app` (or `automation-app`, `workflow-app`) to start the server with only that profile's packages:
`/api/sa/packages` lists them and the routes of a package that is not loaded answer 404. Unset = `main-app` (everything).
These are profiles of one build, not separate installers. Separate installers would need their own electron-builder config.
