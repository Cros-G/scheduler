#!/usr/bin/env node
// Cleanup script for E2E tests: removes all tasks, occurrences, notes and images for e2e_alice and e2e_bob
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
const NAMES = ["e2e_alice", "e2e_bob"];
(async () => {
  // Cascade-safe order: noteImage → dailyNote → occurrence → task
  for (const username of NAMES) {
    await p.noteImage.deleteMany({ where: { note: { user: { username } } } });
    await p.dailyNote.deleteMany({ where: { user: { username } } });
    await p.occurrence.deleteMany({ where: { user: { username } } });
    await p.task.deleteMany({ where: { user: { username } } });
  }
  await p.$disconnect();
})();
