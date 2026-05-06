#!/usr/bin/env node
// Cleanup script for E2E tests: removes all tasks for e2e_alice
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  await p.task.deleteMany({ where: { user: { username: "e2e_alice" } } });
  await p.$disconnect();
})();
