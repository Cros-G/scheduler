#!/usr/bin/env node
// Cleanup script for E2E tests: removes all tasks, occurrences, notes and images for known E2E users
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
const NAMES = ["e2e_alice", "e2e_bob", "e2e_admin"];
(async () => {
  // Cascade-safe order: noteImage → dailyNote → occurrence → task
  for (const username of NAMES) {
    await p.noteImage.deleteMany({ where: { note: { user: { username } } } });
    await p.dailyNote.deleteMany({ where: { user: { username } } });
    await p.occurrence.deleteMany({ where: { user: { username } } });
    await p.task.deleteMany({ where: { user: { username } } });
  }
  // Delete any temp users (with their data via cascade)
  await p.user.deleteMany({ where: { username: { startsWith: "e2e_temp_" } } });
  await p.$disconnect();
})();
