import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

function parseArgs(argv: string[]) {
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith("--")) throw new Error(`Bad arg: ${argv[i]}`);
    flags[argv[i].slice(2)] = argv[i + 1];
  }
  if (!flags.username || !flags.password) {
    throw new Error("Usage: --username <name> --password <new>");
  }
  return flags as { username: string; password: string };
}

async function main() {
  const { username, password } = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    const passwordHash = await hashPassword(password);
    const result = await prisma.user.updateMany({
      where: { username },
      data: { passwordHash },
    });
    if (result.count === 0) {
      throw new Error(`User "${username}" not found`);
    }
    await prisma.session.deleteMany({ where: { user: { username } } });
    console.log(`✓ Password reset for "${username}". All sessions cleared.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
