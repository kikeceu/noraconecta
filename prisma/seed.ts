import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    // eslint-disable-next-line no-console
    console.log('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD not set. Skipping seed.');
    return;
  }

  const existing = await prisma.admin.findUnique({ where: { email } });

  if (existing) {
    // eslint-disable-next-line no-console
    console.log(`Superadmin ${email} already exists. Skipping seed.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.admin.create({
    data: {
      email,
      passwordHash,
      name: 'Super Admin',
      role: 'SUPERADMIN',
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Superadmin ${email} created successfully.`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
