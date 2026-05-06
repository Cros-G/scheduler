#!/usr/bin/env node
// Cleanup script for E2E tests: removes all tasks (and occurrences) for e2e_alice
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  // Occurrences must be deleted before tasks (FK constraint)
  await p.occurrence.deleteMany({ where: { user: { username: "e2e_alice" } } });
  await p.task.deleteMany({ where: { user: { username: "e2e_alice" } } });
  await p.$disconnect();
})();
