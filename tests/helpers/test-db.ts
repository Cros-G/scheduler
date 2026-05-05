import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const TEST_DB_DIR = path.resolve(__dirname, "../../test-data");
const TEST_DB_PATH = path.join(TEST_DB_DIR, "test.db");

let prisma: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!prisma) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
    process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;
    execSync("pnpm prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: `file:${TEST_DB_PATH}` },
      stdio: "inherit",
    });
    prisma = new PrismaClient({
      datasources: { db: { url: `file:${TEST_DB_PATH}` } },
    });
  }
  return prisma;
}

export async function resetTestDb() {
  const p = getTestPrisma();
  // Clear in dependency order
  await p.session.deleteMany();
  await p.user.deleteMany();
}

export async function closeTestDb() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
