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
    { key: 'BADGE_MIN_COMPLETED_REQUESTS', value: '10' },
    { key: 'MATCHING_MAX_ACTIVE_REQUESTS', value: '5' },
    { key: 'MATCHING_WEIGHT_COMPLIANCE', value: '0.35' },
    { key: 'MATCHING_WEIGHT_RESPONSE_RATE', value: '0.25' },
    { key: 'MATCHING_WEIGHT_RECOMMENDATION', value: '0.10' },
    { key: 'MATCHING_WEIGHT_DISTRIBUTION', value: '0.05' },
    { key: 'MATCHING_WEIGHT_QUALITY_RATING', value: '0.20' },
    { key: 'MATCHING_WEIGHT_PLAN', value: '0.05' },
    { key: 'MATCHING_BADGE_BONUS', value: '5' },
    { key: 'MATCHING_REJECTION_PENALTY', value: '10' },
    { key: 'MATCHING_TENDENCY_WEIGHT', value: '0.15' },
    { key: 'MATCHING_COMPLIANCE_PENALTY', value: '50' },
    { key: 'MATCHING_RESPONSE_PENALTY', value: '25' },
    { key: 'MATCHING_REPUTATION_DECAY_DAYS', value: '90' },
    { key: 'MATCHING_DISTRIBUTION_DAILY_BONUS', value: '10' },
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
  const plans = [
    { name: 'Básico', monthlyPrice: 9000, annualDiscountPct: 10, priority: 1 },
    { name: 'Profesional', monthlyPrice: 20000, annualDiscountPct: 15, priority: 2 },
    { name: 'Premium', monthlyPrice: 40000, annualDiscountPct: 20, priority: 3 },
  ];

  const legacyProfessional = await prisma.plan.findUnique({
    where: { name: 'Profesional NORA' },
  });

  if (legacyProfessional) {
    const existingProfessional = await prisma.plan.findUnique({
      where: { name: 'Profesional' },
    });

    if (existingProfessional) {
      await prisma.plan.delete({ where: { id: legacyProfessional.id } });
      // eslint-disable-next-line no-console
      console.log('Legacy plan "Profesional NORA" removed (duplicate of "Profesional").');
    } else {
      await prisma.plan.update({
        where: { id: legacyProfessional.id },
        data: { name: 'Profesional' },
      });
      // eslint-disable-next-line no-console
      console.log('Legacy plan "Profesional NORA" renamed to "Profesional".');
    }
  }

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: {
        monthlyPrice: plan.monthlyPrice,
        annualDiscountPct: plan.annualDiscountPct,
        priority: plan.priority,
        isActive: true,
      },
      create: {
        name: plan.name,
        monthlyPrice: plan.monthlyPrice,
        annualDiscountPct: plan.annualDiscountPct,
        priority: plan.priority,
      },
    });

    // eslint-disable-next-line no-console
    console.log(`Plan "${plan.name}" seeded successfully.`);
  }
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
