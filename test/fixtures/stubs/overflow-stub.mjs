#!/usr/bin/env node

const bytes = Number.parseInt(process.env.CONTEXT_PROBE_OVERFLOW_BYTES ?? "", 10) || 11 * 1024 * 1024;
const channel = process.env.CONTEXT_PROBE_OVERFLOW_CHANNEL === "stderr" ? "stderr" : "stdout";
const payload = "x".repeat(bytes);

if (channel === "stderr") {
  process.stderr.write(payload);
} else {
  process.stdout.write(payload);
}
