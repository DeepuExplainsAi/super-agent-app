# @super-agent/theme

Design tokens for the Super Agent look: dark-first, monochrome, rounded, Inter font (OFL), no third-party assets.

- `tokens.css`: the `agent` skin (`[data-skin="agent"]`). Imported by `src/styles.css`. It is the default dark skin.
- Check: `pnpm check:contrast` measures every text/surface pair (reads `src/styles.css` + `packages/theme/tokens.css`).
- Test: `pnpm check:contrast` must pass; open the app, Settings -> Appearance -> "Agent".
- Contract: `manifest.json` (no tools/panels; pure style package).
