import type { PrismaClient } from "@prisma/client";
import { PrismaClient as DefaultPrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

export interface SeedArgs {
  username: string;
  display: string;
  password: string;
  color: string;
  admin: boolean;
}

export function parseArgs(argv: string[]): SeedArgs {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i++;
    }
  }
  const required = ["username", "display", "password", "color"];
  for (const k of required) {
    if (typeof flags[k] !== "string") {
      throw new Error(`Missing --${k}`);
    }
  }
  return {
    username: flags.username as string,
    display: flags.display as string,
    password: flags.password as string,
    color: flags.color as string,
    admin: flags.admin === true,
  };
}

export async function createUser(args: SeedArgs, prisma: PrismaClient) {
  const passwordHash = await hashPassword(args.password);
  await prisma.user.upsert({
    where: { username: args.username },
    update: {
      displayName: args.display,
      color: args.color,
      isAdmin: args.admin,
      passwordHash,
    },
    create: {
      username: args.username,
      displayName: args.display,
      color: args.color,
      isAdmin: args.admin,
      passwordHash,
    },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prisma = new DefaultPrismaClient();
  try {
    await createUser(args, prisma);
    console.log(`✓ User "${args.username}" created/updated.`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.endsWith("seed-user.ts") || process.argv[1]?.endsWith("seed-user.js")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
