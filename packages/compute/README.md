# @super-agent/compute

In-process background job queue for heavy work on the user's own PC (crawls, batches, local model calls).
`createJobQueue({ maxConcurrent, minFreeMemoryMb })`: `add(name, run)`, `get/list`, `cancel(id)` (aborts `ctx.signal`), `setLimits()`, `idle()`.
Progress via `ctx.progress(0..1, msg)`. RAM limit: a job waits while free RAM is below the limit and another job is running.
Limits are CPU = concurrency and RAM = free-memory gate. Hard per-process CPU/RAM caps are NOT enforced (jobs run in this process).
Open: persistence across restart, UI panel with sliders for the limits, wiring `packages/automation` crawls and local model calls as jobs.
