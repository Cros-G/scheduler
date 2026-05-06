#!/usr/bin/env node
// Cleanup script for E2E tests: removes all tasks, occurrences, notes and images for e2e_alice
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  // Cascade-safe order: noteImage → dailyNote → occurrence → task
  await p.noteImage.deleteMany({ where: { note: { user: { username: "e2e_alice" } } } });
  await p.dailyNote.deleteMany({ where: { user: { username: "e2e_alice" } } });
  await p.occurrence.deleteMany({ where: { user: { username: "e2e_alice" } } });
  await p.task.deleteMany({ where: { user: { username: "e2e_alice" } } });
  await p.$disconnect();
})();
