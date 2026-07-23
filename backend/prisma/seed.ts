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

  await prisma.geoNode.create({
    data: {
      name: 'Ciudad',
      levelId: departamentoLevel.id,
      parentId: mendoza.id,
      isActive: true,
    },
  });

  await prisma.geoNode.create({
    data: {
      name: 'Godoy Cruz',
      levelId: departamentoLevel.id,
      parentId: mendoza.id,
      isActive: true,
    },
  });

  await prisma.geoNode.create({
    data: {
      name: 'Guaymallén',
      levelId: departamentoLevel.id,
      parentId: mendoza.id,
      isActive: true,
    },
  });

  await prisma.geoNode.create({
    data: {
      name: 'Las Heras',
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
    { key: 'WORK_COMPLETION_CHECK_HOURS', value: '24' },
    { key: 'REPUTATION_PENALTY_DECAY_DAYS', value: '90' },
    { key: 'BADGE_MIN_COMPLETED_REQUESTS', value: '10' },
    { key: 'MATCHING_MAX_ACTIVE_REQUESTS', value: '5' },
    { key: 'MATCHING_WEIGHT_COMPLIANCE', value: '0.14' },
    { key: 'MATCHING_WEIGHT_RESPONSE_RATE', value: '0.20' },
    { key: 'MATCHING_WEIGHT_QUALITY_RATING', value: '0.10' },
    { key: 'MATCHING_WEIGHT_RECOMMENDATION', value: '0.10' },
    { key: 'MATCHING_WEIGHT_DISTRIBUTION', value: '0.05' },
    { key: 'MATCHING_WEIGHT_PLAN', value: '0.05' },
    { key: 'MATCHING_WEIGHT_ACCEPTANCE', value: '0.05' },
    { key: 'MATCHING_WEIGHT_COMPLETION', value: '0.05' },
    { key: 'MATCHING_WEIGHT_RESPONSE_TIME', value: '0.03' },
    { key: 'MATCHING_WEIGHT_SENTIMENT', value: '0.05' },
    { key: 'MATCHING_WEIGHT_SPECIALIZATION', value: '0.08' },
    { key: 'MATCHING_AVAILABILITY_BONUS_DATE', value: '15' },
    { key: 'MATCHING_AVAILABILITY_BONUS_URGENT', value: '25' },
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
    { name: 'Básico', monthlyPrice: 9000, annualDiscountPct: 15, priority: 1 },
    { name: 'Profesional', monthlyPrice: 20000, annualDiscountPct: 20, priority: 2 },
    { name: 'Premium', monthlyPrice: 40000, annualDiscountPct: 25, priority: 3 },
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
    { name: 'Plomero', slug: 'plomero', description: 'Servicios de plomería general', requiresLicense: false, licenseLabel: null },
    { name: 'Electricista', slug: 'electricista', description: 'Servicios de electricidad', requiresLicense: true, licenseLabel: 'Matrícula de electricista' },
    { name: 'Gasista matriculado', slug: 'gasista-matriculado', description: 'Servicios de gas certificados', requiresLicense: true, licenseLabel: 'Matrícula habilitante de gasista' },
    { name: 'Pintor', slug: 'pintor', description: 'Servicios de pintura', requiresLicense: false, licenseLabel: null },
    { name: 'Albañil', slug: 'albanil', description: 'Servicios de albañilería y construcción', requiresLicense: false, licenseLabel: null },
    { name: 'Cerrajero', slug: 'cerrajero', description: 'Servicios de cerrajería', requiresLicense: false, licenseLabel: null },
    { name: 'Aire acondicionado', slug: 'aire-acondicionado', description: 'Instalación y reparación de aires acondicionados', requiresLicense: true, licenseLabel: 'Certificado técnico (manejo de gases refrigerantes)' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        requiresLicense: cat.requiresLicense,
        licenseLabel: cat.licenseLabel,
      },
      create: cat,
    });
  }

  // eslint-disable-next-line no-console
  console.log('Categories seeded successfully.');
}

async function seedMendozaCoordinates(): Promise<void> {
  const coordinates: Array<{ name: string; lat: number; lng: number }> = [
    { name: 'Capital', lat: -32.8908, lng: -68.8272 },
    { name: 'Godoy Cruz', lat: -32.9247, lng: -68.8383 },
    { name: 'Guaymallén', lat: -32.8833, lng: -68.7833 },
    { name: 'Las Heras', lat: -32.8333, lng: -68.8167 },
    { name: 'Luján de Cuyo', lat: -33.0333, lng: -68.8833 },
    { name: 'Maipú', lat: -32.9833, lng: -68.7833 },
    { name: 'Lavalle', lat: -32.7167, lng: -68.0167 },
    { name: 'Rivadavia', lat: -33.1833, lng: -68.4667 },
    { name: 'San Martín', lat: -33.0833, lng: -68.4667 },
    { name: 'Junín', lat: -33.1333, lng: -68.3833 },
    { name: 'Santa Rosa', lat: -33.0667, lng: -68.2167 },
    { name: 'La Paz', lat: -33.4667, lng: -67.5500 },
    { name: 'San Rafael', lat: -34.6167, lng: -68.3333 },
    { name: 'General Alvear', lat: -34.9833, lng: -67.7000 },
    { name: 'Malargüe', lat: -35.4667, lng: -69.5833 },
    { name: 'Tunuyán', lat: -33.5667, lng: -69.0167 },
    { name: 'Tupungato', lat: -33.3667, lng: -69.1333 },
    { name: 'San Carlos', lat: -33.7667, lng: -69.0500 },
  ];

  const mendoza = await prisma.geoNode.findFirst({
    where: { name: 'Mendoza', parent: { name: 'Argentina' } },
  });

  if (!mendoza) {
    // eslint-disable-next-line no-console
    console.log('Mendoza province not found. Skipping coordinate seed.');
    return;
  }

  const departamentoLevel = await prisma.geoLevel.findFirst({
    where: { name: 'Departamento' },
  });

  let updated = 0;
  let created = 0;

  for (const coord of coordinates) {
    const nameCandidates = coord.name === 'Capital' ? [coord.name, 'Ciudad'] : [coord.name];

    const node = await prisma.geoNode.findFirst({
      where: {
        name: { in: nameCandidates },
        parentId: mendoza.id,
      },
    });

    if (node) {
      await prisma.geoNode.update({
        where: { id: node.id },
        data: { latitude: coord.lat, longitude: coord.lng },
      });
      updated++;
    } else {
      await prisma.geoNode.create({
        data: {
          name: coord.name,
          levelId: departamentoLevel?.id ?? null,
          parentId: mendoza.id,
          latitude: coord.lat,
          longitude: coord.lng,
          isActive: true,
        },
      });
      created++;
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Mendoza coordinates seeded: ${updated} updated, ${created} created.`);
}

async function seedPromptTemplates(): Promise<void> {
  const templates = [
    {
      key: 'clarification_questions',
      description: 'Genera preguntas de clarificación para pedidos de servicios del hogar',
      variables: ['categoryName', 'description'],
      isEditable: true,
      defaultContent: `Sos un dispatcher experto en servicios del hogar en Argentina. Tu trabajo es decidir si necesitás más info antes de enviar un profesional.

Servicio: {{categoryName}}
Descripción del usuario: "{{description}}"

Hacete esta pregunta: ¿Un {{categoryName}} experimentado puede llegar al domicilio y empezar a diagnosticar o trabajar con esta descripción?

Si la respuesta es SÍ → respondé exactamente: NO_QUESTIONS

Solo respondé con UNA pregunta si la descripción no permite saber NI SIQUIERA de qué tipo de problema se trata — no el detalle, el TIPO. Por ejemplo, un electricista no sabe si tiene que cambiar una lámpara o instalar un tablero nuevo son trabajos completamente distintos que requieren herramientas y tiempo diferentes.

Si la descripción menciona dónde está el problema, qué pasa, o cualquier síntoma observable → NO_QUESTIONS

Respondé SOLO con la pregunta o NO_QUESTIONS. Sin explicaciones.`,
    },
    {
      key: 'technical_brief',
      description: 'Genera un brief técnico para el profesional asignado a un pedido',
      variables: ['categoryName', 'description', 'clarificationAnswer'],
      isEditable: true,
      defaultContent: `Sos un asistente experto en servicios del hogar en Argentina.
Genera un brief tecnico CORTO (maximo 3 lineas) para un profesional {{categoryName}} que va a atender este pedido.

Descripcion del usuario: "{{description}}"
{{clarificationAnswer}}
El brief debe incluir:
- Que es el problema en terminos tecnicos
- Detalles relevantes para el profesional
- Nivel de urgencia si aplica

Responde solo el brief, sin saludos ni explicaciones.`,
    },
    {
      key: 'extract_name',
      description: 'Extrae el nombre completo de una persona de un mensaje de WhatsApp',
      variables: ['input'],
      isEditable: false,
      defaultContent: `Extraé el nombre completo de la persona del siguiente mensaje. Incluí apellido si está presente.
Si no hay ningún nombre de persona, respondé exactamente: null
Respondé SOLO el nombre, sin explicaciones ni puntuación.

Ejemplos:
- "Hola nora, soy Enrique Quipuzcoa" → "Enrique Quipuzcoa"
- "Me llamo María López Torres" → "María López Torres"
- "mi nombre es carlos" → "carlos"
- "Hola nora" → null
- "Hola soy Juan" → "Juan"
- "buenos dias" → null

Mensaje: "{{input}}"`,
    },
    {
      key: 'validate_description_match',
      description: 'Valida si la descripción del usuario coincide con el servicio solicitado',
      variables: ['categoryName', 'description'],
      isEditable: true,
      defaultContent: `Sos un validador de servicios del hogar en Argentina.

Servicio solicitado: {{categoryName}}
Descripcion: "{{description}}"

Analiza si la descripcion tiene relacion con el servicio:
- INVALIDO: el problema describe CLARAMENTE un oficio completamente distinto (ej: pedir electricista y describir perdida de agua, pedir pintor y describir problema de gas)
- INCIERTO: hay ambiguedad razonable, podria relacionarse con el servicio pero no es claro
- VALIDO: la descripcion tiene relacion directa o indirecta con el servicio

Responde SOLO con una palabra: VALIDO, INVALIDO o INCIERTO`,
    },
    {
      key: 'clean_address',
      description: 'Extrae la dirección limpia eliminando frases introductorias',
      variables: ['rawText'],
      isEditable: false,
      defaultContent: `El usuario escribió lo siguiente como dirección de su domicilio: "{{rawText}}"

Tu tarea: extraer únicamente la dirección limpia, sin frases introductorias como "es en", "está en", "vivo en", "la dirección es", "quiero en", etc.

Si el texto ya es una dirección limpia, devolvela tal cual.
Si no podés identificar una dirección válida, devolvé el texto original sin cambios.

Respondé SOLO con la dirección limpia. Sin explicaciones.`,
    },
    {
      key: 'detect_cancellation_intent',
      description: 'Detecta si el usuario expresa intención de cancelar un pedido o visita',
      variables: ['text'],
      isEditable: true,
      defaultContent: `El usuario escribió: "{{text}}"
¿Está expresando intención de cancelar un pedido o visita?
Respondé SOLO: SI o NO`,
    },
    {
      key: 'resolve_option',
      description: 'Resuelve a qué opción se refiere el usuario entre varias disponibles',
      variables: ['input', 'optionsList'],
      isEditable: true,
      defaultContent: `Sos NORA, asistente de WhatsApp en Argentina. El usuario está respondiendo a una pregunta con opciones.

El usuario escribió: "{{input}}"

Opciones disponibles:
{{optionsList}}

¿A cuál opción se refiere el usuario? Respondé SOLO con el valor exacto (ej: YES, NO, ACCEPT, CONFIRM, etc.) o "null" si genuinamente no está claro.`,
    },
    {
      key: 'generate_off_topic_response',
      description: 'Genera una respuesta cordial cuando el usuario envía un mensaje fuera de contexto',
      variables: ['input', 'stepContext'],
      isEditable: true,
      defaultContent: `Sos NORA, un asistente de WhatsApp que conecta usuarios con profesionales del hogar en Argentina.

El usuario escribió: "{{input}}"

Contexto actual: {{stepContext}}

Determiná si el mensaje es:
1. OFF_TOPIC: un saludo, pregunta sobre vos, comentario casual, o algo no relacionado con el pedido
2. ON_TOPIC: un intento de responder al contexto actual aunque mal escrito

Si es OFF_TOPIC, generá una respuesta corta y cordial en español rioplatense que:
- Responda brevemente al comentario (ej: si saluda, saludar de vuelta)
- Recuerde el contexto actual
- No supere 2 líneas

Si es ON_TOPIC, respondé exactamente: ON_TOPIC

Respondé ÚNICAMENTE con el texto de la respuesta cordial, sin ningún prefijo como "OFF_TOPIC:" ni numeración. Si el mensaje es ON_TOPIC, respondé exactamente: ON_TOPIC`,
    },
    {
      key: 'analyze_feedback',
      description: 'Analiza el sentimiento de un comentario de feedback de un cliente',
      variables: ['comment'],
      isEditable: true,
      defaultContent: `Analizá este comentario de un cliente sobre un trabajo: "{{comment}}"
Respondé SOLO con un JSON válido sin markdown:
{"puntualidad":1,"precio_justo":0,"calidad_trabajo":1,"limpieza":0,"actitud":1,"recomendable":true}
Valores: 1=positivo, -1=negativo, 0=no mencionado. recomendable: true/false/null`,
    },
    {
      key: 'extract_working_hours',
      description: 'Extrae el horario de inicio y fin de trabajo de un texto del profesional',
      variables: ['inputText'],
      isEditable: false,
      defaultContent: `Extraé el horario de inicio y fin de trabajo de este texto: "{{inputText}}"
Devolvé SOLO un JSON con este formato exacto:
{"from": "HH:MM", "to": "HH:MM"}
Si no podés determinarlo con certeza, devolvé: {"error": "ambiguo"}
Ejemplos válidos de entrada:
- "de 8 a 18" → {"from": "08:00", "to": "18:00"}
- "de 9 a 17:30" → {"from": "09:00", "to": "17:30"}
- "mañana y tarde" → {"error": "ambiguo"}
- "8 a 6 de la tarde" → {"from": "08:00", "to": "18:00"}`,
    },
  ];

  for (const tpl of templates) {
    await prisma.promptTemplate.upsert({
      where: { key: tpl.key },
      update: {
        content: tpl.defaultContent,
        defaultContent: tpl.defaultContent,
        description: tpl.description,
        variables: tpl.variables,
        isEditable: tpl.isEditable,
      },
      create: {
        key: tpl.key,
        content: tpl.defaultContent,
        defaultContent: tpl.defaultContent,
        description: tpl.description,
        variables: tpl.variables,
        isEditable: tpl.isEditable,
      },
    });

    // eslint-disable-next-line no-console
    console.log(`Prompt template "${tpl.key}" seeded successfully.`);
  }
}

async function main(): Promise<void> {
  await seedAdmin();
  await seedArgentinaGeoHierarchy();
  await seedMendozaCoordinates();
  await seedSystemConfig();
  await seedPlans();
  await seedCategories();
  await seedPromptTemplates();
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
