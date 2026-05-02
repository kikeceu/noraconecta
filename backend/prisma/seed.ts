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

async function seedSystemConfig(): Promise<void> {
  const configs = [
    { key: 'TRIAL_REQUESTS_LIMIT', value: '5' },
    { key: 'PROFESSIONAL_RESPONSE_TIMEOUT_HOURS', value: '3' },
    { key: 'REPUTATION_PENALTY_DECAY_DAYS', value: '90' },
    { key: 'BADGE_MIN_COMPLETED_REQUESTS', value: '5' },
  ];

  for (const cfg of configs) {
    await prisma.systemConfig.upsert({
      where: { key: cfg.key },
      update: { value: cfg.value },
      create: cfg,
    });
  }

  // eslint-disable-next-line no-console
  console.log('System config seeded successfully.');
}

async function seedPlans(): Promise<void> {
  const monthlyPrice = process.env.PLAN_MONTHLY_PRICE;
  const annualDiscountPct = process.env.PLAN_ANNUAL_DISCOUNT_PCT;

  if (!monthlyPrice || !annualDiscountPct) {
    // eslint-disable-next-line no-console
    console.log('PLAN_MONTHLY_PRICE and PLAN_ANNUAL_DISCOUNT_PCT not set. Skipping plan seed.');
    return;
  }

  const planName = 'Profesional NORA';

  await prisma.plan.upsert({
    where: { name: planName },
    update: {
      monthlyPrice: parseFloat(monthlyPrice),
      annualDiscountPct: parseFloat(annualDiscountPct),
    },
    create: {
      name: planName,
      monthlyPrice: parseFloat(monthlyPrice),
      annualDiscountPct: parseFloat(annualDiscountPct),
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Plan "${planName}" seeded successfully.`);
}

async function seedCategories(): Promise<void> {
  const categories = [
    { name: 'Plomero', slug: 'plomero', description: 'Servicios de plomería general' },
    { name: 'Electricista', slug: 'electricista', description: 'Servicios de electricidad' },
    { name: 'Gasista matriculado', slug: 'gasista-matriculado', description: 'Servicios de gas certificados' },
    { name: 'Pintor', slug: 'pintor', description: 'Servicios de pintura' },
    { name: 'Albañil', slug: 'albanil', description: 'Servicios de albañilería y construcción' },
    { name: 'Cerrajero', slug: 'cerrajero', description: 'Servicios de cerrajería' },
    { name: 'Aire acondicionado', slug: 'aire-acondicionado', description: 'Instalación y reparación de aires acondicionados' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description },
      create: cat,
    });
  }

  // eslint-disable-next-line no-console
  console.log('Categories seeded successfully.');
}

async function main(): Promise<void> {
  await seedAdmin();
  await seedArgentinaGeoHierarchy();
  await seedSystemConfig();
  await seedPlans();
  await seedCategories();
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
