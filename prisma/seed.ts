import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function seedAdmin(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    // eslint-disable-next-line no-console
    console.log('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD not set. Skipping admin seed.');
    return;
  }

  const existing = await prisma.admin.findUnique({ where: { email } });

  if (existing) {
    // eslint-disable-next-line no-console
    console.log(`Superadmin ${email} already exists. Skipping admin seed.`);
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

async function seedArgentinaGeoHierarchy(): Promise<void> {
  const existing = await prisma.geoNode.findFirst({
    where: { name: 'Argentina', parentId: null },
  });

  if (existing) {
    // eslint-disable-next-line no-console
    console.log('Argentina geo hierarchy already exists. Skipping geo seed.');
    return;
  }

  const argentina = await prisma.geoNode.create({
    data: {
      name: 'Argentina',
      isActive: true,
    },
  });

  await prisma.geoLevel.create({
    data: {
      countryId: argentina.id,
      level: 1,
      name: 'Provincia',
    },
  });

  await prisma.geoLevel.create({
    data: {
      countryId: argentina.id,
      level: 2,
      name: 'Departamento',
    },
  });

  const provinciaLevel = await prisma.geoLevel.findFirstOrThrow({
    where: { countryId: argentina.id, level: 1 },
  });

  const departamentoLevel = await prisma.geoLevel.findFirstOrThrow({
    where: { countryId: argentina.id, level: 2 },
  });

  const mendoza = await prisma.geoNode.create({
    data: {
      name: 'Mendoza',
      levelId: provinciaLevel.id,
      parentId: argentina.id,
      isActive: true,
    },
  });

  await prisma.geoNode.create({
    data: {
      name: 'Maipú',
      levelId: departamentoLevel.id,
      parentId: mendoza.id,
      isActive: true,
    },
  });

  await prisma.geoNode.create({
    data: {
      name: 'Luján de Cuyo',
      levelId: departamentoLevel.id,
      parentId: mendoza.id,
      isActive: true,
    },
  });

  // eslint-disable-next-line no-console
  console.log('Argentina geo hierarchy seeded successfully.');
}

async function main(): Promise<void> {
  await seedAdmin();
  await seedArgentinaGeoHierarchy();
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
