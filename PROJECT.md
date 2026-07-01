# NORA - Plataforma de Conexión

## Stack

| Componente     | Tecnología            |
|---------------|----------------------|
| Runtime       | Node.js              |
| Lenguaje      | TypeScript (strict)  |
| Framework HTTP | Express 5           |
| ORM           | Prisma               |
| Base de datos | PostgreSQL           |
| Auth          | JWT                  |
| Frontend      | Vite + React 19 + Tailwind CSS 4 + react-router-dom + Recharts |
| Linter        | ESLint + Prettier    |

## Architecture

```
noraconecta/                   # Monorepo root (npm workspaces)
├── backend/
│   ├── src/
│   │   ├── server.ts                  # Entry point: Express app bootstrap
│   │   ├── lib/
│   │   │   ├── prisma.ts              # Prisma client singleton
│   │   │   ├── r2-client.ts           # Cloudflare R2 client (presigned URLs + direct upload)
│   │   │   ├── llm.ts                 # LLM client: parseScheduledAt (obsoleto para coordinación desde AUT-166, conservado para otros usos potenciales)
│   │   │   ├── llm-client.ts          # LLM Client unificado: callLLM multi-proveedor (OpenAI / Anthropic, AUT-242) + callLLMWithImages multimodal (gpt-4o-mini vision, AUT-274) + transcribeAudio (Whisper/GPT, AUT-302) + compareAddresses (validación de direcciones vía LLM, AUT-306) + extractServiceAndZone (extracción servicio/zona vía LLM, AUT-308) + extractName (extracción de nombre vía LLM, AUT-309) + userRequestsLicenseByLLM (detección LLM de intención de usuario de pedir matriculado, AUT-343)
│   │   │   └── whatsapp-adapter.ts    # WhatsApp Business API adapter: parseo de webhooks, envío de mensajes, templates con validación de 1 template por 24hs (AUT-134, AUT-226, AUT-272). Modo simulador automático cuando tokens vacíos (AUT-267). Encola en simulatorQueue cuando modo simulador activo (AUT-268)
│   │   │   └── simulator-queue.ts     # Cola en memoria para mensajes enviados en modo simulador: SimulatorQueue con enqueue/dequeue por phone+role, máx 100 mensajes (AUT-268)
│   │   ├── middleware/
│   │   │   ├── error-handler.ts       # Global error handler (AppError, 500 fallback)
│   │   │   ├── require-auth.ts        # JWT validation middleware
│   │   │   └── require-super-admin.ts # SUPERADMIN role guard
│   │   ├── utils/
│   │   │   ├── jwt.ts                 # signToken / verifyToken
│   │   │   ├── date-utils.ts          # ParseDateTimeResult type + parseExactDate (DD/MM HH) + parseDateTimeNatural (lenguaje natural con LLM, discriminated union con reason 'past'|'ambiguous', AUT-237, AUT-248) + getDayArgentina, getHoursArgentina, getMinutesArgentina, formatDateTimeArgentina (formato completo: "miércoles 10 de junio a las 10:00", AUT-166, AUT-167, AUT-247)
│   │   │   ├── whatsapp-templates.ts  # Constantes de template names para WhatsApp (actualizado AUT-295, AUT-297, AUT-331, AUT-330). TEMPLATE_PRO_NUEVO_PEDIDO_SIN_MEDIA: template sin media con botones Aceptar/Ahora no puedo (AUT-301). MEMBERSHIP_RENEWED_TEMPLATE: template de renovación de membresía (AUT-331). MEMBERSHIP_EXPIRY_REMINDER_TEMPLATE: template de membresía por vencer (AUT-330). LICENSE_REJECTED_TEMPLATE: template de credencial rechazada con CTA de re-subida (AUT-335). TEMPLATE_PRO_FELICITACION_CALIFICACION: template de felicitación al profesional por feedback positivo (AUT-367)
│   │   │   └── whatsapp-utils.ts      # shouldUseTemplate(): helper de ventana de 24hs WhatsApp. canSendTemplate(): valida que no se haya enviado template en las últimas 24hs (AUT-171, AUT-272). Usado en webhooks.routes.ts para pendingNotification (AUT-374)
│   │   ├── types/
│   │   │   └── express.d.ts           # Express Request augmentation (req.admin)
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── auth.routes.ts     # POST /auth/login, POST /auth/logout, GET /auth/me
│   │   │   │   ├── auth.controller.ts # Login cookie httpOnly + logout + me
│   │   │   │   ├── auth.service.ts    # Login logic, bcrypt comparison, JWT signing, getAdminById
│   │   │   │   └── auth.repository.ts # Prisma queries for Admin model
│   │   │   ├── categories/
│   │   │   │   ├── categories.routes.ts     # 6 endpoints under /categories
│   │   │   │   ├── categories.controller.ts # Request validation, response formatting
│   │   │   │   ├── categories.service.ts    # Slug generation, Levenshtein matching, create/update aceptan requiresLicense y licenseLabel — AUT-324
│   │   │   │   └── categories.repository.ts # Prisma queries for Category model
│   │   │   ├── locations/
│   │   │   │   ├── locations.routes.ts     # 7 endpoints under /locations
│   │   │   │   ├── locations.controller.ts # Request validation, response formatting
│   │   │   │   ├── locations.service.ts    # Geo hierarchy business logic
│   │   │   │   └── locations.repository.ts # Prisma queries for GeoLevel/GeoNode
│   │   │   ├── users/
│   │   │   │   ├── users.routes.ts         # 4 endpoints under /users
│   │   │   │   ├── users.controller.ts     # Request validation, response formatting
│   │   │   │   ├── users.service.ts        # findOrCreateByPhone, isBlocked, block/unblock, updateName
│   │   │   │   └── users.repository.ts     # Prisma queries for User model + updateName
│   │   │   └── professionals/
│   │   │       ├── professionals.routes.ts     # 19 endpoints under /professionals. PATCH /session/:token/profile — AUT-356. GET /session/:token/departments — AUT-356. POST /admin-create — AUT-351, AUT-354. PATCH /:id (adminUpdate) — AUT-355. PATCH /:id/license-status — AUT-324. GET /session/:sessionToken/earnings — AUT-327. GET /session/:sessionToken/membership-discount — AUT-329. GET /:id/current-plan — AUT-348. DELETE /:id/membership — AUT-353. GET /data-changes/professionals: profesionales con cambios pendientes — AUT-359
│   │   │       ├── professionals.controller.ts # Request validation, response formatting. updateProfile: edición de perfil autenticada por session token — AUT-356. getSessionDepartments: departamentos disponibles para edición — AUT-356. adminCreate: alta directa de profesional con disponibilidad opcional — AUT-351, AUT-354. adminUpdate: edición completa con zonas, disponibilidad y archivos — AUT-355. updateLicenseStatus — AUT-324. getEarnings: endpoint de ganancias — AUT-327. getMembershipDiscount — AUT-329. verify soporta ?mode=license para re-subida de credencial — AUT-335. getCurrentPlan: endpoint público de plan activo — AUT-348. cancelMembership: cancelación de membresía activa — AUT-353. getProfessionalsWithPendingChanges: IDs de profesionales con cambios sensibles pendientes — AUT-359
│   │   │       ├── professionals.service.ts    # Register, verify, approve (con window-check), reject, suspend, session, panel. adminCreate: alta directa de profesional en ACTIVE con zonas y disponibilidad opcional (availability + availabilityStructured) — AUT-351, AUT-354. adminUpdate: edición completa de profesional con zonas, disponibilidad y archivos, compara valores reales contra DB y registra previousValues/newValues solo en campos con cambio real — AUT-355, AUT-359. Welcome message con estructura clara, bullet points y ranking system — AUT-300. getEarnings: endpoint dedicado de ganancias por rango de días — AUT-327. getMembershipDiscount: consulta de descuento de membresía desde SystemConfig con validación de expiración — AUT-329. updateLicenseStatus: aprobación/rechazo de credencial por admin; notifica al profesional vía WhatsApp cuando se rechaza con nuevo token y CTA de re-subida — AUT-324, AUT-335. submitLicenseResubmission: re-subida de credencial vía token con ?mode=license — AUT-335. sendWithWindowCheck: helper de envío con template/text según ventana 24hs — AUT-335. getVerificationTokenStatus extendido con requiresLicense, licenseLabel, declaredHasLicense; submitVerification acepta licenseUrl — AUT-323. getPanelData incluye userComments anónimos en reputación — AUT-345, trialRequestsLimit leído desde SystemConfig en vez de hardcodeado — AUT-349, dniNumber, licenseUrl, declaredHasLicense, availabilityStructured — AUT-356. getCurrentPlan: devuelve el plan activo del profesional vía MembershipsService — AUT-348
│   │   │       └── professionals.repository.ts # Prisma queries for Professional/ProfessionalZone (includes category, zones with geoNode), panel data, orders. findEarnings: aggregate de RequestPricing.amountPaid — AUT-327. updateLicenseStatus: persiste estado de credencial — AUT-324. findByVerificationToken incluye category para requiresLicense/licenseLabel — AUT-323. findById ahora incluye category en el tipo de retorno — AUT-335. createDataChangeRequest: acepta previousValues y newValues — AUT-358, AUT-359. findPendingDataChangeRequests: incluye previousValues y newValues en el retorno — AUT-359. getProfessionalsWithPendingChanges: IDs de profesionales con cambios PENDING — AUT-359
│   │   │   ├── admin/
│   │   │   │   ├── admin.routes.ts     # GET /admin/metrics (filtro por ?geoNodeId), GET /admin/geo-tree, POST /admin/requests/auto-close, GET /admin/membership-discount, POST /admin/membership-discount — AUT-334
│   │   │   │   ├── admin.controller.ts # Request handling + query params. getMembershipDiscount, setMembershipDiscount — AUT-334
│   │   │   │   ├── admin.service.ts    # Aggregates metrics from multiple entities, supports geoNodeId filtering. getMembershipDiscount, setMembershipDiscount con ConfigRepository — AUT-334
│   │   │   │   └── admin.repository.ts # Prisma aggregate queries with optional geoNodeId filter
│   │   │   ├── plans/
│   │   │   │   ├── plans.routes.ts     # 4 endpoints under /plans (GET, POST, PATCH, DELETE)
│   │   │   │   ├── plans.controller.ts # Request validation, response formatting. create/update aceptan features, deactivate endpoint — AUT-340
│   │   │   │   ├── plans.service.ts    # Plan CRUD, price validation, features array, name uniqueness check on update, deactivate — AUT-340
│   │   │   │   └── plans.repository.ts # Prisma queries for Plan model. CreatePlanInput/UpdatePlanInput extendidos con features, método deactivate — AUT-340
│   │   │   ├── memberships/
│   │   │   │   ├── memberships.routes.ts     # GET /professionals/:id/membership (requireAuth), POST /professionals/:id/membership (requireSuperAdmin) — AUT-350
│   │   │   │   ├── memberships.controller.ts # Request validation, response formatting
│   │   │   │   ├── memberships.service.ts    # canReceiveRequests, activateMembership, getStatus, getActiveMembership (AUT-331). cancelMembership — AUT-353. sendExpirationReminders: cron diario de notificación de vencimiento con sendWithWindowCheck (AUT-330)
│   │   │   │   └── memberships.repository.ts # Prisma queries for Membership/Professional models + findExpiringMemberships, markReminderSent, clearExpiredReminderFlags (AUT-330). updateStatus extendido con CANCELED — AUT-353
│   │   │   ├── config/
│   │   │   │   ├── config.routes.ts     # 2 endpoints under /config
│   │   │   │   ├── config.controller.ts # Request validation, response formatting
│   │   │   │   ├── config.service.ts    # Key-value config get/update
│   │   │   │   └── config.repository.ts # Prisma queries for SystemConfig model
│   │   │   ├── matching/
│   │   │   │   ├── matching.service.ts    # Scoring ponderado + filtros duros + disponibilidad contextual + especialización + sistema híbrido keywords+LLM de detección de matrícula con priorización en score (AUT-235, AUT-240, AUT-251, AUT-343) + Regla 1: profesional preferido por historial positivo (wouldRecommend:true + rating≥4) — AUT-366 + Regla 2: exclusión de profesionales con wouldRecommend:false — AUT-366. userId parámetro opcional en findBestCandidate
│   │   │   │   └── matching.repository.ts # Prisma queries para motor de matching + getSentimentScores + getProfessionalAvailability (AUT-235, AUT-251) + findPreferredProfessional + findExcludedProfessionals por historial usuario-profesional (AUT-366)
│   │   │   ├── requests/
│   │   │   │   ├── requests.routes.ts     # 10 endpoints under /requests
│   │   │   │   ├── requests.controller.ts # Request validation, response formatting
│   │   │   │   ├── requests.service.ts    # Request lifecycle, matching, reassignment, timeouts (cron log + CREATED→NO_RESPONSE notification, AUT-287) + technicalBrief support + análisis LLM síncrono en create() (AUT-251) + persistencia de barrio y código postal desde Nominatim (AUT-307) + pasa userId en los 6 llamados a findBestCandidate (AUT-366)
│   │   │   │   └── requests.repository.ts # Prisma queries for Request/RequestEvent/Feedback + CreateRequestInput con technicalBrief + findActivesByProfessionalId (AUT-298)
│   │   │   ├── reputation/
│   │   │   │   ├── reputation.service.ts    # Automatic penalizations, badge evaluation, getReputationBreakdown, getUserComments (AUT-345)
│   │   │   │   └── reputation.repository.ts # NOT_FULFILLED counting, status/badge updates, findFeedbackBreakdown, findUserComments (AUT-345)
│   │   │   ├── escalations/
│   │   │   │   ├── escalations.routes.ts     # 4 endpoints under /escalations
│   │   │   │   ├── escalations.controller.ts # Request validation, response formatting
│   │   │   │   ├── escalations.service.ts    # Escalation lifecycle, status transitions
│   │   │   │   └── escalations.repository.ts # Prisma queries for Escalation model
│   │   │   └── notifications/              # (AUT-195, AUT-199, AUT-295, AUT-297, AUT-301, AUT-343)
│   │   │       └── notification.service.ts   # WhatsApp dispatch with smart template/text strategy. Photos/audio deferred: sent only when professional asks for details via CoordinationService.sendRequestMedia (AUT-281). Description mismatch notification: notifyUserDescriptionMismatch + notifyUserConfirmService (AUT-295). Cancel confirmation: notifyUserCancelConfirmation (AUT-297). notifyProfessionalWithDetails usa TEMPLATE_PRO_NUEVO_PEDIDO_SIN_MEDIA con botones Aceptar/Ahora no puedo cuando no hay media (AUT-301). notifyUserRequestAccepted incluye badge "✓ Profesional matriculado" cuando aplica (AUT-343). notifyProfessionalPositiveFeedback: mensaje de felicitación cuando el usuario califica con wouldRecommend=true y rating>=4 (AUT-367)
│   │   │   └── storage/
│   │   │       ├── storage.routes.ts     # POST /storage/presign-upload
│   │   │       ├── storage.controller.ts # Request validation, response formatting
│   │   │       └── storage.service.ts    # Folder/contentType validation, R2 delegation
│   │   │   ├── bot/
│   │   │   │   ├── bot.routes.ts         # POST /bot/message, POST /bot/session/reset
│   │   │   │   ├── bot.controller.ts     # Request validation, response formatting + pendingNotification dispatch para simulador (AUT-281)
│   │   │   │   ├── bot.service.ts        # Message processing, flow dispatch, session management, pending notifications, cancellation detection with LLM fallback for USER and PROFESSIONAL roles (AUT-169, AUT-296, AUT-298), ver_como_funciona handler (AUT-266) + intercepción inteligente de servicio/zona en mensaje inicial (AUT-308) + extracción de nombre en paralelo con servicio/zona para usuarios nuevos (AUT-309) + POST_CANCEL flow en cancelación sin Request activo (AUT-310) + capa de seguridad (rate limiting + anti prompt injection) como primera línea de processMessage (AUT-312) + pre-filtro determinístico hasActionableContent para evitar LLM calls en saludos simples (AUT-314) + extracción LLM para usuarios recurrentes sin flujo activo (AUT-317). shouldKeepRegisterSession y session upsert protegen ASK_LICENSE_EARLY: no pisan la sesión ni bloquean al profesional durante la pregunta de credencial — AUT-323 + detección por keywords de intención de acceder al panel con respuesta de link directo vía session token (AUT-339) + resolveProfessionalState: control de frecuencia (máx 1 respuesta por día) y LLM contextual para ACTIVE/OBSERVATION fuera de flujo (AUT-360) + respuesta cordial para usuario sin sesión ni flujo activo cuando hasActionableContent es false, sin invocar LLM (AUT-363)
│   │   │   │   ├── bot.repository.ts     # Prisma queries for BotSession model + wasTemplateSentInLast24h/setLastTemplateSentAt (AUT-272)
│   │   │   │   ├── security.repository.ts # Prisma queries for BotSecurity model: findByPhone, upsertMessageCount, incrementSuspiciousCount, blockUntil, clearBlock (AUT-312)
│   │   │   │   ├── security.service.ts   # Security layer: rate limiting (10 msg/min in-memory, async DB write) + prompt injection detection (precompiled RegExp patterns, 3 suspicious → 1hr block) + temporary block check (AUT-312)
│   │   │   │   ├── coordination.service.ts # Visit coordination relay: init after accept, send reminders, work-completion checks, confirmVisit con parseDateTimeNatural (AUT-248) y GPS opcional cuando userLatitude es null (AUT-315), notifyProfessionalVisitConfirmed envía directamente al profesional con sendWithWindowCheck usando templates nora_pro_visita_confirmada o nora_pro_visita_confirmada_ubicacion según corresponda (AUT-380). sendRequestMedia deprecado: el envío de fotos/audio en "Ver detalles" ahora lo maneja webhooks.routes.ts via mediaFirst (AUT-290). notifyWorkFinished simplificado: mensaje de rating 1-5 sin botones, step inicial FEEDBACK_RATING (AUT-318)
│   │   │   │   ├── nlp.service.ts        # NLP: category/zone resolution with Levenshtein (only used by user-request flow since AUT-234)
│   │   │   │   ├── abuse-detection.service.ts # Sistema anti-abuso: detección de cancelaciones repetidas y degradación gradual de usuarios/profesionales (AUT-243)
│   │   │   │   ├── constants/
│   │   │   │   │   └── bot-payloads.ts   # BOT_PAYLOADS: constantes centralizadas de todos los payloads de botones WhatsApp (AUT-266, AUT-295)
│   │   │   │   ├── flows/
│   │   │   │   │   ├── types.ts          # Type definitions for flows. BotResponse incluye mediaFirst para control de orden de envío (AUT-290). SavedLocation interface para multi-dirección guardada (AUT-306). PendingNotification con templateName/templateParams opcionales para templates específicos (AUT-374)
│   │   │   │   │   ├── user-request.flow.ts        # USER_REQUEST flow: INIT → ASK_NAME → ASK_SERVICE → ASK_SAVED_LOCATION → ASK_LOCATION (GPS/Nominatim → department) → ASK_PROVINCE/ASK_ZONE (fallback) → ASK_DESCRIPTION → DESCRIPTION_MISMATCH → CLARIFICATION → ASK_PHOTOS → ASK_AUDIO → CONFIRM → SEARCHING/WAITING → POST_CANCEL (AUT-310). La ubicación se resuelve justo después del servicio. Si el usuario comparte GPS, Nominatim resuelve departamento automáticamente. Si tiene savedLocations, se le ofrece reutilizar una dirección. Si no, cae al flujo de zona manual (AUT-306) + handlers para payloads de botones + generateClarificationQuestions (LLM, AUT-280, AUT-376) + generateTechnicalBrief (LLM, AUT-280) + validateDescription (LLM, 3 niveles: VALID/INVALID/UNCERTAIN, AUT-280, AUT-288) + validateClarificationAnswer (LLM, AUT-280) + handleDescriptionMismatch permite cambiar servicio o reformular (AUT-288) + proceedAfterService saltea zona si ya está definida (AUT-288) + extractName con LLM en handleAskName (AUT-301) + mensajes simplificados: "no" reemplaza "continuar"/"omitir" en fotos/audio/ubicación (AUT-301) + transcripción de audio en ASK_DESCRIPTION via transcribeAudio: si usuario manda audio se transcribe como descripción y se saltea ASK_AUDIO (AUT-302) + resolveExtractedServiceZone y handleAskService con extracción inteligente de servicio/zona del mensaje inicial: saltea pasos ya respondidos, notifica servicio/zona inexistentes (AUT-308) + handleInit con pedido activo: respuesta contextual por estado (CREATED/ASSIGNED/ACCEPTED) en vez de ASK_PHOTOS (AUT-363) + handleAskService: saludo "Qué bueno volver a verte" limitado a 1 vez por día vía lastGreetingAt en tempData (AUT-363) + proceedAfterService: humaniza mensajes de confirmación ("Entendido" → "¡Perfecto!"), filtra savedLocations por geoNodeId coincidente cuando zona ya fue detectada por LLM y solo ofrece direcciones de la misma zona (AUT-372) + handleClarification/handleAskPhotos/handleAskAudio: saltea pregunta de audio cuando la descripción por texto ya es completa según LLM, flag _descriptionIsComplete (AUT-375)
│   │   │   │   │   ├── professional-register.flow.ts # PROFESSIONAL_REGISTER flow (numbered category list from DB — AUT-234; structured availability: days + unified hours LLM parsing — AUT-238, AUT-249; per-day availability with differentiated schedules — AUT-321; UX improvements: warm greeting, bulleted zones list — AUT-300; ASK_LICENSE_EARLY step condicional después de selección de servicio: pregunta credencial si category.requiresLicense, guarda _declaredHasLicense en tempData y persiste en saveAvailabilityAndAdvance — AUT-323; extractName LLM en handleAskName — AUT-338)
│   │   │   │   │   ├── coordination.flow.ts  # COORDINATION: visit scheduling relay flow (AUT-247: confirmación antes de avanzar, mensajes sin ejemplos; AUT-248: mensajes diferenciados past/ambiguous, clientAvailability con fecha formateada; AUT-290: mediaUrls/audioUrl/mediaFirst en handleAwaitingAcceptance en vez de sendRequestMedia; AUT-291: PROPOSE_ALTERNATIVE en handleAwaitingConfirmation; AUT-294: off-topic detection en 6 steps con resolveOptionWithFallback; AUT-301: handleAwaitingAcceptance sin media muestra Aceptar/Ahora no puedo directo sin "Ver detalles"). AWAITING_GPS: paso previo opcional cuando userLatitude es null, guarda coords y barrio vía Nominatim async, chequea clientAddress pre-llenado antes de pedir dirección (AUT-317), avanza a AWAITING_LOCATION (AUT-315). AWAITING_LOCATION: savedLocations con sugerencias por geoNodeId, comparación LLM de direcciones (compareAddresses), upsert con límite configurable USER_MAX_SAVED_LOCATIONS, pre-llenado de clientAddress desde savedLocation reutilizada (AUT-306). notifyProfessionalVisitConfirmed se llama con await + professionalPhone en 4 instancias, response.text vacío porque el envío lo hace el método directamente con templates específicos (AUT-380). finalizeLocation: mensaje condicional explícito cuando el profesional confirma propuesta de horario del usuario vía flag _confirmedByProfessional (AUT-373). pendingNotification: usa templateName/templateParams específicos por caso (5 casos) en vez del genérico nora_notification (AUT-374)
│   │   │   │   │   ├── feedback.flow.ts      # FEEDBACK: work completion + bilateral rating flow + sentiment analysis (AUT-216, AUT-235). Flujo simplificado a 4 mensajes: satisfaction derivado automáticamente del rating (1-2 → UNSATISFIED, 3 → PARTIAL, 4-5 → SATISFIED), eliminando step FEEDBACK_SATISFACTION (AUT-318). Off-topic detection en FEEDBACK_RECOMMEND, FEEDBACK_PRO_RECOMMEND (AUT-294). Captura de precio pagado via FEEDBACK_AMOUNT step (AUT-316). NotificationService inyectado para notifyProfessionalPositiveFeedback: felicitación al profesional cuando el feedback del usuario es positivo (AUT-367). Template condicional en handleFeedbackRecommend según feedback: nora_pro_felicitacion_calificacion cuando wouldRecommend y rating >= 4, sino nora_pro_pedir_calificacion_usuario. Notificación al profesional disparada inmediatamente después de FEEDBACK_RECOMMEND, sin depender de pasos opcionales (precio/comentario) (AUT-370, AUT-371)
│   │   │   │   │   ├── cancel-flow.helper.ts  # Shared cancellation confirmation logic (AUT-296: avoids re-entry loop + friendly error on duplicate cancel; AUT-297: numbered options + sendWithWindowCheck via NotificationService for template fallback; AUT-298: LLM-based cancellation intent detection + professional role support in handleCancelConfirmation)
│   │   │   │   │   ├── location-saver.helper.ts # Gestión de savedLocations: upsert con comparación LLM de direcciones (compareAddresses), touch (mover al frente), findLocationsByGeoNode. Límite configurable vía SystemConfig USER_MAX_SAVED_LOCATIONS (default 5) (AUT-306)
│   │   │   │   │   ├── option-resolver.helper.ts # Shared step option resolver con 3 capas: match exacto contra aliases + comparación normalizada contra label + LLM fallback con prompt mejorado (AUT-313). StepOption con campo label obligatorio. normalizeText helper (NFD sin acentos ni puntuación). AWAITING_ACCEPTANCE: '1' → VER_DETALLES (muestra detalles), ACCEPT solo por texto (AUT-281) + alias 'aceptar_pedido' (AUT-301). AWAITING_CONFIRMATION: '2' → PROPOSE_ALTERNATIVE (AUT-291). CANCEL_CONFIRMATION: 'cancelar_pedido'/'no_cancelar' payloads (AUT-297). DESCRIPTION_MISMATCH: CHANGE_SERVICE/REFORMULATE/SI_CORRECTO (AUT-288, AUT-295). ASK_SAVED_LOCATION_SINGLE: YES/NO (AUT-306). POST_CANCEL: NEW_REQUEST/NO con aliases determinísticos sin LLM (AUT-310). generateOffTopicResponse: detección LLM de mensajes off-topic con respuesta cordial + recordatorio de contexto (AUT-294) + SIMPLE_GREETINGS: filtro determinístico de saludos para evitar LLM calls (AUT-363)
│   │   │   │   │   └── flow-handler.factory.ts     # Flow handler resolution. UserRequestFlow recibe NotificationService (AUT-295). CoordinationFlow recibe UsersRepository + ConfigRepository + NotificationService (AUT-306). ProfessionalRegisterFlow recibe CategoriesRepository (AUT-323). FeedbackFlow recibe NotificationService (AUT-367)
│   │   │   ├── payments/                # (AUT-188)
│   │   │   │   ├── payments.routes.ts     # POST /webhooks/mercadopago (webhook), POST /payments/link
│   │   │   │   ├── payments.controller.ts # Webhook validation + async dispatch, payment link endpoint
│   │   │   │   ├── payments.service.ts    # Payment link generation, webhook processing (con detección de renovación, AUT-331), trial-exhausted notification
│   │   │   │   └── payments.repository.ts # Plan queries, trial-exhausted professional lookup, waiting request lookup
│   │   ├── lib/
│   │   │   ├── prisma.ts              # Prisma client singleton
│   │   │   ├── r2-client.ts           # Cloudflare R2 client (presigned URLs + direct upload)
│   │   │   ├── llm.ts                 # LLM client: parseScheduledAt (obsoleto para coordinación desde AUT-166, conservado para otros usos potenciales)
│   │   │   ├── llm-client.ts          # LLM Client unificado: callLLM multi-proveedor (OpenAI / Anthropic, AUT-242) + callLLMWithImages multimodal (gpt-4o-mini vision, AUT-274) + transcribeAudio (Whisper/GPT, AUT-302) + compareAddresses (validación de direcciones vía LLM, AUT-306) + extractServiceAndZone (extracción servicio/zona vía LLM, AUT-308) + extractName (extracción de nombre vía LLM, AUT-309) + userRequestsLicenseByLLM (detección LLM de intención de usuario de pedir matriculado, AUT-343)
│   │   │   ├── nominatim-client.ts     # Nominatim reverse geocoding: resolve GPS coordinates to department name, neighborhood and postal code (AUT-306, AUT-307)
│   │   │   ├── whatsapp-adapter.ts    # WhatsApp Business API adapter: parseo de webhooks, envío de mensajes, templates con botón URL (AUT-134, AUT-226), quick reply buttons (AUT-229), quick reply buttons (AUT-229)
│   │   │   └── mercadopago-client.ts  # MercadoPago SDK wrapper: createPaymentLink, fetchPayment (AUT-188)
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── .eslintrc
│   ├── .prettierrc
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── main.tsx                    # Entry point: React 19 root (dev mode)
│   │   ├── main-landing.tsx            # Entry point: landing build (noraconecta.com.ar)
│   │   ├── main-admin.tsx              # Entry point: admin build (admin.noraconecta.com.ar)
│   │   ├── main-app.tsx                # Entry point: app build (app.noraconecta.com.ar)
│   │   ├── App.tsx                     # Root component (dev): host-based routing — all routes on localhost, context-aware on subdomains
│   │   ├── App-landing.tsx             # Root component (landing): /simulator only
│   │   ├── App-admin.tsx               # Root component (admin): /admin/* only (production build)
│   │   ├── App-app.tsx                 # Root component (app): /verify/:token, /panel/:sessionToken, /planes (production build)
│   │   ├── index.css                   # Tailwind CSS directives + design tokens
│   │   ├── vite-env.d.ts               # Vite client type reference
│   │   ├── components/
│   │   │   └── chat/
│   │   │       ├── ChatHeader.tsx      # Header with title, phone selector, session status, reset
│   │   │       ├── ChatInput.tsx       # Message input bar with image/audio icons and send button
│   │   │       ├── MessageBubble.tsx   # Individual message bubble (user: emerald right, NORA: slate left)
│   │   │       ├── MessageList.tsx     # Scrollable message list with auto-scroll
│   │   │       ├── PhoneSelector.tsx   # Dropdown to switch between test phones/roles
│   │   │       ├── SessionStatus.tsx   # Pill badge showing active flow and step
│   │   │       ├── EmptyState.tsx      # Centered empty state with icon and instructions
│   │   │       └── TypingIndicator.tsx # Animated typing dots with "Procesando..." label
│   │   ├── hooks/
│   │   │   └── useChat.ts             # Chat state management: messages, loading, session, API calls. Polling de mensajes externos del simulador cada 2s vía /simulator/messages (AUT-268)
│   │   ├── lib/
│   │   │   ├── api.ts                 # REST client for /bot/message, /bot/session/reset, /storage/presign-upload
│   │   │   ├── admin-api.ts           # REST client for all admin endpoints. adminCreateProfessional: alta directa de profesional con disponibilidad opcional — AUT-351, AUT-354. updateProfessional, uploadProfessionalFile: edición de profesional con upload de archivos — AUT-355. getMembershipDiscountConfig, setMembershipDiscount — AUT-334. getCurrentPlan: consulta de plan activo — AUT-348. cancelMembership: cancelación de membresía — AUT-353. getPendingDataChanges: incluye previousValues y newValues — AUT-359. getProfessionalsWithPendingChanges: IDs de profesionales con cambios pendientes — AUT-359
│   │   │   ├── onboarding-api.ts      # API client for professional onboarding. submitVerification incluye licenseUrl — AUT-323. submitLicenseResubmission: re-subida de credencial vía ?mode=license — AUT-335
│   │   │   ├── panel-api.ts           # REST client for professional panel. updateProfile (PATCH), uploadProfileFile (R2 presigned), getDepartments (session-authenticated) — AUT-356
│   │   │   ├── host.ts                # Hostname detection: resolveHostContext(), getAdminDashboardPath() (NEW)
│   │   │   └── brand.ts               # Brand config: name, fullName, tagline, url from env (AUT-187)
│   │   ├── types/
│   │   │   ├── chat.ts                # TypeScript interfaces for messages, responses
│   │   │   ├── onboarding.ts          # OnboardingStep (incluye 'license'), FileUploadInfo, OnboardingFormData (incluye licenseUrl), TokenValidationResponse (incluye requiresLicense, licenseLabel, declaredHasLicense) — AUT-323
│   │   │   ├── admin.ts               # Interfaces for all admin entities (Professional, User, Request, Escalation, etc.) + MembershipStatusKind extendido con CANCELED — AUT-353 (NEW)
│   │   │   └── panel.ts               # Interfaces for professional panel data (PanelData, PanelOrder, etc.) + totalEarnings en ActivityStatsResponse (AUT-328) + userComments en PanelReputation (AUT-345) + features en PanelMembershipData.plan (AUT-361)
│   │   ├── context/
│   │   │   └── AuthContext.tsx         # JWT in-memory auth provider (login, logout, role checks) (NEW)
│   │   ├── components/
│   │   │       ├── admin/
│   │   │       │   ├── AdminLayout.tsx     # Sidebar (collapsible mobile) + main content wrapper; logo SVG en desktop/mobile header y header mobile dark (#111110) (AUT-210)
│   │   │       │   ├── ProtectedRoute.tsx  # Auth guard + optional role guard; context-aware redirect paths (NEW)
│   │   │       │   └── ConfirmDialog.tsx   # Reusable confirm modal for destructive actions (NEW)
│   │   ├── pages/
│   │   │   ├── SimulatorPage.tsx       # Main simulator page: composes all chat components, phone/role state
│   │   │   ├── admin/                  # Admin panel pages (NEW)
│   │   │   │   ├── LoginPage.tsx               # Centered login form (email + password)
│   │   │   │   ├── DashboardPage.tsx           # Metrics cards + paneles de rendimiento + seccion "Analisis" con 3 graficos Recharts (linea con rango 7/15/30d, barras por estado, donut por estado) + filtro jerárquico Provincia → Departamento (AUT-209, AUT-332)
│   │   │   │   ├── ProfessionalsPage.tsx        # Table with status filter, hierarchical geo filter (Provincia → Departamento), badges, pagination, phone column between zone and status, botón "Nuevo profesional" con modal de alta directa en 2 pasos: Paso 1 (datos básicos) + Paso 2 (disponibilidad con días/horarios, opcional) — AUT-351, AUT-354. Filtro "Con cambios pendientes" e ícono de alerta naranja en profesionales con data changes PENDING — AUT-359 (AUT-205, AUT-341)
│   │   │   │   ├── ProfessionalDetailPage.tsx   # Personal info, docs, history, approve/reject/suspend, generate session URL (enabled only for ACTIVE/OBSERVATION/PAUSED; blocked for PENDING/UNDER_REVIEW), credencial habilitante con approve/reject — AUT-324, sección Membresía con consulta de estado, botón contextual (Asignar/Cambiar plan/Renovar) y cancelación (SUPERADMIN only) — AUT-350, AUT-353, botón "Editar" (SUPERADMIN) redirige a página de edición — AUT-355. Tabla comparativa anterior → nuevo en cambios pendientes con links "Ver archivo" para URLs — AUT-359 (AUT-205)
│   │   │   │   ├── ProfessionalEditPage.tsx     # Página de edición completa con 3 tabs (Básicos, Identidad, Perfil), upload de archivos con presigned URLs a R2, disponibilidad por días/horarios — AUT-355
│   │   │   ├── UsersPage.tsx                # Table with phone, status, block/unblock actions
│   │   │   │   ├── UsersPage.tsx                # Table with phone, status, block/unblock actions
│   │   │   │   ├── OrdersPage.tsx               # Table with status badges + compact timeline dots
│   │   │   │   ├── EscalationsPage.tsx          # Table with urgency summary, status change + resolve modal
│   │   │   │   ├── ZonesPage.tsx                # Hierarchical tree (Country → Province → Department) with toggles
│   │   │   │   ├── CategoriesPage.tsx           # Table with inline toggles + create/edit modal con toggle "requiere credencial" y campo licenseLabel — AUT-324
│   │   │   │   ├── PlansPage.tsx                # Plan cards con modal crear/editar (nombre, precio, descuento, features, toggle activo), botón desactivar con confirmación, lista de beneficios en cards — AUT-340
│   │   │   │   └── SettingsPage.tsx             # Config form (12 matching weights, penalties, limits, system params) — AUT-334, AUT-337
│   │   │   │   └── PromotionsPage.tsx            # Membership discount management: activate/deactivate promo with percentage and duration, shows active/inactive state — AUT-336
│   │   │   └── onboarding/
│   │   │       ├── OnboardingPage.tsx  # Main page: token validation, step routing via useOnboarding hook (incluye step 'license' condicional — AUT-323). Oculta ProgressBar en modo re-subida (?mode=license) — AUT-335
│   │   │       ├── DESIGN.md           # Design system document (source of truth for visual design)
│   │   │       ├── hooks/
│   │   │       │   └── useOnboarding.ts    # State machine: multi-step form, file uploads, token validation. STEPS_ORDER dinámico: inserta 'license' entre criminal-record y references si declaredHasLicense=true — AUT-323. Detecta ?mode=license para flujo reducido (solo license + confirmation), saltea bienvenida, usa submitLicenseResubmission — AUT-335
│   │   │       └── components/
│   │   │           ├── ProgressBar.tsx      # Fixed top progress bar (4px, NORA Green fill)
│   │   │           ├── BottomBar.tsx        # Fixed bottom CTA bar (Volver + Continuar/Enviar)
│   │   │           ├── FileUploadZone.tsx   # Upload zone: empty (dashed) → uploading (spinner) → loaded (green + preview/PDF icon)
│   │   │           ├── WelcomeScreen.tsx    # "Hola, {name}" + Comenzar CTA
│   │   │           ├── ErrorScreen.tsx      # 4 variants: expired (amber), used (red), invalid (red), missing (red)
│   │   │           ├── PersonalDataStep.tsx # DNI (7-8 digits) + CUIL (XX-XXXXXXXX-X) with inline validation
│   │   │           ├── DniPhotoStep.tsx     # Front + back DNI photo uploads
│   │   │           ├── CriminalRecordStep.tsx # Criminal record certificate upload (PDF allowed)
│   │   │           ├── LicenseStep.tsx      # Credencial habilitante upload con label dinámico — AUT-323. Soporta prop isLicenseMode: título "Subir nueva credencial", botón "Enviar", sin botón Volver — AUT-335
│   │   │           ├── ReferencesStep.tsx   # Optional textarea with "Opcional" badge
│   │   │           ├── VideoStep.tsx        # Optional video upload (MP4/MOV)
│   │   │           ├── ZonesStep.tsx        # Checkbox list of coverage zones, pre-selected from bot registration
│   │   │           ├── SummaryStep.tsx      # Summary with dividers and file previews. Muestra credencial habilitante si licenseUrl existe — AUT-323
│   │   │           └── ConfirmationScreen.tsx # Success checkmark + "¡Listo, {name}!" message
│   │   │   └── app/
│   │   │       └── PlanesPage.tsx           # Public plans page (/planes?pro=) with MercadoPago links, sorted by priority, showing features list with checkmark, annual discount badge "X% OFF anual", skeleton loading (AUT-214, AUT-346), Free plan support without payment link (AUT-347), active plan highlighting with badge "Tu plan actual", highlighted border and "Plan activo" button (AUT-348)
│   │   │   └── panel/                        # Professional self-service panel (NEW)
│   │   │       ├── ProfessionalPanelPage.tsx  # Main page: session token validation, tab routing (7 tabs, default: dashboard), toggle edit/view profile con estado editingProfile — AUT-356
│   │   │       └── components/
│   │   │           ├── PanelCard.tsx               # Shared card component: rounded-2xl shadow-sm p-6 (AUT-181)
│   │   │           ├── ProfessionalLayout.tsx     # w-64 sidebar (desktop, 7 tabs, py-3.5 items, border-l-4 active, bg-[#F0FDF4] active) + header mobile con hamburguesa + drawer lateral (w-72, 7 tabs, overlay bg-black/40) + CTA persistente de membresía en sidebar y banner mobile con countdown de descuento en tiempo real cuando hay promo activa, o pedidos gratuitos restantes cuando no (AUT-181, AUT-183, AUT-184, AUT-329, AUT-333)
│   │   │           ├── ProfessionalDashboard.tsx  # Dashboard: saludo, badge membresía, métricas (text-4xl JetBrains Mono, w-12 icon), gráficos de actividad (BarChart 7d + LineChart 8w con Recharts, skeleton loading), desglose ratings (ProgressBar unificada #0B6E4F), accesos rápidos, max-w-5xl (AUT-178, AUT-181, AUT-182, AUT-183)
│   │   │           ├── ProfessionalProfile.tsx    # Status badge (px-4 py-1.5 text-sm), excellence badge (text-sm), availability, personal data (py-4 rows, text-base font-semibold values), docs (read-only), botón "Editar perfil" con prop onEdit — AUT-356, max-w-5xl (AUT-181, AUT-183)
│   │   │           ├── ProfessionalProfileEdit.tsx # Vista de edición con 3 tabs (Básicos: nombre, zonas, disponibilidad — sin categoría; Identidad: DNI, CUIL, uploads; Perfil: referencias, video, credencial). Upload de archivos vía presigned URLs a R2. Sticky footer con Cancelar/Guardar — AUT-356
│   │   │           ├── ProfessionalPendingRequests.tsx # Pending requests: countdown, accept/reject, modal, empty state
│   │   │           ├── ProfessionalInProgress.tsx      # In-progress orders (ACCEPTED + PENDING_CONFIRMATION): StatCards (text-4xl JetBrains Mono, min-h-[100px], uppercase tracking-wide labels), coordination status, confirm visit, mark finished, view detail modal, mobile cards, space-y-5, max-w-5xl (AUT-156, AUT-168, AUT-181, AUT-183)
│   │   │           ├── ProfessionalOrders.tsx     # History: terminal orders, StatCards (text-4xl JetBrains Mono, min-h-[100px], uppercase tracking-wide labels), filters, search, table desktop + mobile cards, RatingDetailModal sin feedback del usuario (solo evaluación del profesional), rate user (RateUserModal 2 steps: rating general + ¿volvería a atenderlo? + comentario, AUT-320), estrella de calificación no clickeable (AUT-345), space-y-5, max-w-5xl (AUT-156, AUT-179, AUT-181, AUT-183, AUT-320, AUT-344, AUT-345)
│   │   │           ├── ProfessionalMembership.tsx # Membership status: active/trial (h-3 progress bar)/expired, precio (text-4xl), beneficios (features reales del plan desde DB con fallback BENEFITS hardcodeado, AUT-361), trial card min-h-[200px], trial numbers text-2xl JetBrains Mono, trial title text-2xl, max-w-5xl + widget de ganancias (7/30/90d, text-4xl JetBrains Mono, totalEarnings) + card promocional con countdown en tiempo real cuando hay descuento activo (AUT-181, AUT-183, AUT-328, AUT-329)
│   │   │           └── ProfessionalReputation.tsx # Donut chart (160x160, r=68), compliance metrics (text-4xl), metric cards min-h-[120px], completed/rejected/notFulfilled rows text-2xl, recomendación %, sección "Lo que dicen tus clientes" con comentarios anónimos (AUT-345), tips, sin desglose por eje falso, max-w-5xl (AUT-181, AUT-183, AUT-344, AUT-345)
│   ├── index.html                      # Vite entry HTML (dev mode)
│   ├── index-landing.html               # Vite entry HTML (landing build)
│   ├── index-admin.html                 # Vite entry HTML (admin build) + favicon `/favicon.svg` (AUT-210)
│   ├── index-app.html                   # Vite entry HTML (app build)
│   ├── public/
│   │   ├── favicon.svg                  # Browser favicon for frontend targets (AUT-210)
│   │   └── logo-nora.svg                # Shared NORA logo asset used by admin layout (AUT-210)
│   ├── .env.landing                     # Env vars for landing build
│   ├── .env.admin                       # Env vars for admin build
│   ├── .env.app                         # Env vars for app build
│   ├── .env.development                 # Env vars for dev mode (npm run dev)
│   ├── package.json                    # @noraconecta/frontend (Vite + React 19 + Tailwind 4)
│   ├── tsconfig.json                   # React + TypeScript strict config
│   └── vite.config.ts                  # Vite + React + Tailwind + API proxy (supports BUILD_TARGET)
├── landing/                           # Landing page estática (AUT-135, AUT-191)
│   ├── index.template.html             # Template con placeholders {{APP_NAME}}, {{APP_FULL_NAME}}, {{APP_TAGLINE}}, {{APP_URL}} (AUT-187)
│   ├── index.html                      # HTML generado (no commiteado, .gitignore) (AUT-187)
│   ├── privacidad.html                 # Política de privacidad (contenido hardcodeado) (AUT-191)
│   ├── terminos.html                   # Términos y condiciones (contenido hardcodeado) (AUT-191)
│   ├── input.css                       # Tailwind v4 source + tokens + scroll-behavior: smooth (AUT-191)
│   ├── output.css                      # CSS compilado (no commiteado)
│   ├── robots.txt                      # SEO
│   ├── sitemap.xml                     # SEO
│   └── DESIGN.md                       # Sistema de diseño
├── mcp/                                 # MCP Admin Server (AUT-362)
│   ├── src/
│   │   ├── index.ts                    # Entry point: McpServer bootstrap with StdioServerTransport
│   │   ├── auth.ts                     # JWT login + automatic renewal (24h token)
│   │   ├── nora-client.ts              # HTTP wrapper over api.noraconecta.com (GET/POST/PATCH/DELETE)
│   │   └── tools/
│   │       ├── professionals.ts        # Professional management tools (12 tools)
│   │       ├── requests.ts             # Request listing tools
│   │       ├── metrics.ts              # Dashboard metrics + config + membership discount
│   │       ├── locations.ts            # Geo hierarchy management
│   │       ├── categories.ts           # Category CRUD + toggle
│   │       ├── plans.ts                # Plan CRUD + deactivate
│   │       ├── users.ts                # User listing + block/unblock
│   │       └── escalations.ts          # Escalation listing + status transitions + resolve
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── scripts/
│   └── inject-brand.sh                # Inyección de variables de marca en landing (AUT-187)
├── .env                                # Variables de entorno raíz (marca) (AUT-187)
├── .env.example                        # Template de variables de entorno raíz (AUT-187)
├── package.json                 # Root workspace config
├── .gitignore
├── PROJECT.md
└── README.md
```
src/
├── server.ts                  # Entry point: Express app bootstrap
├── lib/
│   └── prisma.ts              # Prisma client singleton
│   └── r2-client.ts           # Cloudflare R2 client (presigned URLs + direct upload)
│   └── whatsapp-adapter.ts    # WhatsApp Business API adapter: parseo de webhooks, envío de mensajes, templates con validación de 1 template por 24hs (AUT-134, AUT-272)
├── middleware/
│   ├── error-handler.ts       # Global error handler (AppError, 500 fallback)
│   ├── require-auth.ts        # JWT validation middleware
│   └── require-super-admin.ts # SUPERADMIN role guard
├── utils/
│   ├── jwt.ts                 # signToken / verifyToken
│   ├── date-utils.ts          # ParseDateTimeResult type + parseExactDate + parseDateTimeNatural (lenguaje natural con LLM, discriminated union, AUT-237, AUT-248) + funciones de timezone Argentina (AUT-166, AUT-167, AUT-237)
│   └── whatsapp-utils.ts      # shouldUseTemplate() + canSendTemplate(): helpers de ventana de 24hs WhatsApp (AUT-171, AUT-272)
├── types/
  │   └── express.d.ts           # Express Request augmentation (req.admin)
  ├── modules/
  │   ├── auth/
  │   │   ├── auth.routes.ts     # POST /auth/login, POST /auth/logout, GET /auth/me
  │   │   ├── auth.controller.ts # Request validation, response formatting
  │   │   ├── auth.service.ts    # Login logic, bcrypt comparison, JWT signing
  │   │   └── auth.repository.ts # Prisma queries for Admin model
  │   ├── categories/
  │   │   ├── categories.routes.ts     # 6 endpoints under /categories
  │   │   ├── categories.controller.ts # Request validation, response formatting
  │   │   ├── categories.service.ts    # Slug generation, Levenshtein matching
  │   │   └── categories.repository.ts # Prisma queries for Category model
│   └── locations/
│       ├── locations.routes.ts     # 6 endpoints under /locations
│       ├── locations.controller.ts # Request validation, response formatting
│       ├── locations.service.ts    # Geo hierarchy business logic
│       └── locations.repository.ts # Prisma queries for GeoLevel/GeoNode
│   ├── users/
│   │   ├── users.routes.ts         # 4 endpoints under /users
│   │   ├── users.controller.ts     # Request validation, response formatting
│   │   ├── users.service.ts        # findOrCreateByPhone, isBlocked, block/unblock, updateName
│   │   └── users.repository.ts     # Prisma queries for User model + updateName
│   ├── professionals/
│       ├── professionals.routes.ts     # 13 endpoints under /professionals
│       ├── professionals.controller.ts # Request validation, response formatting
│       ├── professionals.service.ts    # Register, verify, approve, reject, suspend, session, panel
│       └── professionals.repository.ts # Prisma queries for Professional/ProfessionalZone, panel data, orders
│       ├── professionals.service.ts    # Register, verify, approve, reject, suspend, session
│       └── professionals.repository.ts # Prisma queries for Professional/ProfessionalZone
│   └── matching/
│       ├── matching.service.ts    # Scoring ponderado + filtros duros + detección híbrida de matrícula (AUT-343)
│       └── matching.repository.ts # Prisma queries para motor de matching + findTrialExhaustedProfessionals (AUT-188)
│   └── notifications/             # (AUT-195)
│       └── notification.service.ts # WhatsApp notification dispatch for request lifecycle events
│   └── payments/                  # (AUT-188)
│       ├── payments.routes.ts     # POST /webhooks/mercadopago, POST /payments/link
│       ├── payments.controller.ts # Webhook HMAC validation + payment link endpoint
│       ├── payments.service.ts    # Payment links, webhook processing, trial-exhausted notification
│       └── payments.repository.ts # Plan queries, waiting request lookup
├── routes/                    # Webhook endpoints
│   ├── webhooks.routes.ts      # WhatsApp webhook endpoint (AUT-134), photo debounce accumulation (AUT-283), sendResponse con soporte mediaFirst: fotos/audio antes que texto con delay de 1500ms para orden visual (AUT-290, AUT-317)
│   └── simulator.routes.ts     # GET /simulator/messages — disponible solo en modo simulador (AUT-268). isSimulatorMode() alineado con isConfigured() del adapter (sin WHATSAPP_API_TOKEN_PROFESSIONAL, AUT-281)
├── services/                  # (placeholder for future shared services)
└── repositories/              # (placeholder for future shared repositories)
```

### Layer rules

- **routes**: HTTP endpoints only, no business logic
- **controllers**: Request/response handling, input validation, delegate to services
- **services**: Business logic, orchestration of repositories
- **repositories**: Database access only (Prisma), no business logic
- **lib**: Shared clients (Prisma instance, R2 client, LLM client)
- **utils**: Pure helper functions
- **middleware**: Request interceptors (auth, error handling)

## Build Targets (Frontend Subdomain Configuration)

El frontend tiene tres entrypoints separados para producción, cada uno asociado a un subdominio distinto.
En desarrollo local (`npm run dev`) todo corre en `localhost:5173` con rutas separadas; la separación por subdominios es solo para producción.

| Target   | Subdominio                  | Entrypoint           | HTML Entry             | Output dir   | Descripción                          |
|---------|-----------------------------|---------------------|------------------------|-------------|--------------------------------------|
| landing | noraconecta.com.ar          | `main-landing.tsx`  | `index-landing.html`  | `dist/landing` | Landing page + simulador del bot     |
| admin   | admin.noraconecta.com.ar    | `main-admin.tsx`    | `index-admin.html`    | `dist/admin`   | Panel de administración (login + dashboard + CRUD) |
| app     | app.noraconecta.com.ar      | `main-app.tsx`      | `index-app.html`      | `dist/app`     | Onboarding (`/verify/:token`) + Panel profesional (`/panel/:sessionToken`) + Planes (`/planes?pro=`) |

### Host-based routing en desarrollo

En `npm run dev`, `App.tsx` detecta el hostname vía `resolveHostContext()` (`lib/host.ts`) y renderiza solo las rutas del contexto correspondiente:

| Hostname                    | Contexto | Rutas activas                                    |
|----------------------------|----------|-------------------------------------------------|
| `localhost:5173`           | `all`    | Todas: `/simulator`, `/verify/:token`, `/panel/:sessionToken`, `/planes`, `/admin/*` |
| `admin.noraconecta.local`  | `admin`  | Solo admin (sin prefijo): `/login`, `/professionals`, `/escalations`, etc. |
| `app.noraconecta.local`    | `app`    | Onboarding + panel + planes: `/verify/:token`, `/panel/:sessionToken`, `/planes`, `/` → ErrorScreen "missing" |
| `noraconecta.local`        | `landing`| Solo landing: `/` → `/simulator` |

Los subdominios `.local` requieren mapeo en `/etc/hosts`:
```
127.0.0.1 noraconecta.local www.noraconecta.local admin.noraconecta.local app.noraconecta.local
```

En el contexto `admin`, las rutas no usan el prefijo `/admin` (ej: `/login`, `/professionals`). Los componentes `AdminLayout`, `ProtectedRoute`, `LoginPage`, `ProfessionalsPage` y `ProfessionalDetailPage` usan `resolveHostContext()` o `getAdminDashboardPath()` para generar paths dinámicos según el contexto.
En el contexto `app`, la raíz `/` muestra un `ErrorScreen` con variante `missing` indicando que se necesita un enlace de verificación válido.

### Scripts de build

```json
{
  "build:admin": "BUILD_TARGET=admin vite build",
  "build:app": "BUILD_TARGET=app vite build",
  "build:landing": "BUILD_TARGET=landing vite build",
  "build:all": "npm run build:admin && npm run build:app && npm run build:landing"
}
```

La variable de entorno `BUILD_TARGET` es leída por `vite.config.ts` para:
- Seleccionar el HTML de entrada (`index-{target}.html`)
- Cargar el archivo `.env.{target}` correspondiente
- Redirigir la salida a `dist/{target}/`

### Archivos de entorno del backend

| Variable          | Default                     | Descripción                                  |
|-------------------|-----------------------------|----------------------------------------------|
| `APP_URL`         | `http://app.noraconecta.local` | Base URL del frontend para links enviados por WhatsApp: verificación, panel, página de planes (`/planes?pro=`) (AUT-213) |
| `APP_NAME`        | `NORA`                        | Nombre corto de la marca para mensajes del bot, logo (AUT-187) |
| `APP_FULL_NAME`   | `NORA Conecta`                | Nombre completo para títulos, SEO, textos institucionales (AUT-187) |
| `APP_TAGLINE`     | `Tu profesional de confianza` | Tagline de la marca (AUT-187) |
| `APP_URL` (marca) | `https://noraconecta.com`     | URL pública del sitio (AUT-187) |
| `WHATSAPP_APP_SECRET` | — | App Secret único para webhooks de Meta (single WABA) |
| `WHATSAPP_APP_SECRET_USER` | — | App Secret de la app del BM de usuarios (dual BM) (AUT-282) |
| `WHATSAPP_APP_SECRET_PROFESSIONAL` | — | App Secret de la app del BM de profesionales (dual BM) (AUT-282) |
| `MERCADOPAGO_ACCESS_TOKEN` | — | Access token de MercadoPago (producción o sandbox) (AUT-188) |
| `MERCADOPAGO_WEBHOOK_SECRET` | — | Secret para validar firma HMAC del webhook (AUT-188) |
| `LLM_PROVIDER` | `openai` | Proveedor de LLM: `openai` o `anthropic` (AUT-242) |
| `OPENAI_API_KEY` | — | API key de OpenAI (AUT-242) |
| `OPENAI_MODEL` | `gpt-4o-mini` | Modelo de OpenAI (AUT-242) |
| `ANTHROPIC_API_KEY` | — | API key de Anthropic (AUT-242) |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5-20251001` | Modelo de Anthropic (AUT-242) |
| `OPENAI_TRANSCRIPTION_MODEL` | `gpt-4o-mini-transcribe` | Modelo de transcripción de audio: `gpt-4o-mini-transcribe`, `gpt-4o-transcribe`, `whisper-1` (AUT-302) |

### Archivos de entorno por target (frontend)

| Archivo          | Variables                                                            |
|-----------------|----------------------------------------------------------------------|
| `.env.landing`    | `VITE_WHATSAPP_NUMBER`, `VITE_APP_NAME`, `VITE_APP_FULL_NAME`, `VITE_APP_TAGLINE`, `VITE_APP_URL` |
| `.env.admin`      | `VITE_API_URL`, `VITE_APP_NAME`, `VITE_APP_FULL_NAME`, `VITE_APP_TAGLINE`, `VITE_APP_URL` |
| `.env.app`        | `VITE_API_URL`, `VITE_APP_NAME`, `VITE_APP_FULL_NAME`, `VITE_APP_TAGLINE`, `VITE_APP_URL` |
| `.env.development`| `VITE_API_URL`, `VITE_APP_NAME`, `VITE_APP_FULL_NAME`, `VITE_APP_TAGLINE`, `VITE_APP_URL` |

### Nginx en producción (referencia)

```nginx
server {
  server_name admin.noraconecta.com.ar;
  root /var/www/nora/admin;
}

server {
  server_name app.noraconecta.com.ar;
  root /var/www/nora/app;
}

server {
  server_name noraconecta.com.ar;
  root /var/www/nora/landing;
}
```

## Brand Configuration (AUT-187)

Las variables de marca son configurables desde el `.env` raíz mediante las variables `APP_NAME`, `APP_FULL_NAME`, `APP_TAGLINE` y `APP_URL`. El sistema usa fallbacks con los valores por defecto.

### Backend

Los mensajes del bot usan `process.env.APP_NAME ?? 'NORA'`.

### Frontend

El módulo `frontend/src/lib/brand.ts` expone un objeto `brand` con `name`, `fullName`, `tagline` y `url` desde `import.meta.env.VITE_APP_*` con fallbacks.

Reglas de uso:
- Logo en sidebar, mensajes internos, referencia al bot → `brand.name`
- Títulos de página, pantallas de error, textos institucionales → `brand.fullName`

### Landing page (estática)

El landing usa placeholders en `landing/index.template.html` (`{{APP_NAME}}`, `{{APP_FULL_NAME}}`, `{{APP_TAGLINE}}`, `{{APP_URL}}`) que se reemplazan con `npm run inject-brand` (ejecuta `scripts/inject-brand.sh`). El archivo generado `landing/index.html` está en `.gitignore`.

### Scripts raíz

```json
{
  "inject-brand": "bash scripts/inject-brand.sh",
  "build:landing": "bash scripts/inject-brand.sh && cd landing && npx tailwindcss -i input.css -o output.css --minify"
}
```

## Landing Page (Static HTML) (AUT-135, AUT-191)

Landing page estática optimizada para SEO y GEO, deployeada en `noraconecta.com.ar`. HTML puro sin JavaScript ni React. Copy actualizado a cobertura provincial (18 departamentos de Mendoza) y bloque de métricas renovado (AUT-190). Rediseño visual con navbar simplificado, scroll suave, avatares con gradiente, mockup de WhatsApp realista (phone frame Android, burbujas estilo WhatsApp), sección profesionales con dashboard de métricas + notificaciones, métricas responsive y páginas legales (AUT-191).

| Archivo | Descripción |
|---------|-------------|
| `landing/index.template.html` | Template con placeholders `{{APP_NAME}}`, `{{APP_FULL_NAME}}`, `{{APP_TAGLINE}}`, `{{APP_URL}}` (AUT-187) |
| `landing/index.html` | HTML generado por `npm run inject-brand` (no commiteado) (AUT-187) |
| `landing/privacidad.html` | Página estática de política de privacidad (contenido hardcodeado) (AUT-191) |
| `landing/terminos.html` | Página estática de términos y condiciones (contenido hardcodeado) (AUT-191) |
| `landing/input.css` | Tailwind v4 source con `@theme` tokens + custom CSS + `scroll-behavior: smooth` (AUT-191) |
| `landing/output.css` | CSS compilado (minificado, no commiteado) |
| `landing/package.json` | Dependencia: `@tailwindcss/cli` para compilación |
| `landing/robots.txt` | Allow all, sitemap |
| `landing/sitemap.xml` | URL canónica mensual |
| `landing/DESIGN.md` | Sistema de diseño visual (dark organic minimalism) |

### SEO implementado

- **Meta tags:** description, keywords (locales), robots, canonical
- **Open Graph:** og:type, og:title, og:description, og:url, og:locale, og:site_name
- **Twitter Card:** summary_large_image con title y description
- **Structured Data:** JSON-LD `LocalBusiness` (con `areaServed` de los 18 departamentos de Mendoza y `hasOfferCatalog`) + `FAQPage` (5 preguntas) (AUT-190)
- **GEO:** keywords geográficas con departamentos principales de Mendoza (Maipú, Luján de Cuyo, Godoy Cruz, Guaymallén, Las Heras); copy visible genérico con cobertura provincial (AUT-190)

### Performance

- Tailwind CSS compilado estáticamente (sin CDN), ~26KB minificado
- Google Fonts con preconnect y `display=swap`
- Imágenes reemplazadas por SVG inline (sin requests externos)
- Sin JavaScript — 100% HTML + CSS

### Build

```bash
cd landing && npm install && npm run build:css
```

## Modules

### Auth

| Endpoint         | Método | Descripción                          | Auth requerida |
|-----------------|--------|--------------------------------------|----------------|
| `/health`        | GET    | Health check (sin auth)              | No             |
| `/auth/login`    | POST   | Login de admin (email + password)    | No             |
| `/auth/logout`   | POST   | Limpia la cookie de sesión admin     | No             |
| `/auth/me`       | GET    | Retorna admin autenticado por cookie/header | Sí (requireAuth) |

### Admin Dashboard (NEW)

Agrega métricas del panel de administración agregadas desde múltiples entidades.
Soporta filtro jerárquico por zona geográfica vía `geoNodeId` query param (AUT-332).

| Endpoint                       | Método | Descripción                          | Auth requerida |
|-------------------------------|--------|--------------------------------------|----------------|
| `/admin/metrics`               | GET    | Dashboard KPIs (orders, professionals, escalations, feedback). Opcional: `?geoNodeId=<id>` para filtrar por zona | OPERATOR |
| `/admin/geo-tree`              | GET    | Árbol geográfico jerárquico (Provincia → Departamento) para selector de filtro | OPERATOR |
| `/admin/requests/auto-close`   | POST   | Trigger manual de auto-cierre de pedidos PENDING_CONFIRMATION > 24h (testing) | SUPERADMIN |

Response shape:
```json
{
  "data": {
    "orders": { "active": 15, "last24h": 3, "last7d": 42, "total": 520 },
    "acceptanceRate": 72,
    "coverageRate": 85,
    "avgAcceptanceTimeMinutes": 12,
    "professionals": { "active": 89, "pending": 18, "suspended": 4, "total": 120 },
    "escalations": { "open": 5, "total": 23 },
    "wouldRecommendPct": 94,
    "ordersByStatus": [
      { "status": "CREATED", "count": 31 },
      { "status": "ASSIGNED", "count": 22 },
      { "status": "ACCEPTED", "count": 15 },
      { "status": "COMPLETED", "count": 430 }
    ],
    "ordersLast30Days": [
      { "date": "2026-05-01", "count": 11 },
      { "date": "2026-05-02", "count": 9 }
    ],
    "professionalsByStatus": [
      { "status": "ACTIVE", "count": 80 },
      { "status": "UNDER_REVIEW", "count": 12 },
      { "status": "SUSPENDED", "count": 4 }
    ]
  }
}
```

### Categories (ACTUALIZADO AUT-322, AUT-324)

| Endpoint                   | Método | Descripción                          | Rol mínimo |
|---------------------------|--------|--------------------------------------|-----------|
| `/categories`             | GET    | Lista todas las categorías           | OPERATOR  |
| `/categories/active`      | GET    | Solo categorías activas              | OPERATOR  |
| `/categories/:id`         | GET    | Detalle de categoría                 | OPERATOR  |
| `/categories`             | POST   | Crear categoría (slug autogenerado, campos requiresLicense y licenseLabel aceptados) | SUPERADMIN|
| `/categories/:id`         | PATCH  | Editar nombre, descripción, requiresLicense o licenseLabel | SUPERADMIN|
| `/categories/:id/toggle`  | PATCH  | Habilitar / deshabilitar categoría   | SUPERADMIN|

**Campos de credencial habilitante (AUT-322):**
- `requiresLicense Boolean @default(false)` — indica si la categoría requiere una credencial habilitante
- `licenseLabel String?` — etiqueta de la credencial (ej: "Matrícula habilitante de gasista")
- Categorías con `requiresLicense = true`: Gasista matriculado, Electricista, Aire acondicionado

### Locations (ACTUALIZADO AUT-211)

| Endpoint                       | Método | Descripción                                  | Rol mínimo |
|-------------------------------|--------|----------------------------------------------|-----------|
| `/locations/countries`        | GET    | Lista países disponibles                     | OPERATOR  |
| `/locations/tree/:countryId`  | GET    | Árbol completo de nodos de un país           | OPERATOR  |
| `/locations/leaf-nodes`       | GET    | Solo nodos hoja activos (para matching)      | OPERATOR  |
| `/locations/countries`        | POST   | Crear país + definir niveles                 | SUPERADMIN|
| `/locations/nodes`            | POST   | Crear nodo en cualquier nivel                | SUPERADMIN|
| `/locations/nodes/:id/toggle` | PATCH  | Habilitar / deshabilitar nodo                | SUPERADMIN|
| `/locations/nodes/:id`       | PATCH  | Actualizar nombre del nodo                   | SUPERADMIN|

**Métodos internos del repositorio:**
- `findActiveChildNodes(parentId)`: retorna nodos hijos activos ordenados alfabéticamente (usado por `PROFESSIONAL_REGISTER` para provincias y zonas).

### Users

| Endpoint               | Método | Descripción                          | Rol mínimo |
|------------------------|--------|--------------------------------------|-----------|
| `/users`               | GET    | Lista paginada de usuarios           | OPERATOR  |
| `/users/:id`           | GET    | Detalle de usuario                   | OPERATOR  |
| `/users/:id/block`     | PATCH  | Bloquear usuario                     | SUPERADMIN|
| `/users/:id/unblock`   | PATCH  | Desbloquear usuario                  | SUPERADMIN|

### Professionals

| Endpoint                               | Método | Descripción                                    | Rol mínimo |
|----------------------------------------|--------|-------------------------------------------------|-----------|
| `/professionals/register`             | POST   | Etapa 1: crear profesional desde bot            | Sin auth  |
| `/professionals/verify/:token`         | GET    | Verificar validez del token y obtener nombre + zonas del profesional | Sin auth  |
| `/professionals/verify/:token`         | POST   | Etapa 2: subir documentación + zoneIds (pisa lo registrado por el bot) | Sin auth  |
| `/professionals/session/:token`        | GET    | Recuperar sesión de profesional por token       | Sin auth  |
| `/professionals/session/:token/panel`  | GET    | Datos consolidados del panel (perfil + membresía + reputación) | Sin auth |
| `/professionals/session/:token/orders` | GET    | Historial de pedidos del profesional (paginado, incluye nombre/teléfono del usuario y calificación recibida) | Sin auth |
| `/professionals/session/:token/pending-requests` | GET | Pedidos ASSIGNED sin responder: rubro, zona, descripción, tiempo restante | Sin auth |
| `/professionals/session/:token/stats` | GET | Estadísticas de actividad temporal: pedidos por día (7/30/90d) + evolución de calificación (8w) | Sin auth |
| `/professionals/session/:sessionToken/earnings` | GET | Ganancias del profesional: suma de `amountPaid` en rango de días (7/15/30) — AUT-327 | Sin auth |
| `/professionals`                       | GET    | Lista paginada de profesionales (filtros: status, categoryId, departmentId) | OPERATOR  |
| `/professionals/departments`           | GET    | Lista departamentos activos (GeoNode level 2)   | OPERATOR  |
| `/professionals/:id`                   | GET    | Detalle de profesional                          | OPERATOR  |
| `/professionals/:id/approve`           | POST   | Aprobar profesional (UNDER_REVIEW → ACTIVE)     | SUPERADMIN|
| `/professionals/:id/reject`            | POST   | Rechazar profesional (UNDER_REVIEW → REJECTED)  | SUPERADMIN|
| `/professionals/:id/suspend`           | POST   | Suspender profesional                           | SUPERADMIN|
| `/professionals/:id/reactivate`        | POST   | Reactivar profesional (SUSPENDED → ACTIVE)      | SUPERADMIN|
| `/professionals/:id/badge`             | PATCH  | Asignar o remover insignia de reputación        | SUPERADMIN|
| `/professionals/:id/generate-session`  | POST   | Generar token de sesión + panelUrl para portal profesional | SUPERADMIN|
| `/professionals/:id/license-status`    | PATCH  | Aprobar o rechazar credencial habilitante (APPROVED/REJECTED) — AUT-324 | SUPERADMIN|
| `/professionals/:id`                   | PATCH  | Editar profesional (nombre, categoría, zonas, disponibilidad, identidad, perfil, archivos) — AUT-355 | SUPERADMIN|
| `/professionals/data-changes/pending`  | GET    | Lista solicitudes de cambio de datos sensibles pendientes de revisión — AUT-357 | OPERATOR  |
| `/professionals/data-changes/count`    | GET    | Cantidad de solicitudes pendientes de revisión (badge sidebar) — AUT-357 | OPERATOR  |
| `/professionals/data-changes/:requestId/reviewed` | PATCH | Marcar solicitud como revisada — AUT-357 | SUPERADMIN|

### Data Change Audit Trail (AUT-357)

Sistema de auditoría de cambios sensibles del profesional con cola de revisión en panel admin.

**Modelo: `ProfessionalDataChangeRequest`**

| Campo            | Tipo     | Descripción                                    |
|-----------------|----------|------------------------------------------------|
| `id`            | String   | PK (cuid)                                      |
| `professionalId`| String   | FK → Professional                              |
| `changedFields`  | Json     | Array de campos sensibles modificados          |
| `previousValues` | Json?    | Valores anteriores por campo (AUT-358)         |
| `newValues`      | Json?    | Valores nuevos por campo (AUT-358)             |
| `status`         | String   | `PENDING` (default) o `REVIEWED`               |
| `createdAt`      | DateTime | Fecha de creación                              |
| `reviewedAt`     | DateTime?| Fecha de revisión                              |
| `reviewedBy`     | String?  | Admin que revisó                               |

**Campos sensibles detectados:** `name`, `dniNumber`, `cuil`, `dniFrontUrl`, `dniBackUrl`, `criminalRecordUrl`, `licenseUrl`.

**Lógica de negocio:**
- Cuando el profesional edita desde su panel (`updateProfile`), se pasa `triggeredByProfessional: true`. Al final de `adminUpdate`, si alguno de los campos sensibles fue modificado, se crea un registro `PENDING` en `ProfessionalDataChangeRequest`.
- El admin que modifica desde `ProfessionalDetailPage` o `ProfessionalEditPage` NO dispara el flujo (`triggeredByProfessional` es `false` por defecto).
- El profesional sigue `ACTIVE` y recibiendo pedidos — no se toca su status.
- El sidebar del admin muestra badge rojo con contador de pendientes (polling cada 60s).
- El detalle del profesional muestra sección "Cambios pendientes de revisión" con campos en español y botón para marcar como revisado.
- El Tab "Identidad" del panel del profesional muestra banner de aviso: "Los cambios en esta sección serán revisados por el equipo de NORA."

**Archivos modificados:**
- `backend/prisma/schema.prisma` — modelo `ProfessionalDataChangeRequest` + relación en `Professional`
- `backend/prisma/migrations/20260626180000_add_professional_data_change_requests/migration.sql`
- `backend/src/modules/professionals/professionals.repository.ts` — `createDataChangeRequest`, `findPendingDataChangeRequests`, `countPendingDataChangeRequests`, `markDataChangeRequestReviewed`
- `backend/src/modules/professionals/professionals.service.ts` — `adminUpdate` con detección de campos sensibles y flag `triggeredByProfessional`
- `backend/src/modules/professionals/professionals.controller.ts` — `getPendingDataChanges`, `countPendingDataChanges`, `markDataChangeReviewed`; `updateProfile` pasa `triggeredByProfessional: true`
- `backend/src/modules/professionals/professionals.routes.ts` — 3 nuevas rutas bajo `/professionals/data-changes/*`
- `frontend/src/lib/admin-api.ts` — `getPendingDataChanges`, `countPendingDataChanges`, `markDataChangeReviewed`
- `frontend/src/components/admin/AdminLayout.tsx` — badge con contador + polling 60s
- `frontend/src/pages/admin/ProfessionalDetailPage.tsx` — sección de cambios pendientes
- `frontend/src/pages/panel/components/ProfessionalProfileEdit.tsx` — banner en Tab Identidad

### Plans (ACTUALIZADO AUT-340)

| Endpoint         | Método | Descripción                      | Rol mínimo |
|-----------------|--------|----------------------------------|-----------|
| `/plans`        | GET    | Lista todos los planes (pública, usada por `/planes?pro=`) | Sin auth  |
| `/plans`        | POST   | Crear plan (nombre, precio, descuento anual, lista de features/beneficios) | SUPERADMIN|
| `/plans/:id`    | PATCH  | Editar nombre, precio, descuento anual, estado activo/inactivo, features | SUPERADMIN|
| `/plans/:id`    | DELETE | Desactivar plan (`isActive: false`), no lo elimina físicamente | SUPERADMIN|

**Campos del modelo Plan (ACTUALIZADO AUT-340):**
- `features Json?` — array de strings con beneficios del plan (ej: `["Hasta 10 pedidos/mes", "Soporte prioritario"]`)
- `name` en update valida que no exista otro plan con el mismo nombre

**Métodos del repositorio:**
- `create(data: CreatePlanInput)` — `CreatePlanInput` extendido con `features?: string[]`
- `update(id, data: UpdatePlanInput)` — `UpdatePlanInput` extendido con `name?`, `isActive?`, `features?`
- `deactivate(id)` — nuevo método, pone `isActive: false`

### Memberships

| Endpoint                                  | Método | Descripción                          | Rol mínimo |
|------------------------------------------|--------|--------------------------------------|-----------|
| `/professionals/:id/membership`          | GET    | Estado actual de membresía + trial   | OPERATOR  |
| `/professionals/:id/membership`          | POST   | Activar membresía manualmente        | SUPERADMIN|

**Servicios internos:**

| Método                          | Descripción                                                     |
|--------------------------------|-----------------------------------------------------------------|
| `canReceiveRequests()`         | Determina si el profesional puede recibir pedidos (membresía activa o trial disponible) |
| `activateMembership()`         | Activa membresía manualmente (admin)                             |
| `activateFromPayment()`        | Activa membresía vía pago de MercadoPago                        |
| `getStatus()`                  | Estado completo: membresía + trial                              |
| `getActiveMembership()`        | Membresía activa actual del profesional                         |
| `sendExpirationReminders()`    | Cron job diario (10:00 AM): detecta membresías por vencer y envía notificación WhatsApp con `sendWithWindowCheck` (AUT-330) |

**Campo anti-duplicados (AUT-330):**
- `Membership.renewalReminderSentAt DateTime?`: registra cuándo se envió el reminder de renovación. Evita envíos duplicados en el mismo ciclo (`null` = no enviado, fecha = ya enviado). Se limpia automáticamente cuando la membresía ya expiró (`clearExpiredReminderFlags`).

**Configuración:**
| Key                               | Default | Descripción                                    |
|-----------------------------------|---------|------------------------------------------------|
| `MEMBERSHIP_REMINDER_DAYS_AHEAD`  | `"3"`   | Días de anticipación para enviar el reminder   |

### Notifications (AUT-195, ACTUALIZADO AUT-213, AUT-287)

Servicio de despacho de notificaciones WhatsApp para eventos del ciclo de vida del pedido. Encapsula `WhatsAppAdapter` y expone métodos semánticos por evento.

**Servicios internos:**

| Método                              | Descripción                                                          |
|-------------------------------------|----------------------------------------------------------------------|
| `notifyProfessionalAssigned()`      | Notifica al profesional cuando se le asigna un nuevo pedido. Incluye `technicalBrief` (truncado a 800 chars) como 3er parámetro del template o inline en texto libre (AUT-276) |
| `notifyUserRequestAccepted()`       | Notifica al usuario cuando el profesional acepta su pedido. Incluye badge "✓ Profesional matriculado" cuando `category.requiresLicense === true` y `professional.licenseStatus === 'APPROVED'` (AUT-343) |
| `notifyProfessionalReminder()`      | Recordatorio al profesional por pedido sin respuesta (Stage 1 timeout); template con `categoryName` y `zoneName` |
| `notifyProfessionalReassigned()`    | Notifica al nuevo profesional cuando hay reasignación (Stage 2). Incluye `technicalBrief` (truncado a 800 chars) como 3er parámetro del template o inline en texto libre (AUT-276) |
| `notifyUserNoResponse()`            | Notifica al usuario que no se encontró profesional disponible. Se invoca en `processTimeouts` tanto para CREATED→NO_RESPONSE como para ASSIGNED timeout sin reemplazo (AUT-287) |
| `notifyProfessionalCancelledByUser()` | Notifica al profesional que el usuario canceló; usa `nora_pro_usuario_cancelo_pedido` (sin visita) o `nora_pro_usuario_cancelo_visita` (con visita) según `hasConfirmedVisit` |
| `notifyUserProfessionalCancelled()` | Notifica al usuario que el profesional canceló el pedido; usa template distinto según si había visita confirmada |
| `notifyUserDescriptionMismatch()` | Notifica al usuario en step DESCRIPTION_MISMATCH (INVALID) con template `nora_user_descripcion_no_relacionada` y botones cambiar/reformular (AUT-295) |
| `notifyUserConfirmService()` | Notifica al usuario en step DESCRIPTION_MISMATCH (UNCERTAIN) con template `nora_user_confirmar_servicio` y botones sí/cambiar (AUT-295) |

**Lógica de negocio:**
- Todos los métodos capturan errores de envío y loguean sin propagar la excepción
- Método privado `sendWithWindowCheck()` centraliza la verificación de ventana de 24hs con `shouldUseTemplate()` antes de cada envío
- Dentro de la ventana → envía texto libre; fuera de la ventana → envía template específica por evento
- Cada método público usa su template correspondiente (ver tabla en AUT-213)
- `notifyProfessionalAssigned()` y `notifyProfessionalReassigned()` incluyen opciones de WhatsApp para respuesta directa del profesional: `1. Aceptar` / `2. Rechazar`, e incluyen el `technicalBrief` generado por IA en el mensaje (template o texto libre). Si no hay brief, se envía `'Sin detalles adicionales del problema.'`. El brief se trunca a 800 caracteres.
- Inyectado en `RequestsService` y `RequestsController` para notificaciones inmediatas (no via `pendingMessage`)
- `notifyUserNoResponse()` se invoca en `processTimeouts` tanto cuando un request ASSIGNED expira sin reemplazo como cuando un request CREATED expira sin candidatos (AUT-287)

### Notifications (AUT-213) — Centralización de ventana 24hs y templates WhatsApp

Centralización de la verificación de ventana de 24hs en `notification.service.ts`, `coordination.service.ts`, `payments.service.ts` y `requests.controller.ts`. Ningún envío de WhatsApp llama directo a `sendText` sin verificar la ventana.

**20 templates WhatsApp definidas (categoría `UTILITY`):**

Número profesional: 7665 / Número usuario: 7668

| # | Nombre | Contenido | Params |
|---|--------|-----------|--------|
| 1 | `nora_pro_nuevo_pedido` | Tenés un nuevo pedido de {{1}} en {{2}}. Ingresá a tu panel para aceptarlo o rechazarlo. | categoryName, zoneName |
| 2 | `nora_pro_recordatorio_pedido` | Tenés un pedido pendiente de respuesta. Aceptalo o rechazalo desde tu panel antes de que venza el tiempo. | categoryName, zoneName |
| 3 | `nora_pro_visita_recordatorio` | Recordatorio: mañana a las {{1}} tenés visita con {{2}} en {{3}}. ¿Confirmás? Respondé "Confirmo" o "Cancelar" si no podés asistir. | hora, userName, dirección |
| 4 | `nora_pro_pedido_cancelado` | ~~El usuario canceló el pedido. Quedás disponible para nuevas asignaciones.~~ (eliminada en AUT-225, template huérfana) | ninguno |
| 5 | `nora_pro_membresia_activada_con_pedido` | ¡Tu membresía fue activada! El pedido de {{1}} en {{2}} ya está asignado a vos. Aceptalo o rechazalo desde tu panel. | categoryName, zoneName |
| 6 | `nora_pro_membresia_activada` | ¡Tu membresía fue activada! Ya podés recibir pedidos en NORA. | ninguno |
| 7 | `nora_pro_upgrade_membresia` | Hay un pedido de {{1}} en {{2}} esperándote. Activá tu membresía para recibirlo: {{3}} | categoryName, zoneName, url |
| 8 | `nora_user_pedido_aceptado` | ¡Buenas noticias! {{1}} aceptó tu pedido de {{2}}. Te vamos a coordinar la visita. | professionalName, categoryName |
| 9 | `nora_user_sin_profesional` | No encontramos un profesional disponible para tu pedido en este momento. Podés intentarlo nuevamente más tarde. | ninguno |
| 10 | `nora_user_visita_recordatorio` | Recordatorio: {{1}} visita tu domicilio mañana a las {{2}}. Si necesitás reprogramar, escribinos. | professionalName, hora |
| 11 | `nora_user_trabajo_finalizado` | {{1}}, tu {{2}}, indicó que finalizó el trabajo. ¿Cómo te fue? | professionalName, categoryName |
| 12 | `nora_user_horario_alternativo` | {{1}}, tu {{2}}, no puede {{3}}. Propone el {{4}}. ¿Te viene bien? | professionalName, categoryName, availability, fechaHora |
| 13 | `nora_user_visita_confirmada` | {{1}}, tu {{2}}, confirmó la visita para el {{3}} a las {{4}}. Para que pueda encontrarte, indicanos tu dirección exacta. | professionalName, categoryName, día, hora |
| 14 | `nora_user_reasignando_por_negociacion` | No pudimos coordinar un horario con {{1}}, tu {{2}}. Estamos buscando otro profesional disponible para tu pedido. | professionalName, categoryName |
| 15 | `nora_user_pro_cancelo_pedido` | El profesional canceló el pedido. Quedás disponible para buscar uno nuevo. | professionalName, categoryName |
| 16 | `nora_user_pro_cancelo_visita` | El profesional asignado a tu pedido canceló la visita. Estamos buscando otro disponible. | professionalName, categoryName, fechaHora |
| 17 | `nora_user_descripcion_no_relacionada` | Lo que describís no parece relacionado con un servicio de {{1}}. ¿Qué querés hacer? | categoryName (AUT-295) |
| 18 | `nora_user_confirmar_servicio` | Antes de continuar, ¿tu problema está relacionado con un servicio de {{1}}? | categoryName (AUT-295) |

*Nota: Las templates 17 (`nora_pro_cliente_acepto_horario`), 18 (`nora_pro_visita_confirmada_ubicacion`) y 19-20 (templates de profesional para finalización y calificación: `nora_pro_check_finalizacion`, `nora_pro_check_finalizacion_ultimo`, `nora_pro_pedir_calificacion_usuario`) ya tienen punto de consumo en el código (AUT-227). Templates de usuario `nora_user_buscando_profesional`, `nora_user_profesional_cancelado`, `nora_user_profesional_cancelo`, `nora_user_horario_propuesto_pro` y `nora_user_pedir_calificacion` fueron eliminadas en AUT-223. Template 4 (`nora_pro_pedido_cancelado`) eliminada en AUT-225 (huérfana). Templates profesionales agregadas en AUT-225: `nora_pro_usuario_cancelo_pedido`, `nora_pro_usuario_cancelo_visita`, `nora_pro_visita_confirmada` (consumidas en AUT-227). Template agregada en AUT-244: `nora_pro_bienvenida` — mensaje de bienvenida al aprobar un profesional (params: name, trialRequestsLimit).*

**Método `sendWithWindowCheck()` presente en 4 servicios:**

- `NotificationService.sendWithWindowCheck()` — consume `shouldUseTemplate()`, decide template vs texto libre
- `CoordinationService.sendWithWindowCheck()` — ídem para notificaciones de coordinación
- `PaymentsService.sendWithWindowCheck()` — ídem para notificaciones de pago/membresía
- `ProfessionalsService.approve()` — consume `shouldUseTemplate()` directamente para decidir entre `sendTemplate('nora_pro_bienvenida')` y `sendText` (AUT-244)

**Archivos modificados (AUT-213):**
- `notification.service.ts` — `sendWithWindowCheck()` + 8 templates asignadas a métodos públicos
- `coordination.service.ts` — `sendWithWindowCheck()` + templates para confirmVisit/sendReminders/notifyWorkFinished/checkWorkCompletion; métodos `notifyProfessionalVisitConfirmed()` y `notifyProfessionalClientAcceptedSchedule()` (AUT-227)
- `payments.service.ts` — `sendWithWindowCheck()` + 3 templates (upgrade, membresía activada con/sin pedido) + `APP_URL` para link de planes
- `requests.controller.ts` — `cancelByProfessional` usa `nora_user_pro_cancelo_pedido` o `nora_user_pro_cancelo_visita` según `hadConfirmedVisit`
- `requests.repository.ts` — `findWaitingRequestForProfessional` incluye `category.name` y `geoNode.name` para params de template
- `backend/.env` / `.env.example` — `APP_URL` configurado para link de planes en `payments.service.ts`

### AUT-224 — Ajustes de lógica de bot para templates de usuario rediseñados

Alineación de textos, parámetros y casos de uso con los templates rediseñados en AUT-223.

**Cambios en `notification.service.ts`:**
- `notifyUserRequestAccepted`: texto actualizado para incluir instrucciones de formato de fecha/hora
- `notifyUserProfessionalCancelled`: firma extendida con `hadConfirmedVisit`, `scheduledAt`, `professionalName`, `categoryName`; usa `nora_user_pro_cancelo_visita` o `nora_user_pro_cancelo_pedido` según el caso

**Cambios en `coordination.service.ts`:**
- `notifyWorkFinished`: incluye `category` en la query; parámetros `[professionalName, categoryName]` y texto actualizado con opciones numeradas
- `confirmVisit`: bug corregido — mensaje de error de formato inválido no usa template; horario alternativo incluye `categoryName` como parámetro y opciones numeradas; visita confirmada incluye `categoryName` como parámetro

**Cambios en `coordination.flow.ts`:**
- Todas las opciones presentadas al usuario ahora están numeradas (`1. Sí\n2. No`, `1. Confirmo\n2. Cancelar`)
- Paso de negociación agotada: mensaje actualizado con nombre del profesional y categoría para el template `nora_user_reasignando_por_negociacion`

**Cambios en `requests.controller.ts`:**
- `cancelByProfessional`: usa `nora_user_pro_cancelo_visita` (con `professionalName`, `categoryName`, `formattedDate`) cuando hay visita confirmada, o `nora_user_pro_cancelo_pedido` (con `professionalName`, `categoryName`) en caso contrario

**Cambios en `requests.service.ts`:**
- `cancelByProfessional`: agrega `professionalName` y `categoryName` al retorno

**Cambios en `user-request.flow.ts` y `feedback.flow.ts`:**
- Todas las opciones presentadas al usuario ahora están numeradas (`1. Conforme\n2. Con observaciones\n3. No conforme`, `1. Sí\n2. No`, etc.)

### AUT-285 — Fix cancelación por profesional: mensaje único al usuario según disponibilidad de reemplazo

Corrige los mensajes al usuario cuando el profesional cancela desde el panel web.

**Problemas detectados:**
1. El mensaje no incluía el nombre del profesional
2. Si no había reemplazo disponible, se sobreescribía el mensaje de cancelación con "No encontramos un profesional disponible..."
3. El controller ya había sido migrado a `notificationService.notifyUserProfessionalCancelled()` (usa `sendWithWindowCheck` internamente)

**Cambios en `requests.service.ts`:**
- `cancelByProfessional`: reestructura el bloque de construcción de `userMessage`. El mensaje ahora incluye `professionalName` y combina cancelación + estado de búsqueda de reemplazo en un solo mensaje (sin sobreescritura). Cuatro variantes según `hadConfirmedVisit` y `match`:
  - Con visita + reemplazo: nombre, fecha, "buscando otro profesional para vos, te avisamos cuando confirme"
  - Con visita + sin reemplazo: nombre, fecha, "intentamos encontrar otro profesional pero no tuvimos éxito"
  - Sin visita + reemplazo: nombre, "buscando otro profesional para vos, te avisamos cuando confirme"
  - Sin visita + sin reemplazo: nombre, "intentamos encontrar otro profesional pero no tuvimos éxito"

**Archivos modificados:** `backend/src/modules/requests/requests.service.ts`

### AUT-293 — Fix: reset de BotSession del profesional al cancelar desde el panel web

Cuando el profesional cancela un pedido desde el panel web (`POST /requests/:id/cancel-by-professional`), se resetea su `BotSession` para evitar errores si el profesional escribe a WhatsApp después de cancelar.

**Problema detectado:**
- Al cancelar desde el panel, la sesión mantenía `currentFlow: COORDINATION` y `currentStep: AWAITING_CONFIRMATION` con el `requestId` del pedido cancelado en `tempData`
- Si el profesional escribía a WhatsApp después de cancelar, el bot intentaba procesar el mensaje en el contexto del pedido cancelado → `PrismaClientValidationError` por `id: undefined`

**Fix en `requests.service.ts`:**
- `cancelByProfessional`: después de cancelar el request y antes de retornar, consulta el teléfono del profesional y resetea su `BotSession` vía `botRepository.upsert` con `currentFlow: null`, `currentStep: null`, `tempData: {}`
- Esto asegura que si el profesional escribe a WhatsApp después de cancelar, el bot arranque desde cero sin errores

**Archivos modificados:** `backend/src/modules/requests/requests.service.ts`

### AUT-227 — Ajustes de lógica de bot para templates de profesionales rediseñados

Alineación de textos, parámetros y casos de uso con los templates de profesionales rediseñados en AUT-225.

**Cambios en `notification.service.ts`:**
- `notifyProfessionalCancelledByUser`: dividido en dos templates según `hasConfirmedVisit` — usa `nora_pro_usuario_cancelo_visita` (con `formattedDate`) o `nora_pro_usuario_cancelo_pedido` (sin params)
- `notifyProfessionalReminder`: ahora recibe y pasa `categoryName` y `zoneName` como parámetros al template `nora_pro_recordatorio_pedido`
- `RequestBasicInfo` ahora incluye `zoneName`

**Cambios en `requests.service.ts`:**
- `processTimeouts`: obtiene `categoryName` y `zoneName` reales de la request (via `findRequestsForReminder` con include ampliado)
- `accept`: pasa `zoneName` en el `RequestBasicInfo` a `notifyUserRequestAccepted`

**Cambios en `matching.repository.ts`:**
- `findRequestsForReminder`: incluye `category.name`, `geoNode.name` y `assignedProfessional.name` en la query

**Cambios en `coordinations.service.ts`:**
- `sendReminders`: pasa `userName` (2do param) y `address` (3er param) al template `nora_pro_visita_recordatorio`
- `checkWorkCompletion` primer intento: texto y parámetros actualizados (`nora_pro_check_finalizacion` con `[address, userName]`)
- `checkWorkCompletion` segundo intento: elimina `panelUrl`, agrega `userName`, texto actualizado (`nora_pro_check_finalizacion_ultimo` con `[address, userName]`)
- Nuevo método `notifyProfessionalVisitConfirmed()`: envía `nora_pro_visita_confirmada_ubicacion` con botón URL si hay coordenadas GPS, o `nora_pro_visita_confirmada` sin botón si no hay coordenadas
- Nuevo método `notifyProfessionalClientAcceptedSchedule()`: envía `nora_pro_cliente_acepto_horario` con `[userName, dayName, hora]`

**Cambios en `coordination.flow.ts`:**
- Ahora recibe `CoordinationService` como dependencia
- `handleAwaitingLocation`: reemplaza `pendingNotification` por llamada directa a `coordinationService.notifyProfessionalVisitConfirmed()`
- `handleAwaitingUserConfirmation`: reemplaza `pendingNotification` por llamada directa a `coordinationService.notifyProfessionalClientAcceptedSchedule()`

**Cambios en `feedback.flow.ts`:**
- `handleFeedbackComment`: pasa `userName` como parámetro al template `nora_pro_pedir_calificacion_usuario`
- `handleAwaitingWorkCompletion`: detecta último intento (`completionAttempt >= 2`) y dispara escalada via `requestsService.reportNoncompliance()` cuando el profesional responde "No pude completarlo"

**Cambios en `option-resolver.helper.ts`:**
- `AWAITING_WORK_COMPLETION`: agrega aliases numéricos `'1'` (DONE) y `'2'` (PENDING) + `'no pude completarlo'`

**Cambios en `requests.repository.ts`:**
- `findByIdWithCoordination`: incluye `geoNode.name` en la query

### AUT-229 — Soporte de quick reply buttons en templates de WhatsApp

Implementación de botones de quick reply en templates de WhatsApp para reemplazar la necesidad de tipear opciones. El usuario/profesional toca un botón y el sistema interpreta el payload como texto.

**Cambios en `whatsapp-adapter.ts`:**
- Nueva interfaz `WhatsAppInteractiveMessage` con `type: 'interactive'` y `interactive.button_reply`
- `parseWebhook`: nuevo caso para mensajes `interactive.button_reply` — mapea `button_reply.id` a `message.text` y `message.buttonPayload` para compatibilidad con `resolveOption`
- Nuevo método `sendTemplateWithQuickReplies(phone, templateName, bodyParams, buttons, role)`: envía templates con quick reply buttons vía `sub_type: 'quick_reply'` y `type: 'payload'`

**Cambios en `types.ts` (bot/flows):**
- `IncomingMessage`: agregado campo opcional `buttonPayload?: string`

**Cambios en `option-resolver.helper.ts`:**
- 8 steps actualizados con payloads de botones como aliases:
  - `AWAITING_ACCEPTANCE`: `ver_detalles`, `no_puedo`
  - `AWAITING_USER_CONFIRMATION`: `si_me_viene`, `no_me_viene`
  - `AWAITING_VISIT_CONFIRMATION`: `confirmo_visita`, `no_puedo_ir`
  - `AWAITING_WORK_COMPLETION`: `si_finalice`, `no_pude`
  - `FEEDBACK_SATISFACTION`: `conforme_btn`, `observaciones_btn`, `no_conforme_btn` + numéricos `1`, `2`, `3`
  - `FEEDBACK_RECOMMEND`: `si_recomiendo`, `no_recomiendo` + numéricos `1`, `2`
  - `FEEDBACK_PRO_RECOMMEND`: `si_volveria`, `no_volveria` + numéricos `1`, `2`

**Cambios en `sendWithWindowCheck()` (3 servicios):**
- `NotificationService`, `CoordinationService` y `PaymentsService`: método `sendWithWindowCheck()` acepta parámetro opcional `buttons: Array<{ payload: string; text?: string }>`. Cuando está fuera de ventana de 24hs y hay buttons, usa `sendTemplateWithQuickReplies` en vez de `sendTemplate`.

**Templates con quick reply buttons (8 templates):**

| Template | Botones | Servicio/Método |
|----------|---------|-----------------|
| `nora_pro_nuevo_pedido` | `ver_detalles` / `no_puedo` | `NotificationService.notifyProfessionalWithDetails` |
| `nora_pro_recordatorio_pedido` | `ver_detalles` / `no_puedo` | `NotificationService.notifyProfessionalReminder` |
| `nora_pro_membresia_activada_con_pedido` | `ver_detalles` / `no_puedo` | `PaymentsService.processPaymentWebhook` |
| `nora_pro_visita_recordatorio` | `confirmo_visita` / `no_puedo_ir` | `CoordinationService.sendReminders` |
| `nora_pro_check_finalizacion` | `si_finalice` / `pendiente` | `CoordinationService.checkWorkCompletion` (1er intento) |
| `nora_pro_check_finalizacion_ultimo` | `si_finalice` / `no_pude` | `CoordinationService.checkWorkCompletion` (2do intento) |
| `nora_user_trabajo_finalizado` | `conforme_btn` / `observaciones_btn` / `no_conforme_btn` | `CoordinationService.notifyWorkFinished` |
| `nora_user_horario_alternativo` | `si_me_viene` / `no_me_viene` | `CoordinationService.confirmVisit` |

### AUT-230 — Correcciones en flujos del bot: bug ver_detalles, opciones numeradas en AWAITING_CONFIRMATION y WAITING_CONSENT

Correcciones de bugs y UX en los flows de coordinación y pedido de usuario.

**Bug `ver_detalles` mapeado incorrectamente en `AWAITING_ACCEPTANCE`:**

El alias `ver_detalles` estaba dentro de `ACCEPT` en `option-resolver.helper.ts`, lo que causaba que al tocar el botón "Ver los detalles" del template de WhatsApp, el bot aceptara el pedido directamente sin mostrar los detalles.

- **`option-resolver.helper.ts`**: removido `'ver_detalles'` de los aliases de `ACCEPT` en `AWAITING_ACCEPTANCE`
- **`coordination.flow.ts` — `handleAwaitingAcceptance`**: agregado `'ver_detalles'` a la lista de inputs que disparan mostrar detalles
- **`coordination.flow.ts` — fallback `AWAITING_ACCEPTANCE`**: actualizado a `1. Ver detalles\n2. Rechazar`

**Opciones numeradas en `AWAITING_CONFIRMATION`:**

- **`coordination.flow.ts` — línea 284**: mensaje al profesional ahora incluye opciones numeradas: `\n1. Sí\n2. Proponer otro horario (escribí: DD/MM HH:MM)`
- **`coordination.flow.ts` — fallback línea 563**: mismo cambio en el mensaje de fallback

**Opciones numeradas en `WAITING_CONSENT`:**

- **`user-request.flow.ts` — primera ocurrencia (~línea 437)**: texto agregado `\n1. Sí\n2. No` al final del mensaje
- **`user-request.flow.ts` — segunda ocurrencia/fallback (~línea 517)**: mismo cambio

### Notifications (AUT-199)

Extensión del módulo de notificaciones para envío de media del pedido al profesional (fotos y audio) con comportamiento adaptativo según ventana de 24hs de WhatsApp.

**Lógica de negocio:**
- Si el profesional está fuera de ventana de 24hs: envía plantilla `nora_pro_nuevo_pedido` (`{{1}}` rubro, `{{2}}` zona) y difiere el envío de media hasta que responda "Ver detalles"
- Si el profesional está dentro de ventana de 24hs: envía texto completo + opciones + fotos (`sendImage`) + audio (`sendAudio`) en el mismo flujo
- `AWAITING_ACCEPTANCE` en `CoordinationFlow` reconoce "Ver detalles", prioriza `tempData` del flujo (con fallback a DB) y devuelve `mediaUrls` + `audioUrl` para despacho por webhook
- `BotResponse` incorpora `audioUrl?: string` y `webhooks.routes.ts` envía fotos/audio luego del texto con `try/catch` por archivo para no cortar el flujo
- `sendAudio()` falla silenciosamente con logging y no interrumpe el flujo

### Simulator (AUT-268)

Endpoint de polling para mensajes externos enviados por el backend cuando el modo simulador está activo (tokens de WhatsApp vacíos). Permite que la ventana del simulador muestre mensajes como el de bienvenida al aprobar un profesional.

| Endpoint                    | Método | Descripción                                                      | Auth      |
|-----------------------------|--------|------------------------------------------------------------------|-----------|
| `/simulator/messages`       | GET    | Retorna y vacía mensajes pendientes para phone+role. Solo disponible en modo simulador; retorna array vacío si los tokens están configurados. | Sin auth  |

**Query params:** `phone` (requerido), `role` (`USER` | `PROFESSIONAL`, requerido)

**Response:**
```json
{ "messages": [{ "id": "sim-...", "phone": "...", "role": "PROFESSIONAL", "type": "text", "content": "...", "timestamp": "..." }] }
```

- Implementado en `backend/src/routes/simulator.routes.ts`. `isSimulatorMode()` verifica `WHATSAPP_API_TOKEN_USER` + `WHATSAPP_PHONE_NUMBER_ID_USER` + `WHATSAPP_PHONE_NUMBER_ID_PROFESSIONAL` (sin `WHATSAPP_API_TOKEN_PROFESSIONAL`, alineado con `isConfigured()` del adapter — AUT-281)
- Cola en memoria: `backend/src/lib/simulator-queue.ts` (max 100 mensajes, FIFO)
- El frontend hace polling cada 2 segundos vía `useChat.ts` → `startSimulatorPolling()`

### Payments (AUT-188)

Módulo de integración con MercadoPago Checkout Pro para activación de membresías vía pago.

| Endpoint                     | Método | Descripción                          | Auth      |
|-----------------------------|--------|--------------------------------------|-----------|
| `/webhooks/mercadopago`     | POST   | Webhook de MercadoPago (IPN)         | HMAC      |
| `/payments/link`            | POST   | Genera link de pago para un profesional y plan | Sin auth  |

**Servicios internos:**

| Método                                  | Descripción                                                     |
|----------------------------------------|-----------------------------------------------------------------|
| `generatePaymentLink()`                | Crea link de pago de MP con `external_reference = professionalId:planId` |
| `notifyTrialExhaustedProfessionals()`  | Envía WhatsApp a profesionales con trial agotado con links de pago (AUT-213: template `nora_pro_upgrade_membresia` + URL `/planes?pro=`) |
| `verifyWebhookSignature()`             | Valida firma HMAC-SHA256 del webhook con `x-signature` (`ts`, `v1`) + `x-request-id` |
| `processPaymentWebhook()`              | Procesa pago aprobado: activa membresía, reactiva pedido, notifica |
| `getTrialLimit()`                      | Lee límite de trial desde SystemConfig                         |

**Lógica de negocio:**

- El link de pago se genera dinámicamente con `external_reference` en formato `professionalId:planId`
- `createPaymentLink()` configura `back_urls` hacia `${APP_URL}/planes/gracias`, `${APP_URL}/planes/error` y `${APP_URL}/planes/pendiente`
- El webhook responde 200 inmediatamente a MP y procesa de forma asíncrona
- Al confirmar pago (`status = approved`), se activa membresía mensual para el profesional con `activatedBy = 'mercadopago'`
- Si existe un pedido en `NO_RESPONSE` con `waitingUserConsent = true` que coincida en categoría y zona, se reactiva para ese profesional
- Múltiples pagos para el mismo pedido: solo el primero recibe el pedido, los demás quedan con membresía activa
- Si `MERCADOPAGO_ACCESS_TOKEN` no está configurado, el servidor arranca pero falla al intentar generar un link de pago
- Las notificaciones a profesionales pasan por `PaymentsService.sendWithWindowCheck()` que respeta la ventana de 24hs y usa templates específicas por evento (AUT-213)

### Reputation

Servicio interno, invocado por el módulo de Pedidos, Profesionales y los endpoints de calificación.

| Método                     | Descripción                                                     |
|---------------------------|-----------------------------------------------------------------|
| `applyPenalization()`     | Cuenta NOT_FULFILLED, aplica OBSERVATION o SUSPENDED             |
| `evaluateBadge()`         | Otorga badge si cumplimiento 100% y completados ≥ umbral         |
| `removeBadgeIfActive()`   | Remueve badge al recibir NOT_FULFILLED                          |
| `getReputationBreakdown()`| Calcula promedios on-the-fly desde feedbacks: rating, puntualidad, calidad, comunicación, precio justo, % recomendación |

| Método                  | Descripción                                         |
|-------------------------|-----------------------------------------------------|
| `applyPenalization()`   | Cuenta NOT_FULFILLED, aplica OBSERVATION o SUSPENDED |
| `evaluateBadge()`       | Otorga badge si cumplimiento 100% y completados ≥ umbral |
| `removeBadgeIfActive()` | Remueve badge al recibir NOT_FULFILLED              |

**Lógica de penalizaciones:**
- 1er NOT_FULFILLED → status OBSERVATION (sigue en pool de matching)
- 2do+ NOT_FULFILLED → status SUSPENDED (sale del pool) + alerta `PROFESSIONAL_AUTO_SUSPENDED`
- Ejecutado en la misma transacción que el evento NOT_FULFILLED
- El historial de eventos nunca se borra

**Badge automático:**
- Otorgar: count(NOT_FULFILLED) = 0 AND count(COMPLETED) ≥ `BADGE_MIN_COMPLETED_REQUESTS` (default: 10)
- Quitar: al recibir NOT_FULFILLED con badge activo → `hasBadge = false`
- Evaluado en cada COMPLETED (confirmación y auto-complete)

**Matching (actualizado, AUT-235, AUT-239, AUT-240):**
- `findEligibleProfessionals` ahora incluye status ACTIVE y OBSERVATION
- SUSPENDED queda fuera del pool
- **Factores de scoring (12 pesos configurables)**:
  - `weightCompliance` (0.17): penalización por incumplimientos con decaimiento temporal
  - `weightResponseRate` (0.20): penalización por pedidos sin respuesta
  - `weightQualityRating` (0.10): rating histórico con ajuste de tendencia reciente
  - `weightProximity` (0.10): distancia haversine entre usuario y profesional
  - `weightRecommendation` (0.10): tasa de recomendación del usuario
  - `weightDistribution` (0.05): distribución equitativa con bonus por días sin asignación
  - `weightPlan` (0.05): prioridad por plan de membresía
  - `weightAcceptance` (0.05): tasa de aceptación sobre asignaciones
  - `weightCompletion` (0.05): tasa de finalización sobre pedidos aceptados
  - `weightResponseTime` (0.03): penalización por tiempo de respuesta promedio
  - `weightSentiment` (0.05): análisis de sentimiento IA sobre comentarios de feedback (AUT-235)
  - `weightSpecialization` (0.08): especialización por tipo de problema basada en historial acumulado (AUT-240)
- **Sentiment analysis (AUT-235)**: `analyzeSentiment()` en `feedback.flow.ts` procesa comentarios de texto libre con LLM (`callLLM`) en background. Extrae 5 dimensiones (puntualidad, precio_justo, calidad_trabajo, limpieza, actitud) + recomendable. Guarda resultado en `Feedback.sentimentAnalysis` (JSON). `getSentimentScores()` en `MatchingRepository` calcula score normalizado 0-100 por profesional agregando todos sus feedbacks con análisis de sentimiento. El score base es 50 (neutro) para profesionales sin análisis.
- **Problem type specialization (AUT-240, ACTUALIZADO AUT-251)**: el análisis LLM se ejecuta de forma síncrona dentro de `create()` en `requests.service.ts` antes de `findBestCandidate`. Clasifica cada pedido extrayendo `problemType` (snake_case), `isUrgent` y `mentionedDate`. Estos valores se pasan directamente al matching inicial y se persisten en DB via fire-and-forget después del match. Al completar trabajo con satisfacción (`SATISFIED`/`PARTIAL`), `requests.service.ts` acumula el `problemType` en `Professional.problemTypeStats` (JSON, contador por tipo). `getProblemTypeStats()` en `MatchingRepository` carga las estadísticas. `computeSpecialization()` en `MatchingService` las usa como factor de scoring: si no hay `problemType` en el pedido o el profesional no tiene historial → 50 (neutro); si tiene historial → ratio `count/total * 100 * 3` (máx 100). `findBestCandidate()` acepta parámetro opcional `problemType`. Peso configurable via `MATCHING_WEIGHT_SPECIALIZATION` (default 0.08).

- **Detección híbrida de matrícula (AUT-343)**: sistema de dos niveles para detectar si el usuario pide explícitamente un profesional matriculado (solo para categorías con `requiresLicense = true`):
  1. **Keywords (sin LLM)**: busca en `description` y `technicalBrief` 48 palabras clave (matrícula, habilitado, certificado, credencial, licencia, autorizado, ENARGAS, título, etc.). Si matchea → `requiresLicensedProfessional = true`. Case-insensitive.
  2. **LLM fallback** (solo si keywords no matchea): `userRequestsLicenseByLLM()` en `llm-client.ts` con prompt simple "¿El usuario está pidiendo explícitamente que el profesional tenga matrícula...? Responde SI o NO". Si el LLM falla → default `false`.
  - Si `requiresLicensedProfessional = true`: filtra SOLO profesionales con `licenseStatus = 'APPROVED'`. Si ninguno → pedido queda en `CREATED`, usuario recibe mensaje de espera. Si alguno → asignación normal.
  - Si `requiresLicensedProfessional = false`: todos los elegibles compiten. Profesionales con `licenseStatus = 'APPROVED'` reciben bonus `+0.1` en el score final.
  - `MatchResult` extendido con `requiresLicensedProfessional?: boolean`. `findBestCandidate()` recibe nuevo parámetro `description?: string | null`.
  - Badge "✓ Profesional matriculado" en `notifyUserRequestAccepted()` cuando `category.requiresLicense === true` y `professional.licenseStatus === 'APPROVED'`.
  - `findByIdWithCoordination()` extendido con `licenseStatus` y `requiresLicense`.
  - `ProfessionalInfo` extendido con `licenseStatus`. `RequestBasicInfo` extendido con `requiresLicense`.
  - Archivos modificados: `llm-client.ts`, `matching.service.ts`, `requests.service.ts`, `requests.repository.ts`, `notification.service.ts`. No modifica `schema.prisma`.

- **Profesional preferido por historial (AUT-366, REGLA 1)**: si el usuario tuvo un pedido COMPLETED en la misma categoría con un profesional y el feedback fue positivo (`wouldRecommend: true` Y promedio de ratings ≥ 4), NORA intenta asignar ese profesional primero. Si pasa los hard filters (activo, con cupo, etc.), se asigna directamente con score 100 sin pasar por scoring. Si no está disponible, cae al scoring normal.
- **Profesional excluido por historial (AUT-366, REGLA 2)**: si el usuario dejó `wouldRecommend: false` para un profesional en un pedido COMPLETED de la misma categoría, ese profesional se agrega automáticamente a `excludedProfessionalIds` antes de `findEligibleProfessionals`, por lo que nunca aparece en el matching para ese usuario.
- `findBestCandidate()` acepta nuevo parámetro opcional `userId?: string`. Si no se pasa, el comportamiento es el actual sin cambios. Los 6 llamados en `requests.service.ts` (create, reject, processTimeouts CREATED, processTimeouts reassignment, cancelByProfessional, reassignAfterNegotiation) pasan `userId`.
- Nuevos métodos en `MatchingRepository`: `findPreferredProfessional(userId, categoryId)` y `findExcludedProfessionals(userId, categoryId)`. No modifica `schema.prisma`.

### Storage

| Endpoint                      | Método | Descripción                                                    | Auth      |
|------------------------------|--------|-----------------------------------------------------------------|-----------|
| `/storage/presign-upload`    | POST   | Genera URL pre-firmada para upload directo a Cloudflare R2      | Sin auth  |

**Validaciones de contentType por folder:**
- `request-photos`: `image/jpeg`, `image/png`, `image/webp`
- `request-audio`: `audio/webm`, `audio/mp4`, `audio/mpeg`, `audio/ogg`, `audio/wav`, `audio/webm;codecs=opus`
- `verification`: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`, `video/mp4`, `video/quicktime`

**Lógica de negocio:**
- El backend nunca recibe el contenido binario de los archivos
- El filename original se reemplaza por UUID internamente preservando la extensión
- La URL pre-firmada permite subir directo a R2 con PUT por el tiempo configurado (default: 3600s)

### Escalations

| Endpoint                   | Método | Descripción                          | Rol mínimo |
|---------------------------|--------|--------------------------------------|-----------|
| `/escalations`            | GET    | Lista paginada (filtros: status, professionalId) | OPERATOR  |
| `/escalations/:id`        | GET    | Detalle con request y usuario        | OPERATOR  |
| `/escalations/:id/status` | PATCH  | Cambiar status (OPEN→IN_REVIEW→RESOLVED) | OPERATOR  |
| `/escalations/:id/resolve`| PATCH  | Cerrar con resolución                | OPERATOR  |

**Transiciones de estado válidas:**
- OPEN → IN_REVIEW, RESOLVED
- IN_REVIEW → RESOLVED
- RESOLVED → (ninguna)

**Lógica de negocio:**
- Creada automáticamente al reportar incumplimiento (`reportNoncompliance`) en la misma transacción
- Dispara alerta `ESCALATION_CREATED`
- `resolve` requiere texto de resolución no vacío
- `resolvedBy` registra el adminId del operador que resuelve

### Bot

Módulo de conversación del bot de NORA. Agnóstico al canal de transporte (web o WhatsApp). Recibe mensajes de texto, imagen, audio y ubicación con un `phone` y un `role`, y retorna la respuesta que debe enviarse. El estado persiste en `BotSession`.

| Endpoint               | Método | Descripción                                          | Auth      |
|-----------------------|--------|------------------------------------------------------|-----------|
| `/bot/message`         | POST   | Procesa un mensaje entrante y retorna la respuesta    | Sin auth  |
| `/bot/session/reset`   | POST   | Resetea la sesión de un teléfono (para testing)       | Sin auth  |

**Arquitectura interna:**
```
POST /bot/message
  → BotController
  → BotService.processMessage(phone, message)
    → CAPA DE SEGURIDAD: SecurityService.check(phone, text) — rate limiting + injection detection + block check (AUT-312)
    → determina rol (input.role || 'USER')      // antes de cargar sesión, por phone_number_id del webhook
    → role=USER: Promise.all([findOrCreateByPhone, findByPhoneAndRole]) — queries en paralelo (AUT-311)
    → role=PROFESSIONAL: UsersService.findByPhone(phone) + BotRepository.findByPhoneAndRole(phone, role) secuencial
    → detectar pendingMessage (notificación proactiva de coordinación)
    → despachar al FlowHandler correspondiente
    → FlowHandler ejecuta el paso actual
    → procesar pendingNotification (notificar al otro participante)
    → actualiza sesión
    → retorna { text, mediaUrls?, options?, flow?, step?, requestId? }
```

**Capa de seguridad — SecurityService (AUT-312):**
- Intercepta **antes** de cualquier otra lógica en `processMessage()`, cubriendo tanto mensajes de WhatsApp real (webhook) como del simulador (`bot.routes.ts`).
- **Rate limiting**: máximo 10 mensajes por minuto por teléfono, cache en memoria (~0ms). Escritura asíncrona a `BotSecurity` para auditoría (no bloquea la respuesta).
- **Bloqueo temporal**: si `BotSecurity.blockedUntil > now()`, responde sin procesar. Si el bloqueo expiró, lo limpia asíncronamente.
- **Detección de prompt injection**: RegExp precompiladas (12 patrones) aplicadas sobre el texto del mensaje. Si detecta injection, responde genéricamente ("No entendí bien lo que necesitás...") sin revelar la detección. 3+ intentos → `blockedUntil` por 1 hora.

| Situación | Respuesta al usuario | DB | LLM |
|-----------|----------------------|----|-----|
| Rate limit excedido (>10 msg/min) | "Por favor esperá unos segundos..." | Escritura async | No |
| Bloqueo temporal activo | "Tu cuenta está temporalmente limitada..." | Solo lectura | No |
| Injection detectada (1er-2do intento) | "No entendí bien lo que necesitás..." | Escritura async | No |
| Injection detectada (3er+ intento) | "No entendí bien lo que necesitás..." + bloqueo 1hr | Escritura async | No |
| Mensaje normal | Flujo normal | Sin cambios | Sin cambios |

**Mensajería proactiva (pending notification):**
- `BotSession.tempData` puede contener `pendingMessage`: un mensaje que NORA necesita entregar proactivamente
- Cuando el usuario envía cualquier mensaje, si hay `pendingMessage`, se entrega primero y se limpia
- Los flujos de coordinación generan `pendingNotification` en `tempData` para notificar al otro participante:
  ```ts
  { targetPhone, targetRole, message, flow, step, tempData }
  ```
- `BotService` procesa la notificación: crea/actualiza la sesión del destinatario con el `pendingMessage`
- `CoordinationService.notifyWorkFinished(requestId)`: invocado por `POST /requests/:id/finish` y por `FEEDBACK/AWAITING_WORK_COMPLETION` cuando el profesional confirma "Finalicé". Envía WhatsApp al usuario y lo deja en `FEEDBACK_SATISFACTION` para continuar la calificación.

**Soporte de ubicación (WhatsApp location):**
- `POST /bot/message` acepta campo `location: { latitude, longitude }` en el body
- Si el proveedor no soporta reenvío de mensajes `location`, se genera un link de Google Maps: `https://maps.google.com/?q={lat},{lng}`

**Flujo PROFESSIONAL_REGISTER — disponibilidad estructurada (AUT-238, AUT-249):**
- Paso `ASK_AVAILABILITY` reemplazado por flujo interactivo de 4 sub-pasos (ASK_DAYS → ASK_HOURS → CONFIRM → guardar)
- `ASK_HOURS` unifica las preguntas de inicio/fin en una sola con parsing inteligente vía LLM (`callLLM` de `lib/llm-client.ts`), aceptando lenguaje natural (ej: "de 8 a 18", "9 a 17:30"). Si el LLM no puede interpretar con certeza pide aclaración con ejemplos; si falla técnicamente cae a formato exacto como fallback.
- Guarda `availabilityStructured` (JSON: `{ slots: [{ day, from, to }] }`) y `availability` (texto legible) en `Professional`

**Validación de estado del profesional al iniciar sesión (AUT-193):**
- Cuando un profesional escribe al canal de profesionales (7665) y no tiene sesión activa en `BotSession`, el bot consulta `ProfessionalsRepository.findByPhone(phone)` antes de arrancar cualquier flujo.
- Para `ACTIVE` y `OBSERVATION`, además consulta si el profesional tiene un pedido activo (`status IN (ASSIGNED, ACCEPTED)` y `assignedProfessionalId = professional.id`).

| Estado | Flow iniciado | Step | Mensaje |
|--------|--------------|------|---------|
| No existe (sin registro) | `PROFESSIONAL_REGISTER` | `ASK_NAME` | Comportamiento actual — arranca registro |
| `PENDING` (token vigente) | — | — | "¡Hola [nombre]! Todavía tenés el registro pendiente. Para activar tu cuenta en NORA completá la verificación desde este enlace: [verificationUrl]" |
| `PENDING` (token expirado) | — | — | "¡Hola [nombre]! Tu enlace anterior venció. Te generamos uno nuevo para que puedas completar tu verificación: [verificationUrl]" |
| `UNDER_REVIEW` | — | — | "Tu perfil está siendo revisado por nuestro equipo. Te notificaremos cuando esté listo." |
| `ACTIVE` (con pedido ASSIGNED) | `COORDINATION` | `AWAITING_ACCEPTANCE` | Profesional puede responder por WhatsApp: `1. Aceptar` / `2. Rechazar`; `tempData` incluye `requestId` |
| `ACTIVE` (con pedido ACCEPTED) | `COORDINATION` | `AWAITING_AVAILABILITY` | Arranca coordinación de visita; `tempData` incluye `requestId` |
| `ACTIVE` (sin pedido activo) | — | — | "Hola [nombre]! Tu cuenta está activa. Te notificaremos cuando tengas un nuevo pedido asignado." |
| `OBSERVATION` (con pedido ASSIGNED) | `COORDINATION` | `AWAITING_ACCEPTANCE` | Igual que ACTIVE, con prefijo de observación; `tempData` incluye `requestId` |
| `OBSERVATION` (con pedido ACCEPTED) | `COORDINATION` | `AWAITING_AVAILABILITY` | Arranca coordinación con prefijo de observación; `tempData` incluye `requestId` |
| `OBSERVATION` (sin pedido activo) | — | — | "Tu cuenta está en observación. Seguís operando normalmente. Te notificaremos cuando tengas un nuevo pedido asignado." |
| `PAUSED` | — | — | "Tu cuenta está pausada. Para reactivarla, ingresá a tu panel." |
| `SUSPENDED` | — | — | "Tu cuenta está suspendida. Para más información, contactá a soporte." |
| `REJECTED` | — | — | "Tu solicitud fue rechazada. Para más información, contactá a soporte." |

- Para los estados que no arrancan flujo, la sesión se guarda con `currentFlow: null` y `currentStep: null`. En el próximo mensaje, el bot re-evalúa el estado del profesional desde la DB — si el estado cambió (ej: un admin aprobó al profesional), se arranca el flujo correspondiente.
- **Sesión de registro obsoleta (AUT-196):** si existe sesión con `currentFlow = PROFESSIONAL_REGISTER` pero el profesional ya no está en etapa de registro, el bot evita ejecutar `SEND_LINK`:
  - `ACTIVE` / `OBSERVATION`: resetea sesión (`currentFlow/currentStep = null`) y reaplica la misma resolución de estado de AUT-193 (inicia coordinación si hay pedido activo o responde mensaje informativo)
  - `PAUSED` / `SUSPENDED` / `REJECTED`: resetea sesión y responde mensaje de estado correspondiente
  - `PENDING` / `UNDER_REVIEW`: conserva la sesión existente pero responde mensaje informativo de estado actual
- La lógica se implementa en dos puntos de `BotService.processMessage()`:
  1. Al no encontrar sesión (`!session`)
  2. Al encontrar sesión sin flujo activo (`!session.currentFlow`)
- `BotService` recibe `ProfessionalsRepository` por inyección de dependencias en su constructor. La consulta de pedido activo se realiza vía `prisma.request.findFirst()`.

**Flujos implementados:**

| Flow                    | Estados                                                                 |
|------------------------|-------------------------------------------------------------------------|
| `USER_REQUEST`         | INIT → ASK_NAME → ASK_SERVICE → ASK_PROVINCE → ASK_ZONE → ASK_DESCRIPTION → CLARIFICATION → ASK_LOCATION → ASK_PHOTOS → ASK_AUDIO → CONFIRM → SEARCHING |
| `PROFESSIONAL_REGISTER`| ASK_NAME → ASK_SERVICE → ASK_PROVINCE → ASK_ZONES → ASK_LOCATION → ASK_AVAILABILITY → SEND_LINK     |
| `COORDINATION`         | AWAITING_ACCEPTANCE (solo pedido ASSIGNED) → AWAITING_AVAILABILITY → AWAITING_CONFIRMATION → AWAITING_LOCATION → SCHEDULED. Si el profesional propone horario alternativo: AWAITING_USER_CONFIRMATION (máximo 3 rondas de negociación, tras las cuales se intenta con otro profesional del matching). Recordatorio pre-visita: AWAITING_VISIT_CONFIRMATION (profesional responde Confirmo/Cancelar). |
| `FEEDBACK`             | AWAITING_WORK_COMPLETION → FEEDBACK_SATISFACTION → FEEDBACK_RATING → FEEDBACK_RECOMMEND → FEEDBACK_COMMENT → FEEDBACK_PRO_RATING → FEEDBACK_PRO_RECOMMEND |

**Parseo de fecha con lenguaje natural (AUT-237):** `parseDateTimeNatural()` (`utils/date-utils.ts`) acepta tanto el formato exacto `DD/MM HH:MM` (mediante `parseExactDate`) como expresiones en lenguaje natural ("mañana a las 4", "el viernes a las 10") usando `callLLM()` como fallback. Si el LLM también falla, retorna `null` y NORA pide aclaración con ejemplos. El formato exacto se evalúa primero para evitar llamadas innecesarias al LLM.

**Flujo de coordinación actualizado (AUT-166, AUT-306):**
- **`handleAwaitingAcceptance` (AUT-197, AUT-281)**: Profesional responde asignación. Flag `_detailsShown` distingue 1er/2do intercambio. 1er intercambio: '1'/'ver detalles' muestra descripción + fotos/audio (enviados vía `CoordinationService.sendRequestMedia`) + opciones "1. Aceptar / 2. Rechazar". 2do intercambio (_detailsShown=true): '1' = ACCEPT, '2' = REJECT. `resolveOption('AWAITING_ACCEPTANCE', input)` mapea '1' → VER_DETALLES, ACCEPT solo por texto.
- **`handleAwaitingLocation` (AUT-306)**: Ahora recibe `UsersRepository` y `ConfigRepository`. Tres casos:
  1. **clientAddress pre-llenado** (usuario reutilizó savedLocation en `USER_REQUEST`): usa la dirección directamente sin preguntar.
  2. **Sin dirección escrita** (Caso B): busca `savedLocations` del usuario que coincidan con el `geoNodeId` del pedido. Si hay coincidencias, las ofrece como lista numerada + "Es otra dirección". Si elige una → `touchSavedLocation` (mueve al frente) + `finalizeLocation`. Si elige "otra" → pide dirección obligatoria. Si no hay coincidencias → pide dirección obligatoria.
  3. **Dirección de texto escrita** (Caso A): `finalizeLocation` persiste la dirección, notifica al profesional, y llama a `upsertSavedLocationByAddress` que compara vía LLM (`compareAddresses`) con entradas existentes del mismo `geoNodeId`. Si matchea → merge + mueve al frente. Si no → crea nueva entrada, recortando a `USER_MAX_SAVED_LOCATIONS` (default 5) si es necesario.
- **`handleAwaitingAvailability`**: Mensaje al usuario en singular: "...indicá un día y horario..." y recordatorio de cancelación: `escribí "cancelar"`. Valida con `parseDateTimeNatural` (primero exacto, luego LLM). Si no entiende → "No entendí la fecha..." → se queda en `AWAITING_AVAILABILITY`. Si cumple → guarda `clientAvailability` y `scheduledAt` → `AWAITING_CONFIRMATION`.
- **`handleAwaitingConfirmation`**: Mensaje al profesional: "Tu cliente puede el {DD/MM HH:MM}. ¿Confirmás? Respondé Sí, o escribí otro horario: DD/MM HH:MM (ejemplo: 10/05 17:00)". Si responde afirmativo → `AWAITING_LOCATION`. Si escribe otro horario → valida con `parseDateTimeNatural`. Si no entiende → "No entendí la fecha..." → se queda en `AWAITING_CONFIRMATION`. Si cumple y es distinto → `AWAITING_USER_CONFIRMATION`.
- **`CoordinationService.confirmVisit`**: Reemplazó `parseScheduledAt` (LLM) por `parseExactDate`. Misma lógica de detección de horario alternativo vía `isSameSchedule` (margen 15 min).
- **`RequestsService.confirmSchedule`**: Reemplazó `parseScheduledAt` (LLM) por `parseExactDate`. Sin fallback a `clientAvailability`.
- **Timezone**: `parseExactDate` construye la fecha en zona horaria argentina (`-03:00`). `getDayArgentina`, `getHoursArgentina`, `getMinutesArgentina`, `formatDateTimeArgentina` (`utils/date-utils.ts`) aplican offset UTC-3 al formatear fechas para mostrar.
- **Flujo de coordinación actualizado (AUT-167):**
  - Segunda ronda (usuario dice "No" al alternativo) incluye formato en el mensaje: "Escribí así: DD/MM HH:MM (ejemplo: 20/06 16:00)".
  - Mensaje de horario alternativo al usuario muestra `DD/MM a las HH:MM` (ej: "el 07/06 a las 09:00") en vez del día de semana.
  - Todas las operaciones de formateo de fecha (`getDay`, `getHours`, `getMinutes`, `getDate`/`getMonth`) usan las funciones con offset Argentina para corregir el día de semana y la hora.
  - `isSameSchedule` en `coordination.flow.ts` y `coordination.service.ts` usa las versiones Argentina para comparar correctamente.

**Lógica de paso ASK_PHOTOS (AUT-280):** Acepta hasta 3 fotos. Al recibir la tercera, avanza automáticamente a `ASK_AUDIO`. La palabra clave para continuar sin fotos o sin audio es "continuar" (antes "listo"). Cualquier texto distinto de "continuar" también avanza.

**Lógica de paso ASK_AUDIO (AUT-280):** Cuando el usuario envía un mensaje de tipo `audio`, el bot lo guarda en `tempData.audioUrl` y avanza directamente a `CONFIRM`. Si el usuario escribe "continuar" o cualquier otro texto sin audio, también avanza a `CONFIRM`. Solo repite la pregunta si el mensaje está vacío y no contiene audio.

**Lógica de paso ASK_LOCATION (AUT-306):** Se reubica después de `ASK_SERVICE` (antes estaba después de `CLARIFICATION`). Si el usuario comparte ubicación GPS, se resuelve el departamento vía Nominatim reverse geocoding y se mapea a GeoNode. Si el match es exitoso, continúa directo a `ASK_DESCRIPTION`. Si Nominatim falla o el usuario escribe texto, cae al flujo de zona manual (`proceedToProvinceStep` → `ASK_PROVINCE` → `ASK_ZONE`). Las coordenadas GPS se guardan en `tempData` para el matching geográfico.

**Lógica de flujo PROFESSIONAL_REGISTER (ACTUALIZADO AUT-211):**
- `ASK_NAME`: ignora el contenido del primer mensaje, siempre pregunta el nombre. Usa flag `_nameAsked` en tempData para detectar si ya preguntó. Asegura que `tempData.phone` esté disponible.
- `ASK_SERVICE`: resuelve el oficio vía NLP (exacto + Levenshtein). Al encontrar match, detecta país por prefijo telefónico, carga provincias activas y las muestra en el mismo mensaje junto con la confirmación de categoría.
- `ASK_PROVINCE`: procesa selección única por número. Al confirmar, carga zonas activas de la provincia y las muestra en el mismo mensaje (`_zonesListed = true`), eliminando un paso extra.
- `ASK_ZONES`: las zonas ya están precargadas desde `ASK_PROVINCE` (`_zonesListed = true`). Procesa selección múltiple por números separados por coma. Acepta números válidos aunque haya inválidos. Los `zoneIds` guardados corresponden a zonas reales de la DB.

**Lógica de flujo USER_REQUEST (ACTUALIZADO AUT-233, AUT-306):**
- `ASK_SERVICE`: modo configurable via `USER_SERVICE_SELECTION_MODE`. En modo `LIST` (default): obtiene categorías activas de la DB y las muestra como lista numerada para selección por número. En modo `FREE_TEXT`: mantiene resolución vía NLP (`nlpService.resolveCategory`).
- `ASK_SAVED_LOCATION` (AUT-306): después de elegir servicio, si el usuario tiene `savedLocations`, se le ofrece reutilizar una (1 entrada: "¿Es para X? 1. Sí / 2. No"; 2+: lista numerada + "Otra ubicación"). Si reutiliza, pre-llena `geoNodeId`, `lat`, `lng` y `clientAddress` y salta a `ASK_DESCRIPTION`. Si no tiene o elige "Otra", va a `ASK_LOCATION`.
- `ASK_LOCATION` (AUT-306): pide compartir ubicación GPS por WhatsApp. Si comparte, resuelve departamento vía Nominatim reverse geocoding (`nominatim-client.ts`) y lo matchea contra GeoNodes con `findChildNodeByName`; si match exitoso, salta directo a `ASK_DESCRIPTION`. Si Nominatim falla o no matchea, cae al flujo de zona manual (`proceedToProvinceStep`). Si escribe "no" o cualquier texto, cae al flujo de zona manual. Los métodos `handleAskProvince`, `handleAskZoneList`, `handleAskZoneFreeText` y `proceedToProvinceStep` no se modifican.
- `ASK_PROVINCE`: procesa selección única de provincia por número. Al confirmar, carga zonas activas de la provincia y las muestra en el mismo mensaje (`_zonesListed = true`). Solo se usa en modo `LIST` (fallback).
- `ASK_ZONE`: modo configurable via `USER_ZONE_SELECTION_MODE`. En modo `LIST` (default): las zonas ya están precargadas desde `ASK_PROVINCE`, procesa selección por número. En modo `FREE_TEXT`: resuelve zona vía NLP (`nlpService.resolveZone`), reintenta si no hay match. Guarda `geoNodeId` y `geoNodeName` en `tempData`. Continúa a `ASK_DESCRIPTION`.
- `UserRequestFlow` recibe `LocationsRepository` y `ConfigRepository` por inyección de dependencias.
- `CLARIFICATION` (AUT-280, AUT-288): después de que el usuario describe el problema, la IA valida con 3 niveles (`validateDescription` → `VALID`/`INVALID`/`UNCERTAIN`). `INVALID`: va a `DESCRIPTION_MISMATCH` con opciones "Cambiar el servicio" (vuelve a `ASK_SERVICE` limpiando categoría y zona) o "Reformular la descripción" (vuelve a `ASK_DESCRIPTION`). `UNCERTAIN`: confirma si el problema es del servicio seleccionado. `VALID`: continúa. Luego determina si falta información clave y genera UNA pregunta de clarificación en español rioplatense (`generateClarificationQuestions`, solo texto, sin análisis de imágenes). Si la info es suficiente, procede directamente. La respuesta a la pregunta también se valida (`validateClarificationAnswer`): si es incoherente, repite la pregunta. Genera el `technicalBrief` vía LLM (solo texto) y lo guarda en `tempData.technicalBrief`. Luego continúa con `ASK_PHOTOS` (AUT-306: la ubicación ya se resolvió antes de la descripción). El `technicalBrief` se persiste en `Request.technicalBrief` al crear el pedido. Si el LLM falla en cualquier validación, el flujo continúa sin interrupciones (non-blocking). Las fotos se envían directo al profesional, no se analizan con IA. `proceedAfterService` saltea selección de zona si `geoNodeId` ya existe (al cambiar servicio).
- `ASK_AVAILABILITY`: recolecta disponibilidad, luego llama a `ProfessionalsService.register()` que genera UUID v4 real como `verificationToken` (expira 7 días / 168h), crea el registro en DB con `latitude`/`longitude`, asocia las zonas vía `ProfessionalsRepository.addZone()`, actualiza `availability`, y retorna la URL de verificación con el token real.

**NLP (nlp.service.ts) (ACTUALIZADO AUT-233):**
- `resolveCategory(text)`: búsqueda exacta por nombre/slug, luego Levenshtein con max distance 3 como fallback
- `resolveZone(text)`: ídem para GeoNode (usado en USER_REQUEST cuando `USER_ZONE_SELECTION_MODE = FREE_TEXT`)
- Retorna `{ match, confidence: 'exact' | 'fuzzy' | 'none' }`

**Flujo de cancelación de pedido por el usuario (AUT-169):**
- **Trigger**: El usuario escribe palabras clave de cancelación ("cancelar", "cancel", "quiero cancelar", "cancelar pedido", "no quiero más", "no quiero mas") en cualquier punto del flujo activo.
- **Detección**: `BotService.processMessage()` intercepta antes del flow handler usando `isCancellationIntent()`. Si el usuario tiene un request activo (`findActiveByUserId`), guarda el flow/step anterior en `_previousFlow`/`_previousStep` y redirige a `CANCEL_CONFIRMATION`.
- **Confirmación**: NORA responde "¿Confirmás que querés cancelar tu pedido? Respondé Sí para confirmar o No para continuar." con opciones `['Sí', 'No']`. Si el usuario no confirma ni rechaza, repite la pregunta.
- **Si confirma (Sí)**: Llama a `RequestsService.cancelByUser()` → registra evento `CANCELLED` con metadata `{ cancelledBy: 'USER', hadConfirmedVisit, hoursBeforeVisit }`. Si corresponde, notifica al profesional vía `pendingNotification`.
- **Si rechaza (No)**: NORA responde "Entendido, tu pedido sigue activo." y restaura el flow/step anterior desde `_previousFlow`/`_previousStep`.
- **Escenario A (sin visita confirmada)**: Estados CREATED, ASSIGNED, ACCEPTED con cualquier `coordinationStatus` excepto SCHEDULED. Cancelación libre sin restricción de tiempo. El profesional se notifica solo si ya había aceptado (ACCEPTED): "El usuario canceló el pedido. Quedás disponible para nuevas asignaciones."
- **Escenario B (visita confirmada)**: Estado ACCEPTED con `coordinationStatus = SCHEDULED`. Si faltan más de 2 horas para `scheduledAt`: cancela y notifica al profesional con "El usuario canceló la visita programada para el [DD/MM HH:MM]. Quedás disponible para nuevas asignaciones." Si faltan menos de 2 horas: bloquea la cancelación con "Ya no es posible cancelar con menos de 2 horas de anticipación. Si tenés un problema, podés contactarnos."
- **Manejo en flows**: `UserRequestFlow` y `CoordinationFlow` incluyen case `CANCEL_CONFIRMATION` que delega en `handleCancelConfirmation()` (`cancel-flow.helper.ts`). `RequestsService` se inyecta en ambos flows para ejecutar `cancelByUser()`.
- **Sin request activo**: Si el usuario escribe "cancelar" pero no tiene pedidos activos, el mensaje no se intercepta y el flow handler lo procesa normalmente.

**Persistencia de tempData con flag `_clearTempData` (AUT-299):**
- **Problema**: El `tempData` de la sesión se vaciaba cada vez que un flow retornaba `nextStep: null`, incluso cuando el flujo continuaba (ej: usuario manda dirección y espera que el profesional confirme). Esto eliminaba `userId`, `requestId`, `professionalId` del `tempData`, rompiendo lógica posterior como la detección de cancelación con LLM.
- **Solución**: Se agregó flag explícito `_clearTempData: true` en el `tempData` de los retornos de flow. `BotService.processMessage()` solo vacía `tempData` si `nextStep === null && _clearTempData === true`. Los flujos marcan este flag solo cuando realmente terminan (cancelación confirmada, pedido rechazado, feedback completado, error sin recuperación).
- **NO llevan `_clearTempData`**: retornos con `pendingNotification` (el flujo continúa en la sesión del otro participante) y retornos donde el flujo del usuario sigue activo (ej: `AWAITING_LOCATION` → espera confirmación del profesional).
- **Archivos modificados**: `bot.service.ts`, `coordination.flow.ts`, `cancel-flow.helper.ts`, `feedback.flow.ts`, `user-request.flow.ts`.

**Sistema anti-abuso: detección y degradación gradual (AUT-243):**

Detección de patrones de abuso en usuarios y profesionales con degradación gradual en 3 niveles: `clean`, `warn`, `suspend`. Nunca se usa silencio total para proteger la reputación del número ante Meta.

**Servicio `AbuseDetectionService` (`abuse-detection.service.ts`):**

| Método                      | Descripción                                                                 |
|----------------------------|-----------------------------------------------------------------------------|
| `checkUserAbuse(userId)`   | Cuenta `CANCELLED` en requests del usuario (últimos 7 días). Retorna `suspend` si ≥5 cancelaciones o `abuseWarningCount ≥ 2`, `warn` si ≥3, `clean` en caso contrario. |
| `checkProfessionalAbuse(professionalId)` | Cuenta `CANCELLED` y `NO_RESPONSE` del profesional (últimos 7 días). Misma lógica: `suspend` si ≥5 eventos o `abuseWarningCount ≥ 2`, `warn` si ≥3. |

**Puntos de consumo:**

- **`bot.service.ts` — chequeo de estado al inicio de cada mensaje**: Después de resolver el rol, si el usuario está `BLOCKED` o el profesional está `SUSPENDED`, retorna mensaje de suspensión y no procesa el mensaje.
- **`cancel-flow.helper.ts` — cuando el usuario confirma cancelación**: Después de `cancelByUser()`, ejecuta `checkUserAbuse(userId)`. En `warn`: incrementa `abuseWarningCount` y appendea advertencia al response. En `suspend`: cambia `status → BLOCKED`.
- **`coordination.flow.ts` — cuando el profesional rechaza asignación o cancela visita**: Ejecuta `checkProfessionalAbuse(professionalId)`. En `warn`: incrementa `abuseWarningCount` y appendea advertencia. En `suspend`: cambia `status → SUSPENDED`.

**Mensajes definidos:**

| Escenario                           | Mensaje                                                                                                                     |
|-------------------------------------|-----------------------------------------------------------------------------------------------------------------------------|
| Cuenta suspendida intenta usar NORA | "Tu cuenta está suspendida temporalmente por uso irregular. Si creés que es un error, escribinos a soporte@noraconecta.com" |
| Advertencia usuario (warn)          | "⚠️ Notamos que cancelaste varios pedidos recientemente. Por favor usá NORA solo cuando realmente necesités el servicio. Si esto continúa, tu cuenta podría ser suspendida." |
| Advertencia profesional (warn)      | "⚠️ Notamos varias cancelaciones de tu parte. Esto afecta la experiencia de los usuarios. Si esto continúa, tu cuenta podría ser suspendida." |

**No se modifica `schema.prisma`.** Los campos `abuseWarningCount` y `lastAbuseCheckAt` ya existen en `User` y `Professional` desde AUT-241.

### AUT-245 — Correcciones flujo de confirmación: opciones duplicadas, negrita en resumen y datos de visita al profesional

Correcciones de bugs en el flujo de confirmación de pedido y visita.

**Bug 1 — Opciones duplicadas en resumen del pedido (`user-request.flow.ts`):**
- `handleAskAudio` tenía `options: ['Si', 'No']` en dos respuestas que llamaban a `buildConfirmation`, que ya incluye `\n1. Sí\n2. No` en el texto.
- Se eliminó `options` de ambas respuestas (líneas ~639 y ~650) para que las opciones aparezcan una sola vez.

**Bug 2 — Resumen del pedido sin negrita (`user-request.flow.ts`):**
- `buildConfirmation` ahora usa asteriscos para negrita en WhatsApp: `*Resumen del pedido:*`, `*Nombre:*`, `*Servicio:*`, `*Zona:*`, `*Problema:*`, `*Fotos:*`, `*Audio:*`.

**Bug 3 — Datos del cliente no llegan al profesional al confirmar visita (`coordination.service.ts`):**
- `notifyProfessionalVisitConfirmed` ignoraba `sendWithWindowCheck` cuando `hasCoordinates = true`, llamando directo a `sendTemplateWithButton`.
- Ahora ambos casos (con y sin coordenadas) pasan por la verificación de ventana de 24hs:
  - Dentro de la ventana → texto plano con nombre, teléfono, dirección y fecha/hora (con negrita).
  - Fuera de la ventana → template con botón de maps si hay coordenadas, template sin botón si no hay.

**Archivos modificados:**
- `backend/src/modules/bot/flows/user-request.flow.ts`
- `backend/src/modules/bot/coordination.service.ts`

**No modifica** `schema.prisma`.

### AUT-252 — Saltear selección de provincia cuando hay una sola activa

Mejora de UX en los flujos `USER_REQUEST` y `PROFESSIONAL_REGISTER`: si el país del usuario tiene una única provincia activa, el sistema la auto-selecciona y salta directo a la lista de departamentos sin mostrar el paso de selección de provincia.

**Cambios en `user-request.flow.ts`:**
- `proceedToProvinceStep`: después de obtener `provinces`, si `provinces.length === 1`, auto-selecciona la provincia, carga las zonas activas y redirige a `ASK_ZONE` con mensaje contextualizado: "¿En qué departamento de {provincia} necesitás el servicio?"

**Cambios en `professional-register.flow.ts`:**
- `handleAskService`: después de seleccionar la categoría y obtener provincias, si `provinces.length === 1`, auto-selecciona la provincia, carga las zonas activas y redirige a `ASK_ZONES` con mensaje contextualizado: "¿En qué departamento de {provincia} trabajás?"

**Comportamiento:**
- 1 provincia activa → salta a zonas con contexto de la provincia
- 2+ provincias activas → flujo normal (lista de provincias)
- Si no hay zonas activas → mensaje de error y flujo terminado

**No modifica** `schema.prisma`.

### AUT-253 — Gestión humanizada de token de verificación vigente y expirado en estado PENDING

Cuando un profesional en estado `PENDING` escribe al bot, `resolveProfessionalState` ahora distingue dos sub-casos:

- **Token vigente** (no expirado, no usado): responde con un mensaje humanizado que incluye el nombre del profesional y el link de verificación existente.
- **Token expirado o usado**: genera un nuevo `verificationToken` (UUID), lo persiste en la DB con `verificationTokenExp` a 168hs desde ahora y `verificationTokenUsed: false`, y responde con un mensaje humanizado que incluye el nuevo link.

**TTL del token de verificación:** cambiado de 72hs a 168hs (7 días) en `professionals.service.ts`.

**Archivos modificados:**
- `backend/src/modules/professionals/professionals.service.ts`: TTL cambiado de 72 a 168.
- `backend/src/modules/professionals/professionals.repository.ts`: `UpdateProfessionalInput` extendido con `verificationToken` y `verificationTokenExp`.
- `backend/src/modules/bot/bot.service.ts`: lógica humanizada en `resolveProfessionalState` para el case `PENDING`.

**No modifica** `schema.prisma`.

### AUT-286 — Saludo cordial al usuario recurrente antes de mostrar opciones de servicio

Cuando un usuario que ya tiene nombre registrado en la DB (recurrente) vuelve a escribirle a NORA, el bot lo saluda por nombre en el mismo mensaje que muestra las categorías de servicio.

**Cambios en `user-request.flow.ts` (`handleAskServiceList`):**
- Al mostrar la lista de categorías por primera vez, se verifica `tempData.name`. Si el usuario tiene nombre → `"¡Qué bueno volver a verte, {name}! ¿Qué servicio estás buscando?\n\n{lista}"`. Si es nuevo (sin nombre) → `"¿Que tipo de servicio necesitas?\n\n{lista}"`.
- El `name` ya está disponible en `tempData` porque `bot.service.ts` lo inyecta desde `userIdentity` al crear la sesión.
- Los mensajes de reintento (input vacío o inválido) mantienen el texto genérico sin saludo.

**Saludo:** `"¡Qué bueno volver a verte, {name}! ¿Qué servicio estás buscando?"` — breve, cordial, español rioplatense.

**No modifica** `schema.prisma`.

### AUT-250 — Detección de urgencia y fecha mencionada en descripción del problema

Extensión del análisis LLM post-descripción para detectar dos señales clave en el matching: urgencia del pedido y fecha/día mencionada por el usuario.

**Cambios en `schema.prisma`:**
- `Request`: agregados `isUrgent Boolean @default(false)` y `mentionedDate String?` después de `problemType`
- Migración: `add_request_urgency_fields`

**Cambios en `requests.service.ts` (ACTUALIZADO AUT-251 — Opción B):**
- El análisis LLM se ejecuta síncrono dentro de `create()`, antes de `findBestCandidate`, extrayendo `problemType`, `isUrgent` y `mentionedDate`
- Si el LLM falla, se usan defaults (`isUrgent: false`, `mentionedDate: null`) sin bloquear la creación del pedido
- `findBestCandidate` recibe los valores analizados para el matching inicial (antes solo disponibles en reasignaciones)
- Los valores se persisten en DB via fire-and-forget después del match: `requestsRepository.update(request.id, { problemType, isUrgent, mentionedDate })`
- El método `analyzeDescription()` fue removido de `user-request.flow.ts` (la lógica está ahora en `create()`)

**Criterios de detección (via prompt al LLM):**
- `isUrgent`: true si hay palabras como "urgente", "emergencia", "ahora", "ya", "se inunda", "sin agua", "sin luz"
- `mentionedDate`: extrae día/fecha mencionada (ej: "el sábado" → "sábado", "mañana" → "mañana", "el 15 de junio" → "15 de junio"). null si no se menciona fecha.
- `problemType`: clasificación breve en snake_case inglés (sin cambios respecto al comportamiento anterior)

**Interpretación natural del lenguaje con LLM como fallback en opciones (AUT-236):**

Cuando `resolveOption` no encuentra match exacto por alias, el sistema usa un LLM como fallback para interpretar respuestas en lenguaje natural (ej: "me parece bien dale" → YES, "la verdad que no estoy seguro" → null).

**Archivos modificados:**
- `option-resolver.helper.ts`: nueva función exportada `resolveOptionWithFallback(step, input)`. Usa `callLLM` de `llm-client.ts` (AUT-242) para interpretar respuestas ambiguas. Si el LLM falla o retorna valor inválido, retorna `null` sin lanzar error. `resolveOption` sigue existiendo sin cambios.
- `coordination.flow.ts`: reemplaza `resolveOption` por `resolveOptionWithFallback` en 4 pasos: `AWAITING_ACCEPTANCE`, `AWAITING_CONFIRMATION`, `AWAITING_USER_CONFIRMATION`, `AWAITING_VISIT_CONFIRMATION`.
- `feedback.flow.ts`: reemplaza `resolveOption` por `resolveOptionWithFallback` en 3 pasos: `FEEDBACK_SATISFACTION`, `FEEDBACK_RECOMMEND`, `FEEDBACK_PRO_RECOMMEND`.
- `user-request.flow.ts`: reemplaza `resolveOption` por `resolveOptionWithFallback` en el paso `WAITING_CONSENT`.

**Lógica de negocio:**
- Primero intenta match exacto con los aliases existentes (rápido, sin latencia)
- Si no hay match, envía prompt al LLM con las opciones disponibles y la respuesta del usuario
- El LLM debe responder SOLO con el valor exacto de la opción (ej: `ACCEPT`, `YES`, `CONFIRM`) o `"null"` si no está claro
- Si el LLM falla (API error, timeout, etc.), el sistema cae al mensaje de aclaración tradicional sin interrumpir el flujo

**No modifica** `schema.prisma`.

**Parseo de fecha/hora en lenguaje natural (AUT-237):**

`parseDateTimeNatural()` en `utils/date-utils.ts` permite que usuarios y profesionales escriban fechas en lenguaje natural durante la coordinación de visitas.

**Archivos modificados:**
- `utils/date-utils.ts`: nueva función exportada `parseDateTimeNatural(input, referenceDate)`. Intenta primero `parseExactDate()` (formato exacto `DD/MM HH:MM`), luego fallback a `callLLM()` para interpretar lenguaje natural. Si ambos fallan, retorna `null`.
- `coordination.flow.ts`: reemplaza `parseExactDate` por `parseDateTimeNatural` en `handleAwaitingAvailability` (usuario propone horario) y `handleAwaitingConfirmation` (profesional propone horario alternativo). Mensajes de error y prompts actualizados con ejemplos en lenguaje natural ("mañana a las 4", "el viernes a las 10").

**Ejemplos que entiende:**
- "mañana a las 4" → fecha de mañana, 16:00
- "el viernes a las 10" → próximo viernes, 10:00
- "pasado mañana a las 10:30" → fecha correcta, 10:30
- "20/06 16:00" → formato exacto (sin llamar al LLM)
- "la semana que viene" → null (ambiguo, pide aclaración)

**Lógica de negocio:**
- El formato exacto se evalúa primero para evitar latencia innecesaria del LLM
- Si el LLM falla, la experiencia se degrada al formato exacto (el usuario recibe instrucciones de formato)
- El mensaje de error ahora incluye ejemplos en lenguaje natural para educar al usuario

**No modifica** `schema.prisma`.

**Tracking de ventana de conversación de 24hs (WhatsApp) (AUT-171):**
- `BotSession.lastInboundAt` registra el timestamp del último mensaje entrante recibido de un número
- `BotRepository.updateLastInboundAt(phone, role, at)`: actualiza `lastInboundAt` en cada mensaje entrante
- `BotRepository.isWithin24hWindow(phone, role)`: retorna `true` si `lastInboundAt` existe y `Date.now() - lastInboundAt < 24 horas`
- `BotService.processMessage()` llama a `updateLastInboundAt(phone, role, new Date())` después de garantizar que la sesión existe, antes de cualquier otro procesamiento
- `shouldUseTemplate(phone, role, botRepository)` (`utils/whatsapp-utils.ts`): helper stateless que retorna `true` si se necesita template (fuera de ventana de 24hs) o `false` si se puede responder con mensaje libre. Requiere `role` como parámetro adicional (AUT-192)
- La ventana la abre el usuario/profesional cuando nos escribe; no se abre cuando NORA escribe a ellos
- El helper es reutilizable desde cualquier módulo — las issues futuras de envío de mensajes lo consumen para decidir entre template y mensaje libre

**Timeout reminder tracking (AUT-177):**
- `BotSession.reminderSentAt` registra el timestamp del último recordatorio de timeout enviado al profesional
- `BotRepository.setReminderSent(phone, role, at)`: marca que se envió recordatorio al profesional
- `BotRepository.clearReminderSent(phone, role)`: limpia el timestamp cuando el pedido se reasigna
- Se usa en `RequestsService.processTimeouts()` para evitar recordatorios duplicados y limpiar tras reasignación

**Tracking de último template enviado (AUT-271):**
- `BotSession.lastTemplateSentAt` registra el timestamp del último template de WhatsApp enviado por NORA a cada usuario/rol
- Se usará para validar la regla de Beplic/Marcelo: no enviar más de 1 template al mismo usuario en 24hs
- Diferente de `lastInboundAt`: este campo registra mensajes **salientes** (templates), mientras que `lastInboundAt` registra mensajes **entrantes**

**Validación de colisión de fechas en coordinación (AUT-172):**
- Antes de procesar una fecha propuesta (usuario o profesional), el sistema verifica que el profesional asignado no tenga otra visita confirmada (`coordinationStatus = SCHEDULED`) en el mismo día y hora exactos (timezone Argentina).
- `RequestsRepository.findConflictingSchedule(professionalId, scheduledAt, excludeRequestId)`: busca pedidos del profesional con `coordinationStatus = SCHEDULED`, mismo día/mes/hora/minuto en UTC-3, excluyendo el pedido actual.
- **Punto 1 — `handleAwaitingAvailability` (usuario propone fecha, WhatsApp)**: después de validar formato con `parseExactDate`, consulta colisión. Si hay colisión → "Ese horario no está disponible para el profesional. Proponé otro día y hora: DD/MM HH:MM (ejemplo: 20/06 16:00)", permanece en `AWAITING_AVAILABILITY`.
- **Punto 2 — `handleAwaitingConfirmation` (profesional propone alternativa, WhatsApp)**: después de validar formato con `parseExactDate`, consulta colisión. Si hay colisión → "Ya tenés una visita confirmada en ese día y hora. Proponé otro horario: DD/MM HH:MM (ejemplo: 20/06 17:00)", permanece en `AWAITING_CONFIRMATION`.
- **Punto 3 — `confirmSchedule` (profesional confirma o propone desde panel web)**: antes de guardar la fecha, consulta colisión. Si hay colisión → lanza `AppError` 409 "Ya tenés una visita confirmada en ese día y hora. Proponé otro horario." El controller captura 409 y retorna HTTP 409. El frontend muestra el error inline en el modal de confirmación de visita.
- **Definición de colisión**: mismo día, mes, hora y minuto exacto. Dos visitas a las 10:00 y 10:30 no colisionan.
- **Confirmación con "Sí" (WhatsApp)**: no se valida colisión porque el profesional está aceptando el horario del usuario, no proponiendo uno nuevo.
- **`handleAwaitingUserConfirmation` — usuario acepta alternativa (isYes)**: `coordinationStatus` pasa a `SCHEDULED` directamente (antes `AWAITING_LOCATION`). NORA pide dirección en el mismo mensaje (`nextStep: 'AWAITING_LOCATION'`).
- **Patrones afirmativos ampliados**: se agregaron `yes`, `sure`, `vale`, `claro` a `isAffirmative()` para evitar que respuestas en inglés o variantes comunes queden sin reconocer y se trabe el flujo.
- **`confirmSchedule` (service) — branch `proposedAt`**: ahora persiste `scheduledAt: parsedProposedAt` en el update, además de `clientAvailability`.
- **`confirmSchedule` (controller) — notificación al usuario**: cuando el profesional propone alternativa desde el panel, se actualiza la sesión WhatsApp del usuario vía `botRepository.upsert` con `currentStep: 'AWAITING_USER_CONFIRMATION'` y `tempData` con `alternativeScheduledAt`, `professionalName`, `professionalPhone`, `requestId` y `pendingMessage` ("Profesional propone el DD/MM HH:MM. ¿Te viene bien?").
- **Frontend — `confirmScheduleRequest`**: nueva función en `panel-api.ts` que llama a `POST /requests/:id/confirm-schedule`. El botón "Enviar propuesta" en `ProfessionalInProgress.tsx` la usa en lugar de `confirmVisitRequest`, parseando la fecha a ISO con `toArgentineISO()`.
- **Frontend — error inline**: estado `confirmVisitError` muestra errores (incluyendo 409 de colisión) como banner rojo dentro del modal. Se limpia al abrir/cerrar el modal y al cambiar de vista.
- **Logs de debug en `bot.service.ts`**: `processMessage` loguea `phone`, `currentFlow`, `currentStep` al inicio. El bloque `pendingNotification` loguea `targetPhone`, `step` y `tempData` antes del upsert.

**Simulador web (frontend):**
- Interfaz React + Tailwind en `frontend/src/pages/SimulatorPage.tsx`
- Input de texto libre para ingresar cualquier numero de telefono + toggle de rol (Usuario / Profesional)
- Burbujas de chat diferenciadas: usuario (emerald, derecha), NORA (slate, izquierda)
- Indicador de estado de sesión (flujo + paso actual)
- Estados: vacío, carga (typing indicator con dots animados), conversación activa
- Diseño responsive: single-column centrado, 720px max-width en desktop, full-width en mobile
- Botón de imagen: file picker con filtro `image/jpeg,png,webp` (máx 3), upload directo a R2 vía presign, preview con miniaturas antes del envío
- Botón de audio: grabación con Web Audio API (MediaRecorder), upload a R2 vía presign, indicador visual de grabación activa (pulsing dot), preview "Audio listo" antes del envío
- Mensajes con media: render de thumbnails (grid 1 o 2 columnas) y reproductor de audio inline con play/pause
- Polling de estado del pedido: cuando se crea un pedido y el bot retorna `requestId`, el simulador inicia polling cada 5s a `GET /requests/:id` y muestra mensajes automáticos de cambio de estado en el chat. Antes del primer poll, se inicializan los refs de estado con los valores actuales del pedido para evitar mensajes duplicados (AUT-158). Después de cada `send`/`sendLocation`, si el polling está activo, se sincronizan los refs con el estado actual del pedido para evitar mensajes duplicados cuando el bot cambia el estado procesando un mensaje (AUT-164). Detecta tanto cambios de `status` como de `coordinationStatus`:
  - `PENDING_CONFIRMATION` → opciones "conforme" / "con observaciones" / "no conforme"
  - `coordinationStatus = AWAITING_USER_CONFIRMATION` → "{nombre} no puede en ese horario. Propone el {horario alternativo}. ¿Te viene bien? (Sí / No)". El `scheduleConfirmationRef` trackea este estado para interceptar la respuesta Sí/No del usuario y enviarla al bot para que procese la confirmación o rechazo de la alternativa vía el coordination flow (AUT-164, AUT-165)
  - `coordinationStatus = AWAITING_LOCATION` → "{nombre} ya confirmó el horario. Respondé con tu dirección..."
  - `coordinationStatus = SCHEDULED` → "¡Todo listo! La visita quedó coordinada..."
   - `ASSIGNED` (primera asignación) → "Encontramos un profesional..."
   - `ASSIGNED` (reasignación, `reassignmentCount > 0`): si `lastReassignmentReason` es `PROFESSIONAL_CANCELLED` → "Lamentablemente el profesional canceló. Estamos buscando uno nuevo."; si es `TIMEOUT` → "El profesional no respondió a tiempo. Estamos buscando uno nuevo."; sin `lastReassignmentReason` → "Estamos buscando un nuevo profesional para tu pedido. Te avisamos cuando confirme." (AUT-174)
  - `ACCEPTED` + `coordinationStatus = AWAITING_AVAILABILITY` → "¡Buenas noticias! {nombre} aceptó tu pedido..."
  - `NO_RESPONSE` → "No encontramos profesionales disponibles..."
  - `CANCELLED` → "El pedido fue cancelado."
  - Cuando el status cambia a `COMPLETED`, el polling saltea cualquier mensaje de coordinación e inicia directamente el flujo de calificación (AUT-164)
  - El teléfono del profesional NUNCA se muestra al usuario en el simulador
  - **Ubicación simulada (AUT-152)**: Cuando NORA pide compartir ubicación desde WhatsApp, aparece un botón "📍 Compartir ubicación (simulada)" en la barra de herramientas del chat. Envía coordenadas hardcodeadas de Mendoza (`-32.8908, -68.8272`) como `location` en el body de `POST /bot/message`. Exclusivo para testing en desarrollo.
  - Se detiene al llegar a estado final (CANCELLED, COMPLETED, NOT_FULFILLED, NO_RESPONSE)

### Config (ACTUALIZADO AUT-233, AUT-239)

| Key                            | Default | Descripción                              |
|-------------------------------|---------|------------------------------------------|
| `BADGE_MIN_COMPLETED_REQUESTS` | 10     | Mínimo de pedidos completados para badge |
| `TRIAL_REQUESTS_LIMIT`         | 3      | Máximo de pedidos de prueba por profesional |
| `PROFESSIONAL_RESPONSE_TIMEOUT_HOURS` | 2 | Timeout de respuesta del profesional |
| `USER_SERVICE_SELECTION_MODE`   | LIST   | Modo de selección de categoría: LIST (numerada) o FREE_TEXT (NLP) |
| `USER_ZONE_SELECTION_MODE`     | LIST   | Modo de selección de zona: LIST (provincia → zona numerada) o FREE_TEXT (NLP) |
| `USER_MAX_SAVED_LOCATIONS`     | 5      | Máximo de direcciones guardadas por usuario (AUT-306) |
| `WORK_COMPLETION_CHECK_HOURS` | 24 | Horas para volver a consultar al profesional si ya venció la visita programada |
| `AUTO_COMPLETE_HOURS`          | 24     | Horas sin confirmación para auto-completar |
| `REPUTATION_PENALTY_DECAY_DAYS` | 90    | Días de decaimiento de penalizaciones |
| `MATCHING_WEIGHT_COMPLIANCE`   | 0.22   | Peso de compliance en el score |
| `MATCHING_WEIGHT_RESPONSE_RATE` | 0.20  | Peso de response rate en el score |
| `MATCHING_WEIGHT_RECOMMENDATION` | 0.10 | Peso de wouldRecommend en el score |
| `MATCHING_WEIGHT_DISTRIBUTION` | 0.05   | Peso de distribución en el score |
| `MATCHING_WEIGHT_QUALITY_RATING` | 0.15 | Peso de quality rating (4 ejes) en el score |
| `MATCHING_WEIGHT_PROXIMITY`    | 0.10   | Peso de cercanía geográfica (Haversine) |
| `MATCHING_WEIGHT_PLAN`         | 0.05   | Peso de plan priority en el score |
| `MATCHING_WEIGHT_ACCEPTANCE`   | 0.05   | Peso de tasa de aceptación (ASSIGNED→ACCEPTED) (AUT-239) |
| `MATCHING_WEIGHT_COMPLETION`   | 0.05   | Peso de tasa de completitud (ACCEPTED→COMPLETED) (AUT-239) |
| `MATCHING_WEIGHT_RESPONSE_TIME`| 0.03   | Peso de tiempo promedio de respuesta (minutos) (AUT-239) |
| `MATCHING_MAX_DISTANCE_KM`     | 50     | Distancia máxima para escalar score de proximidad |
| `MATCHING_BADGE_BONUS`         | 5      | Bonus fijo por hasBadge (no ponderado) |
| `MATCHING_REJECTION_PENALTY`   | 10     | Penalización por cada REJECTED event en distribución |
| `MATCHING_TENDENCY_WEIGHT`     | 0.15   | Peso de tendencia reciente dentro de qualityRating |
| `MATCHING_COMPLIANCE_PENALTY`  | 50     | Penalización por NOT_FULFILLED |
| `MATCHING_RESPONSE_PENALTY`    | 25     | Penalización por NO_RESPONSE |
| `MATCHING_REPUTATION_DECAY_DAYS` | 90  | Días de decaimiento de penalizaciones |
| `MATCHING_MAX_ACTIVE_REQUESTS` | 2      | Máximo de pedidos activos simultáneos |
| `MATCHING_DISTRIBUTION_DAILY_BONUS` | 10 | Bonus diario por tiempo desde última asignación |

| Endpoint         | Método | Descripción                      | Rol mínimo |
|-----------------|--------|----------------------------------|-----------|
| `/config`       | GET    | Ver toda la configuración        | SUPERADMIN|
| `/config/:key`  | PATCH  | Actualizar un parámetro          | SUPERADMIN|

### Webhooks (AUT-134)

Endpoints de webhook para proveedores de WhatsApp (Meta directo o BSP como Kapso). Reciben mensajes entrantes y coordinan el flujo con el BotService existente.

| Endpoint               | Método | Descripción                                          | Auth      |
|-----------------------|--------|------------------------------------------------------|-----------|
| `/webhooks/whatsapp`   | GET    | Verificación de webhook (handshake inicial con Meta) | HMAC      |
| `/webhooks/whatsapp`   | POST   | Recepción de mensajes entrantes de WhatsApp          | HMAC      |

**Arquitectura:**
```
Proveedor WhatsApp (Kapso o Meta) → POST /webhooks/whatsapp
  → Validación HMAC-SHA256 flexible:
    → Kapso: X-Webhook-Signature + WHATSAPP_WEBHOOK_SECRET (hex plano)
    → Meta directo: X-Hub-Signature-256 + WHATSAPP_APP_SECRET (sha256=<hex>)
  → Responder 200 inmediatamente al proveedor
  → Procesamiento asincrónico:
    → WhatsAppAdapter.parseWebhook(payload)
      → Determinar rol (USER/PROFESSIONAL) según phone_number_id
      → Para imágenes/audio: descargar de Meta → subir a R2
      → Retornar IncomingMessage normalizado
    → BotService.processMessage(phone, message)
    → WhatsAppAdapter.sendText() / sendImage() (usa shouldUseTemplate() antes de enviar)
    → Si processMessage retorna pendingNotification:
      → Enviar WhatsApp inmediato al destinatario via sendText()
      → Limpiar pendingMessage de la sesión del destinatario (para no reentregar)
```

**WhatsAppAdapter (`src/lib/whatsapp-adapter.ts`):**

| Método                 | Descripción                                                                |
|-----------------------|----------------------------------------------------------------------------|
| `isConfigured()`      | Verifica que las variables de entorno de WhatsApp estén configuradas        |
| `parseWebhook()`      | Parsea el payload del webhook → `{ message: IncomingMessage, role }`       |
| `sendText()`          | Envía texto libre (o template si fuera de ventana de 24hs)                 |
| `sendImage()`         | Envía imagen por URL pública                                              |
| `sendTemplate()`      | Envía mensaje de template con parámetros                                  |
| `sendTemplateWithButton()` | Envía template con botón URL (AUT-226)                                  |
| `sendTemplateWithQuickReplies()` | Envía template con quick reply buttons (payload) (AUT-229)          |
| `downloadAndUploadToR2()` | Descarga archivo de Meta → sube a R2 → retorna URL pública           |

**Autenticación saliente adaptable por BSP (AUT-220):**
- Si `WHATSAPP_BASE_URL` contiene `kapso.ai`, `sendText`/`sendTemplate`/`sendImage`/`sendAudio` envían `X-API-Key: <token>`
- Para cualquier otro provider (incluyendo Meta Graph), esos métodos usan `Authorization: Bearer <token>`
- `downloadAndUploadToR2()` siempre consulta/descarga media desde `https://graph.facebook.com` con `Authorization: Bearer <token>` (independiente del `WHATSAPP_BASE_URL`)

**Determinación del rol:**
```typescript
const role = phone_number_id === WHATSAPP_PHONE_NUMBER_ID_PROFESSIONAL
  ? 'PROFESSIONAL'
  : 'USER';
```

**Coexistencia con el simulador:** El endpoint `/webhooks/whatsapp` y el simulador (`/bot/message`) son completamente independientes. Ambos llaman al mismo `BotService` pero tienen entrada y salida propias. El simulador siempre está activo.

**Sin variables configuradas:** Si `WHATSAPP_API_TOKEN_USER`, `WHATSAPP_API_TOKEN_PROFESSIONAL`, `WHATSAPP_PHONE_NUMBER_ID_USER` o `WHATSAPP_PHONE_NUMBER_ID_PROFESSIONAL` no están configuradas, el servidor arranca con un warning y el endpoint `/webhooks/whatsapp` responde 503. El simulador opera con normalidad.

### Matching (ACTUALIZADO AUT-186, AUT-239, AUT-251, AUT-366)

Servicio interno sin endpoints REST. Invocado por el módulo de Pedidos.

| Método                  | Descripción                                         |
|-------------------------|-----------------------------------------------------|
| `findBestCandidate()`   | Encuentra el mejor profesional para categoría + zona. Acepta `isUrgent`, `mentionedDate` y `problemType` opcionales para bonus de disponibilidad contextual y especialización (AUT-251, AUT-240). Acepta `userId` opcional para aplicar reglas de preferencia/exclusión por historial (AUT-366) |
| `calculateScore()`      | Calcula el score individual de un profesional       |

**Repository (matching.repository.ts) — queries de scoring:**

| Método                          | Descripción                                                    |
|---------------------------------|----------------------------------------------------------------|
| `getAverageRatings()`           | Promedio de los 4 ejes de rating (puntualidad, calidad, comunicación, precio justo) por profesional |
| `getRecentAverageRatings()`     | Igual que `getAverageRatings` pero filtrado a últimos 30 días para calcular tendencia |
| `countRejectedEvents()`         | Cantidad de eventos REJECTED por profesional (para penalización en distribución) |
| `getBadgeStatus()`              | Si el profesional tiene badge de excelencia activo            |
| `getAcceptanceRates()`          | Tasa de aceptación: eventos ACCEPTED / ASSIGNED por profesional. Default 0.5 sin historial (AUT-239) |
| `getCompletionRates()`          | Tasa de completitud: eventos COMPLETED / ACCEPTED por profesional. Default 0.5 sin historial (AUT-239) |
| `getAvgResponseTimes()`         | Tiempo promedio en minutos entre ASSIGNED y ACCEPTED. Default 60 min sin historial (AUT-239) |
| `findRequestsForReminder()`     | Busca pedidos ASSIGNED con `updatedAt` entre 60 y 90 min atrás (incluye `assignedProfessional.phone`) |
| `findRequestsForReassignment()` | Busca pedidos ASSIGNED con `updatedAt` > 90 min atrás          |
| `getProfessionalAvailability()` | Lee `availabilityStructured` de profesionales y retorna Map con slots por día/hora (AUT-251) |
| `findPreferredProfessional()`    | Busca profesional con feedback positivo previo del usuario en la misma categoría: `wouldRecommend:true` + rating promedio ≥ 4. Retorna el más reciente (AUT-366) |
| `findExcludedProfessionals()`    | Busca profesionales con `wouldRecommend:false` del usuario en la misma categoría para exclusión automática (AUT-366) |

**Filtros duros**: status ACTIVE | OBSERVATION, zona coincidente, categoría coincidente, `canReceiveRequests = true`, máximo de pedidos activos configurable, no rechazó el pedido actual.

**Fórmula de scoring (AUT-186, AUT-201, AUT-239, AUT-251):**
```
score_final = compliance        × 0.22
            + responseRate      × 0.20
            + qualityRating     × 0.15   (promedio 4 ejes, reemplaza wouldRecommend como componente principal)
            + proximity         × 0.10   (distancia real usuario-profesional con Haversine)
            + recommendation    × 0.10   (wouldRecommend se mantiene con menos peso)
            + distribution      × 0.05   (reducido, penaliza rechazos)
            + planScore         × 0.05   (prioridad: Básico=33, Profesional=66, Premium=100)
            + acceptanceRate    × 0.05   (tasa de aceptación, 0-1 → 0-100) (AUT-239)
            + completionRate    × 0.05   (tasa de completitud, 0-1 → 0-100) (AUT-239)
            + responseTime      × 0.03   (tiempo respuesta, 0min=100, 120min=0) (AUT-239)
            + badgeBonus        (fijo +5 si hasBadge, configurable)
            ± tendencyBonus     (mejora reciente en ratings, máx ±15 puntos)
            + availabilityBonus (contextual: +25 urgente/disponible ahora, +15 fecha/coincide día) (AUT-251)
```

**Pesos**: 0.22 + 0.20 + 0.15 + 0.10 + 0.10 + 0.05 + 0.05 + 0.05 + 0.05 + 0.03 = 1.00 ✓. El badgeBonus y el availabilityBonus son fijos (no ponderados), agregados al final del score.

**Componentes del scoring:**
- **Compliance (22%)**: base 100, penalización por NOT_FULFILLED con decaimiento temporal
- **ResponseRate (20%)**: base 100, penalización por NO_RESPONSE
- **QualityRating (15%)**: promedio de puntualidad, calidad, comunicación y precio justo (escala 1-5 → 0-100). Sin datos → 60 (score neutro, para no penalizar nuevos). Con datos recientes → bonus/penalización de tendencia (máx ±15)
- **Proximity (10%)**: cercanía real en km con Haversine entre `Request.userLatitude/userLongitude` y `Professional.latitude/longitude`; sin coordenadas en cualquiera de los dos lados retorna 50 (neutro), con tope configurable por `MATCHING_MAX_DISTANCE_KM`.
- **Recommendation (10%)**: % de feedbacks con wouldRecommend = true. Sin feedbacks → 50
- **Distribution (5%)**: bonus por tiempo desde última asignación, penalizado por rechazos (REJECTED events)
- **PlanScore (5%)**: priority 1 (Básico) → 33, 2 (Profesional) → 66, 3 (Premium) → 100. El plan NUNCA puede hacer que un profesional con mala reputación supere a uno con buena (diferencia máxima por plan: ~5 puntos)
- **AcceptanceRate (5%)**: tasa de aceptación (ACCEPTED / ASSIGNED). Sin historial → 50. Rango 0-100. Pondera compromiso y disponibilidad real del profesional (AUT-239)
- **CompletionRate (5%)**: tasa de completitud (COMPLETED / ACCEPTED). Sin historial → 50. Rango 0-100. Mide cuántos trabajos aceptados llegan a buen término sin escalada (AUT-239)
- **ResponseTime (3%)**: tiempo promedio de respuesta entre asignación y aceptación. 0 min = 100, 120 min = 0. Sin historial → 50. Penaliza profesionales que demoran en responder (AUT-239)
- **BadgeBonus**: +5 fijo si hasBadge = true (configurable vía MATCHING_BADGE_BONUS)

- **AvailabilityBonus** (AUT-251): bonus contextual que evalúa `availabilityStructured` del profesional solo cuando el pedido tiene urgencia o fecha mencionada. Sin urgencia/fecha → no se consulta (comportamiento sin cambios).
  - **Urgencia** (`isUrgent: true`): verifica si el profesional tiene un slot activo para el día y hora actuales en Argentina. Si está disponible → +25 puntos. Si no → 0 (no penaliza).
  - **Fecha mencionada** (`mentionedDate`): parsea el día de la semana (domingo=0 → sábado=6) desde lenguaje natural (ej: "sábado", "mañana", "lunes"), incluyendo "hoy" y "mañana" dinámicamente. Si el profesional trabaja ese día → +15 puntos. Si no → 0 (no penaliza).
  - **La disponibilidad nunca descarta** a un profesional del pool de matching, solo suma bonus.
  - Helper `parseDayFromMentionedDate()`: convierte texto en número de día (0-6). Retorna null si no se puede determinar.

**Parámetros configurables vía `SystemConfig` con defaults: `MATCHING_*` keys.**

**Ordenamiento**: por score descendente simple (sin desempate manual por plan — el plan ya está en el score).

**Logs de diagnóstico**: `applyHardFilters()` loguea cada profesional excluido con su motivo. `findEligibleProfessionals()` loguea los resultados crudos y filtrados.

### Requests

| Endpoint                               | Método | Descripción                                    | Auth      |
|----------------------------------------|--------|------------------------------------------------|-----------|
| `/requests`                            | POST   | Crear pedido (bot: phone + category + zone)    | Sin auth  |
| `/requests/:id/accept`                 | POST   | Profesional acepta pedido asignado             | Sin auth  |
| `/requests/:id/reject`                 | POST   | Profesional rechaza pedido → reasigna          | Sin auth  |
| `/requests/:id/cancel`                 | POST   | Usuario cancela pedido                         | Sin auth  |
| `/requests/:id/mark-completed`         | POST   | Profesional marca trabajo como completado      | Sin auth  |
| `/requests/:id/finish`                 | POST   | Profesional finaliza pedido (ACCEPTED → PENDING_CONFIRMATION). Notifica al usuario vía pendingMessage. | Sin auth  |
| `/requests/:id/confirm`                | POST   | Usuario confirma satisfacción (SATISFIED/PARTIAL/UNSATISFIED) | Sin auth  |
| `/requests/:id/dispute`                | POST   | Usuario disputa pedido (→ COMPLETED + Escalation, sin penalización automática) | Sin auth  |
| `/requests/:id/confirm-completion`     | POST   | Usuario confirma (Sí/No) el trabajo (legacy)   | Sin auth  |
| `/requests/:id/report-noncompliance`   | POST   | Usuario reporta incumplimiento                 | Sin auth  |
| `/requests/:id/submit-feedback`        | POST   | Usuario envía feedback del trabajo             | Sin auth  |
| `/requests/:id/rate-professional`     | POST   | Usuario califica al profesional (7 ejes)       | Sin auth  |
| `/requests/:id/rate-user`             | POST   | Profesional califica al usuario (4 ejes)       | Sin auth  |
| `/requests/:id/confirm-visit`         | POST   | Profesional confirma horario de visita (desde panel). Detecta automáticamente horario alternativo via `parseExactDate`. Si alternativo → `AWAITING_USER_CONFIRMATION` + pendingMessage al usuario (AUT-164, AUT-166) | Sin auth  |
| `/requests/:id/confirm-schedule`      | POST   | Bot/panel confirma horario del profesional, acepta `proposedAt DateTime?` para horario alternativo. Usa `parseExactDate` (AUT-166) | Sin auth  |
| `/requests/:id/cancel-by-professional` | POST | Profesional cancela pedido aceptado (ACCEPTED) → CANCELLED + reasignación automática + notificación al usuario vía pendingMessage (AUT-170) | Sin auth  |
| `/requests`                            | GET    | Lista paginada de pedidos                      | OPERATOR  |
| `/requests/:id`                        | GET    | Detalle de pedido con eventos, feedback, profesional asignado (incluye teléfono cuando está ACCEPTED) y datos de coordinación | Sin auth (polling simulador) |

**GET /requests/:id (polling simulador):** El endpoint incluye datos relacionados para el polling de estado:
- `assignedProfessional` → `{ name, phone }` del profesional (phone incluido para mostrar datos de contacto al usuario cuando el pedido es ACCEPTED)
- `events` → historial de eventos
- `feedback` → feedback del usuario
- `coordination` → (solo si `coordinationStatus !== 'SCHEDULED'`) `{ status, scheduledAt, clientAvailability, clientAddress, hasLocation }` para que el frontend muestre el estado de coordinación
- `reassignmentCount` → cantidad de eventos `ASSIGNED` menos 1 (0 = primera asignación, > 0 = reasignación). Calculado on-the-fly desde los eventos del pedido (AUT-174)
- `lastReassignmentReason` → `'PROFESSIONAL_CANCELLED'` (cuando el profesional cancela), `'TIMEOUT'` (cuando el profesional no responde), o `null`. Derivado del evento previo al último ASSIGNED (AUT-174)

**GET /requests (admin):** El endpoint incluye datos relacionados (`include`) para poblar la tabla de pedidos:
- `user` → nombre del cliente
- `category` → nombre del servicio
- `assignedProfessional` → nombre del profesional (puede ser null si no está asignado)
- `events` → historial de eventos
- `feedback` → feedback del usuario

**Flujo de estados:**
```
CREATED → [matching] → ASSIGNED → [acepta] → ACCEPTED
                                → [rechaza/timeout] → [reasigna] → ASSIGNED (loop)
                                                    → [sin candidatos] → NO_RESPONSE
CREATED/ASSIGNED → [usuario cancela] → CANCELLED
ACCEPTED → [profesional cancela] → CANCELLED + [reasigna] → ASSIGNED (loop)
                                                         → [sin candidatos] → NO_RESPONSE
ACCEPTED → [profesional marca completo] → PENDING_CONFIRMATION → [usuario confirma] → COMPLETED (con escalada si UNSATISFIED) → [feedback]
         → [profesional no completa (completionAttempt >= 2)] → NOT_FULFILLED (con escalada y penalización automática)
         → [usuario reporta incumplimiento] → NOT_FULFILLED
ACCEPTED → [auto-complete 24h sin confirmación] → COMPLETED
```

**Lógica de negocio:**
- Crear: validar usuario sin pedido activo (409 si ya tiene) → crea en CREATED → matching → si encuentra candidato transiciona a ASSIGNED con `assignmentTimeoutAt` y notifica al profesional via WhatsApp (`NotificationService.notifyProfessionalAssigned()`). Si no encuentra, permanece en CREATED con `assignmentTimeoutAt` para que el cron reintente.
- Aceptar: incrementar `trialRequestsUsed` si no tiene membresía activa. Inicia coordinación (`CoordinationService.initAfterAccept()`) y notifica al usuario via WhatsApp (`NotificationService.notifyUserRequestAccepted()`) (AUT-195).
- Rechazar: registrar evento REJECTED → reasignar excluyendo todos los rejectores anteriores
- Timeout: ASSIGNED con `assignmentTimeoutAt < now()` → NO_RESPONSE para el profesional actual → reasignar. CREATED con `assignmentTimeoutAt < now()` → reintenta matching → si falla → NO_RESPONSE
- Cancelación (cancel): solo permitida en CREATED o ASSIGNED
- Cancelación por usuario (cancelByUser, AUT-169): permitida en CREATED, ASSIGNED, ACCEPTED (cualquier coordinationStatus incluyendo SCHEDULED). Si coordinationStatus = SCHEDULED, valida que falten más de 2 horas para `scheduledAt`. Registra evento CANCELLED con metadata `{ cancelledBy: 'USER', hadConfirmedVisit, hoursBeforeVisit }`. Retorna `CancelByUserResult` con info de notificación al profesional: notifica solo si ya había aceptado o tenía visita confirmada.
- Cancelación por profesional (cancelByProfessional, AUT-170, AUT-195, AUT-285): permitida solo en ACCEPTED. Valida que el `assignedProfessionalId` coincida con el `professionalId` del caller. Registra evento CANCELLED con metadata `{ cancelledBy: 'PROFESSIONAL', hadConfirmedVisit, scheduledAt }` (no genera NO_RESPONSE — el profesional canceló voluntariamente, no por timeout). Construye un mensaje único al usuario que combina cancelación y estado de reemplazo en 4 variantes según `hasConfirmedVisit` y `match`. Notifica al usuario vía `notificationService.notifyUserProfessionalCancelled()` que usa `sendWithWindowCheck` (texto plano dentro de ventana, template fuera). Si encuentra candidato de reemplazo → ASSIGNED con nuevo timeout. Si no → NO_RESPONSE.
- Finalización (finish): profesional cambia estado ACCEPTED → PENDING_CONFIRMATION + registra `completedAt` + evento PENDING_CONFIRMATION. Envía WhatsApp inmediato al usuario via `CoordinationService.notifyWorkFinished()` con "El profesional {nombre} indicó que finalizó el trabajo. ¿Cómo quedó? (Conforme / Con observaciones / No conforme)" y limpia el flujo de coordinación de la sesión del usuario (AUT-158, AUT-195).
- Finalización por cron (AUT-216): `CoordinationService.checkWorkCompletion()` busca pedidos `ACCEPTED + SCHEDULED` cuya visita ya venció según `WORK_COMPLETION_CHECK_HOURS` (default 24), consulta al profesional por WhatsApp (`AWAITING_WORK_COMPLETION`) y escala a `Escalation` si no hay confirmación tras 2 intentos.
- Confirmación (confirm): usuario envía satisfaction (SATISFIED/PARTIAL/UNSATISFIED)
  - SATISFIED/PARTIAL → COMPLETED + evento COMPLETED + evaluateBadge
  - UNSATISFIED → COMPLETED + evento COMPLETED + crea Escalation + evaluateBadge (SIN penalización automática; la revisa el equipo) (AUT-284)
- Disputa (dispute): alias de confirm con UNSATISFIED (→ COMPLETED, sin penalización)
- Confirm-completion (legacy): usuario confirma Sí/No → COMPLETED o NOT_FULFILLED
- Auto-complete: 24h después de `updatedAt` en PENDING_CONFIRMATION sin confirmación → COMPLETED automático con metadata `{ autoClosedAt, reason: "timeout_user_confirmation" }`. No dispara flujo de calificación.
- Todos los cambios de estado registran su `RequestEvent`
- Jobs (sin endpoints): `processTimeouts()` (cada 15 min), `autoClosePendingConfirmations()` (cada hora) invocados por cron en `server.ts`
- El estado PENDING_CONFIRMATION se considera activo (el usuario no puede crear otro pedido mientras esté en este estado)

**Config keys usadas:**
- `PROFESSIONAL_RESPONSE_TIMEOUT_HOURS` (default: 2)
- `AUTO_COMPLETE_HOURS` (default: 24)
- `TRIAL_REQUESTS_LIMIT` (default: 3)

### Professional Panel (NEW)

Portal de autogestión para profesionales. Acceso exclusivo vía magic link (`app.noraconecta.com.ar/panel/:sessionToken`), sin login con credenciales. El sessionToken (UUID, 30 días de validez) se genera desde el panel admin.

**Arquitectura frontend:**
- Desktop: sidebar fijo 240px con 7 tabs (Inicio, Perfil, Pedidos pendientes, En curso, Historial, Membresía, Reputación). Incluye logo NORA, tagline "Panel del Profesional" y nombre del profesional visible (AUT-178)
- Mobile: bottom navigation bar con los mismos 7 tabs (altura h-16, labels text-[11px]) + header fijo (h-14) con nombre del profesional y tab activo (AUT-178)
- Tab activo por defecto: Inicio (dashboard)
- Sin header; diseño light mode con NORA Green #0B6E4F, DM Sans, JetBrains Mono para números
- Mismo design system que AUT-131/132 (assets/9140616588152080241)
- Cards: `rounded-2xl bg-white border border-[#E5E7EB] shadow-sm p-6`

**Tabs:**

| Tab | Componente | Descripción |
|---|---|---|---|
| Inicio | `ProfessionalDashboard` | Saludo "Hola, {nombre}" + badge de membresía (activa/trial/sin), 4 métricas principales (completados, calificación promedio, % recomendación, score cumplimiento), gráficos de actividad temporal: BarChart de pedidos por día (últimos 7 días, completados/cancelados/no cumplidos) y LineChart de evolución de calificación promedio (últimas 8 semanas) con Recharts, desglose de ratings con barras de progreso (solo si `totalRated > 0`), accesos rápidos a Pedidos pendientes y En curso (AUT-178, AUT-182) |
| Perfil | `ProfessionalProfile` | Estado con badge (Activo/Suspendido/En observación), badge Excelencia NORA, disponibilidad en chips, datos personales, docs R2 (solo lectura) |
| Pedidos pendientes | `ProfessionalPendingRequests` | Lista de pedidos ASSIGNED sin responder, con indicador de tiempo restante, botones Aceptar/Rechazar y modal de confirmación. Sección temporal para testing del flujo de asignación (reemplazable por WhatsApp en AUT-134) |
| En curso | `ProfessionalInProgress` | Pedidos aceptados y en proceso de coordinación (ACCEPTED + PENDING_CONFIRMATION). Muestra estado de coordinación con etiquetas descriptivas (AUT-165): `AWAITING_AVAILABILITY` → "Coordinando horario con el usuario", `AWAITING_CONFIRMATION` → "Esperando tu confirmación de horario", `AWAITING_USER_CONFIRMATION` → "Esperando que el usuario acepte tu propuesta", `AWAITING_LOCATION` → "Esperando dirección del usuario", `SCHEDULED` → "Visita confirmada · {fecha}". Stats cards (total, aceptados, esperando confirmación), búsqueda, tabla con acciones (Confirmar visita, Ver detalle con modal ampliado, Marcar finalizado, Cancelar pedido con modal de confirmación). Botón "Marcar finalizado" (AUT-176): solo visible cuando `coordinationStatus = SCHEDULED` (la visita ya tiene fecha y hora confirmadas). Modal "Confirmar visita": al proponer horario alternativo, el campo se prellena con `clientAvailability` del pedido (AUT-168). Botón "Cancelar pedido" (AUT-170): visible para todo pedido ACCEPTED, modal de confirmación "¿Confirmás que querés cancelar este pedido? Esta acción no se puede deshacer." (AUT-170) |
| Historial | `ProfessionalOrders` | Pedidos donde el profesional participó en algún evento (vía `events.some({ professionalId })`, no solo `assignedProfessionalId`). Muestra `professionalEventType` (evento más reciente del profesional: CANCELLED, COMPLETED, NOT_FULFILLED, NO_RESPONSE) en vez del `status` del pedido (AUT-170). Stats cards, filtros por status (chips + búsqueda extendida por rubro/zona/usuario), tabla con columnas: Fecha, Zona, Usuario (nombre + teléfono), Estado, Calificación (⭐ + promedio clickeable → RatingDetailModal si calificado, "Sin calificación" si no, — si no es COMPLETED), Acción (AUT-179). RatingDetailModal: sección "Lo que el usuario opinó de vos" (Puntualidad/Calidad/Comunicación/Precio justo + promedio + comentario) y "Tu evaluación del usuario" (Claridad/Disponibilidad/Trato/¿Volvería a atenderlo? + comentario, o botón "Calificar al usuario" si no calificó). Pedidos COMPLETED sin calificar: botón "Calificar". Paginación + empty state |
| Membresía | `ProfessionalMembership` | Plan activo (nombre, tipo mensual/anual, fechas, beneficios, precio). Trial: barra de progreso "X de 5 pedidos gratuitos". Expirado: instrucciones + alias de pago + botón WhatsApp |
| Reputación | `ProfessionalReputation` | Donut chart con score de cumplimiento (%), breakdown completados/rechazados/no cumplidos, % recomendación, tasa de aceptación, tiempo de respuesta, consejos |

**Endpoints del panel (sin auth, protegidos por sessionToken):**

| Endpoint | Método | Descripción |
|---|---|---|
| `/professionals/session/:token/panel` | GET | Datos consolidados: perfil, membresía, reputación |
| `/professionals/session/:token/orders` | GET | Historial de pedidos paginado: incluye datos del cliente (nombre, teléfono), descripción, rubro, zona, estado, campos de coordinación (coordinationStatus, clientAddress, userLatitude, userLongitude, scheduledAt), photoUrls, audioUrl, flags de calificación |
| `/professionals/session/:token/pending-requests` | GET | Pedidos ASSIGNED sin responder: rubro, zona, descripción, tiempo restante |

**Response shape `GET /session/:token/panel` (ACTUALIZADO AUT-142):**
```json
{
  "data": {
    "professional": { "id", "name", "phone", "status", "category", "zones", "availability", "hasBadge", "dniFrontUrl", "dniBackUrl", "criminalRecordUrl", "cuil", "references", "presentationVideoUrl" },
    "membership": { "activeMembership": { "plan", "type", "status", "startDate", "endDate" } | null, "trialRequestsUsed": 0, "trialRequestsLimit": 5 },
    "reputation": {
      "complianceScore": 87,
      "completedRequests": 32,
      "rejectedRequests": 5,
      "notFulfilledRequests": 2,
      "totalRequests": 47,
      "wouldRecommendPct": 92,
      "averageRating": 4.2,
      "averagePunctuality": 4.1,
      "averageQuality": 4.5,
      "averageCommunication": 4.3,
      "averagePriceFairness": 4.0,
      "totalRated": 20
    }
  }
}
```

**Response shape `GET /session/:token/orders` (ACTUALIZADO AUT-154):**
```json
{
  "data": [{
    "id", "createdAt", "status", "description", "userName", "userPhone",
    "category": { "name" }, "geoNode": { "name" },
    "ratedByProfessional": false, "ratedByUser": true,
    "coordinationStatus": "SCHEDULED", "clientAvailability": "el viernes a las 18",
    "clientAddress": "Calle 123",
    "userLatitude": -32.89, "userLongitude": -68.84,
    "scheduledAt": "2026-05-06T14:00:00.000Z",
    "photoUrls": ["https://r2.example.com/uuid.jpg"],
    "audioUrl": null
  }],
  "pagination": { "page": 1, "limit": 20, "total": 47, "totalPages": 3 }
}
```

**Response shape `GET /session/:token/pending-requests` (ACTUALIZADO AUT-155):**
```json
{
  "data": [
    {
      "id": "cuid",
      "category": { "id": "cuid", "name": "Plomería" },
      "geoNode": { "id": "cuid", "name": "Maipú" },
      "description": "Se rompió un caño en el baño",
      "createdAt": "2026-05-03T12:00:00.000Z",
      "assignmentTimeoutAt": "2026-05-03T15:00:00.000Z",
      "userName": "Carlos López",
      "photoUrls": ["https://r2.example.com/uuid1.jpg", "https://r2.example.com/uuid2.jpg"],
      "audioUrl": "https://r2.example.com/uuid-audio.webm"
    }
  ]
}
```

**generateSession response (ACTUALIZADO):**
```json
{
  "data": {
    "professional": { ... },
    "sessionToken": "uuid-v4",
    "panelUrl": "http://app.noraconecta.local/panel/uuid-v4"
  }
}
```

`panelUrl` usa la variable de entorno `APP_URL` (default: `http://app.noraconecta.local`). En producción: `https://app.noraconecta.com.ar/panel/:sessionToken`.

### Pedidos pendientes del profesional (AUT-140)

Sección temporal para testing del flujo de asignación. El profesional ve los pedidos en estado `ASSIGNED` donde figura como `assignedProfessionalId`, con indicador del tiempo restante antes del timeout (configurable vía `PROFESSIONAL_RESPONSE_TIMEOUT_HOURS`).

- **Aceptar** (POST `/requests/:id/accept`): cambia estado a `ACCEPTED`, incrementa `trialRequestsUsed` si no tiene membresía ACTIVA
- **Rechazar** (POST `/requests/:id/reject`): registra evento REJECTED, el motor reasigna excluyendo al rejector
- **Modal de confirmación**: antes de aceptar o rechazar, muestra confirmación con el nombre del usuario y datos del pedido (AUT-155)
- **Multimedia en card**: la card muestra miniaturas de fotos clickeables (lightbox) y reproductor de audio inline si existen `photoUrls` o `audioUrl` (AUT-155)
- **Empty state**: "No tenés pedidos pendientes por responder" cuando no hay pedidos ASSIGNED
- Esta sección se reemplazará por notificaciones WhatsApp en AUT-134

**Response shape `GET /session/:token/pending-requests` (ACTUALIZADO AUT-155):**
```json
{
  "data": [
    {
      "id": "cuid",
      "category": { "id": "cuid", "name": "Plomería" },
      "geoNode": { "id": "cuid", "name": "Maipú" },
      "description": "Se rompió un caño en el baño",
      "createdAt": "2026-05-03T12:00:00.000Z",
      "assignmentTimeoutAt": "2026-05-03T15:00:00.000Z",
      "userName": "Carlos López",
      "photoUrls": ["https://r2.example.com/uuid1.jpg"],
      "audioUrl": null
    }
  ]
}
```

**Flujo de acceso:**
1. Admin genera sesión desde `ProfessionalDetailPage` → botón "Generar enlace de acceso"
2. Admin copia `panelUrl` y la envía al profesional por WhatsApp
3. Profesional abre el enlace → `ProfessionalPanelPage` valida el token
4. Si es inválido/expirado → `SessionErrorScreen` con instrucción de WhatsApp
5. Si es válido → `ProfessionalLayout` con los 7 tabs (Inicio por defecto, AUT-178)

**Diseño Stitch:** Pantallas generadas en proyecto `projects/1505486100227666482`, screenshots en `.stitch/professional/`.

### Roles
- `SUPERADMIN`: acceso total
- `OPERATOR`: acceso limitado (futuro)

#### JWT Payload
```ts
{
  adminId: string;
  email: string;
  role: 'SUPERADMIN' | 'OPERATOR';
}
```

## Schema (Prisma)

### Admin
| Columna      | Tipo     | Descripción                    |
|-------------|----------|--------------------------------|
| id          | UUID     | PK, autogenerado               |
| email       | String   | Único, identificador de login  |
| passwordHash| String   | Hash bcrypt (10 rounds)        |
| name        | String   | Nombre visible del admin       |
| role        | Enum     | SUPERADMIN \| OPERATOR        |
| createdAt   | DateTime | Autogenerado                   |
| updatedAt   | DateTime | Autogenerado (on update)       |

### GeoLevel
| Columna   | Tipo     | Descripción                                    |
|----------|----------|------------------------------------------------|
| id       | CUID     | PK, autogenerado                               |
| countryId| CUID     | FK a GeoNode (nodo raíz del país)              |
| level    | Int      | Número de nivel dentro del país (1, 2, ...)    |
| name     | String   | Nombre del nivel ("Provincia", "Departamento") |
| createdAt| DateTime | Autogenerado                                   |
| updatedAt| DateTime | Autogenerado (on update)                       |

- Unique constraint: `(countryId, level)`

### GeoNode
| Columna   | Tipo     | Descripción                                     |
|----------|----------|-------------------------------------------------|
| id       | CUID     | PK, autogenerado                                |
| name     | String   | Nombre del nodo ("Mendoza", "Maipú")            |
| levelId  | CUID?    | FK a GeoLevel (null para países)                |
| parentId | CUID?    | FK a GeoNode padre (null para países)           |
| isActive | Boolean  | Habilitado para matching (default: true)        |
| createdAt| DateTime | Autogenerado                                    |
| updatedAt| DateTime | Autogenerado (on update)                        |

- Self-referencing relation: `parent` / `children` (GeoTree)
- Países son nodos raíz: `parentId = null`, `levelId = null`
- Relaciones: `professionalZones` → ProfessionalZone[], `requests` → Request[]

### Category (ACTUALIZADO AUT-322)
| Columna         | Tipo     | Descripción                                            |
|----------------|----------|--------------------------------------------------------|
| id             | CUID     | PK, autogenerado                                       |
| name           | String   | Único, nombre de la categoría                          |
| slug           | String   | Único, slug para URLs                                  |
| description    | String?  | Descripción opcional                                   |
| isActive       | Boolean  | Habilitado (default: true)                             |
| requiresLicense| Boolean  | Requiere credencial habilitante (default: false) [AUT-322] |
| licenseLabel   | String?  | Etiqueta de la credencial requerida (ej: "Matrícula habilitante de gasista") [AUT-322] |
| createdAt      | DateTime | Autogenerado                                           |
| updatedAt      | DateTime | Autogenerado (on update)                               |

- Relaciones: `professionals` → Professional[], `requests` → Request[]

### User
| Columna            | Tipo     | Descripción                     |
|-------------------|----------|---------------------------------|
| id                | CUID     | PK, autogenerado                |
| phone             | String   | Único, identificador del usuario|
| name              | String   | Nombre del usuario              |
| status            | Enum     | ACTIVE \| BLOCKED               |
| abuseWarningCount | Int      | Contador de advertencias anti-abuso (default: 0) (AUT-241) |
| lastAbuseCheckAt  | DateTime?| Última verificación anti-abuso (AUT-241) |
| savedLocations     | Json?    | Array de SavedLocation (direcciones guardadas para reutilización, máx configurable vía USER_MAX_SAVED_LOCATIONS, default 5) (AUT-306) |
| createdAt         | DateTime | Autogenerado                    |
| updatedAt         | DateTime | Autogenerado (on update)        |

- Relaciones: `requests` → Request[], `escalations` → Escalation[]

### Professional (ACTUALIZADO AUT-322)
| Columna               | Tipo     | Descripción                             |
|----------------------|----------|-----------------------------------------|
| id                   | CUID     | PK, autogenerado                        |
| phone                | String   | Único                                   |
| name                 | String   | Nombre visible                          |
| status               | Enum     | PENDING \| UNDER_REVIEW \| ACTIVE \| OBSERVATION \| SUSPENDED \| PAUSED \| REJECTED |
| categoryId           | CUID     | FK a Category                           |
| availability         | String?  | Disponibilidad (texto libre)            |
| verificationToken    | String   | Único, token de verificación WhatsApp   |
| verificationTokenExp | DateTime | Expiración del token                    |
| verificationTokenUsed| Boolean  | Token ya usado (default: false)         |
| sessionToken         | String?  | Único, token de sesión activa           |
| sessionTokenExp      | DateTime?| Expiración del token de sesión          |
| dniNumber            | String?  | Número de DNI                           |
| dniFrontUrl          | String?  | URL Cloudflare R2: frente DNI           |
| dniBackUrl           | String?  | URL Cloudflare R2: dorso DNI            |
| cuil                 | String?  | CUIL del profesional                    |
| criminalRecordUrl    | String?  | URL Cloudflare R2: antecedentes penales |
| references           | String?  | Referencias laborales                   |
| presentationVideoUrl | String?  | URL Cloudflare R2: video presentación   |
| hasBadge              | Boolean  | Insignia de reputación (default: false) |
| trialRequestsUsed     | Int      | Pedidos de prueba usados (default: 0)   |
| lastAssignedAt        | DateTime?| Última asignación de pedido             |
| latitude              | Float?   | Latitud del profesional para matching geográfico |
| longitude             | Float?   | Longitud del profesional para matching geográfico |
| availabilityStructured| Json?    | Slots de disponibilidad estructurada (AUT-241) |
| problemTypeStats      | Json?    | Mapa tipo → cantidad completados (AUT-241) |
| abuseWarningCount     | Int      | Contador de advertencias anti-abuso (default: 0) (AUT-241) |
| lastAbuseCheckAt      | DateTime?| Última verificación anti-abuso (AUT-241) |
| declaredHasLicense    | Boolean? | null=categoría no requiere / true=declaró que tiene / false=declaró que no tiene [AUT-322] |
| licenseUrl            | String?  | URL del documento de credencial subido en onboarding web [AUT-322] |
| createdAt             | DateTime | Autogenerado                            |
| updatedAt             | DateTime | Autogenerado (on update)                |

- Relaciones: `zones` → ProfessionalZone[], `memberships` → Membership[], `requests` → Request[] (@relation "AssignedProfessional"), `events` → RequestEvent[]
- Índices (AUT-311): `@@index([categoryId, status])`

### ProfessionalZone
| Columna        | Tipo     | Descripción                     |
|---------------|----------|---------------------------------|
| id            | CUID     | PK, autogenerado                |
| professionalId| CUID     | FK a Professional               |
| geoNodeId     | CUID     | FK a GeoNode                    |
| createdAt     | DateTime | Autogenerado                    |

- Unique constraint: `(professionalId, geoNodeId)`
- Índices (AUT-311): `@@index([geoNodeId])`

### Plan (ACTUALIZADO AUT-340)
| Columna           | Tipo     | Descripción                          |
|------------------|----------|--------------------------------------|
| id               | CUID     | PK, autogenerado                     |
| name             | String   | Único, nombre del plan               |
| monthlyPrice     | Float    | Precio mensual                       |
| annualDiscountPct| Float    | % descuento plan anual               |
| priority         | Int      | Prioridad del plan (1=Básico, 2=Profesional, 3=Premium, default: 1) |
| isActive         | Boolean  | Plan activo (default: true)          |
| features         | Json?    | Array de strings con beneficios del plan (AUT-340) |
| createdAt        | DateTime | Autogenerado                         |
| updatedAt        | DateTime | Autogenerado (on update)             |

- Relaciones: `memberships` → Membership[]

### Membership
| Columna        | Tipo     | Descripción                                |
|---------------|----------|--------------------------------------------|
| id            | CUID     | PK, autogenerado                           |
| professionalId| CUID     | FK a Professional                          |
| planId        | CUID     | FK a Plan                                  |
| type          | Enum     | MONTHLY \| ANNUAL                          |
| status        | Enum     | ACTIVE \| INACTIVE \| EXPIRED              |
| startDate     | DateTime | Fecha de inicio                            |
| endDate       | DateTime | Fecha de fin                               |
| paymentRef    | String?  | Referencia de pago                         |
| activatedBy   | String?  | Admin que activó la membresía              |
| createdAt     | DateTime | Autogenerado                               |
| updatedAt     | DateTime | Autogenerado (on update)                   |

### SystemConfig
| Columna   | Tipo     | Descripción                     |
|----------|----------|---------------------------------|
| key      | String   | PK, clave de configuración      |
| value    | String   | Valor (string)                  |
| updatedAt| DateTime | Autogenerado (on update)        |

### Request
| Columna                | Tipo       | Descripción                                  |
|-----------------------|-----------|----------------------------------------------|
| id                    | CUID      | PK, autogenerado                             |
| userId                | CUID      | FK a User                                    |
| categoryId            | CUID      | FK a Category                                |
| geoNodeId             | CUID      | FK a GeoNode (ubicación del pedido)          |
| description           | String    | Descripción del pedido                       |
| photoUrls             | String[]  | URLs de fotos (Cloudflare R2)                |
| audioUrl              | String?   | URL de audio                                 |
| status                | Enum      | CREATED \| ASSIGNED \| ACCEPTED \| CANCELLED \| NO_RESPONSE \| COMPLETED \| NOT_FULFILLED |
| assignedProfessionalId| CUID?     | FK a Professional (relación "AssignedProfessional") |
| assignedAt            | DateTime? | Timestamp de asignación                      |
| acceptedAt            | DateTime? | Timestamp de aceptación                      |
| completedAt           | DateTime? | Timestamp de finalización                    |
| assignmentTimeoutAt   | DateTime? | Timeout de respuesta del profesional         |
| scheduledAt           | DateTime? | Fecha y hora confirmada de la visita         |
| clientAddress         | String?   | Dirección exacta ingresada por el usuario    |
| clientNeighborhood    | String?   | Barrio resuelto vía Nominatim al compartir GPS (AUT-307) |
| clientPostalCode      | String?   | Código postal resuelto vía Nominatim al compartir GPS (AUT-307) |
| clientAvailability    | String?   | Disponibilidad horaria en texto libre        |
| coordinationStatus    | String?   | AWAITING_AVAILABILITY \| AWAITING_CONFIRMATION \| AWAITING_USER_CONFIRMATION \| AWAITING_LOCATION \| SCHEDULED |
| negotiationRounds     | Int       | Rondas de negociación de horario (default: 0) |
| waitingUserConsent     | Boolean?  | Usuario aceptó esperar activación de profesional (default: false) (AUT-188) |
| waitingActivationSince | DateTime? | Timestamp de inicio de espera de activación (24h timeout) (AUT-188) |
| userLatitude           | Float?    | Latitud de referencia del usuario para matching por proximidad |
| userLongitude          | Float?    | Longitud de referencia del usuario para matching por proximidad |
| problemType            | String?   | Clasificación automática con LLM (AUT-241)   |
| isUrgent               | Boolean   | El usuario indicó urgencia (AUT-250)         |
| mentionedDate          | String?   | Fecha/día mencionado por el usuario (AUT-250) |
| technicalBrief         | String?   | Brief técnico generado por IA para el profesional asignado (AUT-273) |
| createdAt             | DateTime  | Autogenerado                                 |
| updatedAt             | DateTime  | Autogenerado (on update)                     |

- Relaciones: `events` → RequestEvent[], `feedback` → Feedback?, `escalation` → Escalation?, `pricing` → RequestPricing?
- Índices (AUT-311): `@@index([userId, status])`, `@@index([categoryId, geoNodeId, status])`, `@@index([assignedProfessionalId, status])`, `@@index([assignmentTimeoutAt, status])`

### RequestEvent
| Columna        | Tipo     | Descripción                           |
|---------------|----------|---------------------------------------|
| id            | CUID     | PK, autogenerado                      |
| requestId     | CUID     | FK a Request                          |
| professionalId| CUID?    | FK a Professional                     |
| type          | Enum     | ASSIGNED \| ACCEPTED \| REJECTED \| NO_RESPONSE \| COMPLETED \| NOT_FULFILLED \| CANCELLED |
| metadata      | Json?    | Datos adicionales del evento          |
| createdAt     | DateTime | Autogenerado                          |

- Índices (AUT-311): `@@index([requestId])`, `@@index([professionalId])`

### Feedback
| Columna                 | Tipo      | Descripción                                          |
|------------------------|----------|------------------------------------------------------|
| id                     | CUID     | PK, autogenerado                                      |
| requestId              | CUID     | Único, FK a Request                                   |
| rating                 | Int?     | Calificación general del usuario al profesional        |
| punctualityRating      | Int?     | Puntualidad                                           |
| qualityRating          | Int?     | Calidad del trabajo                                   |
| communicationRating    | Int?     | Comunicación                                          |
| priceFairnessRating    | Int?     | Relación precio-calidad                               |
| wouldRecommend         | Boolean? | ¿Recomendaría al profesional?                         |
| userComment            | String?  | Comentario del usuario                                |
| ratedByUserAt          | DateTime?| Fecha de calificación del usuario                     |
| requestClarityRating   | Int?     | Claridad del pedido (calificación del profesional al usuario) |
| userAvailabilityRating | Int?     | Disponibilidad del usuario                            |
| userTreatmentRating    | Int?     | Trato del usuario                                     |
| wouldServeAgain        | Boolean? | ¿Atendería de nuevo al usuario?                       |
| professionalComment    | String?  | Comentario del profesional                            |
| ratedByProfessionalAt  | DateTime?| Fecha de calificación del profesional                  |
| sentimentAnalysis      | Json?    | Resultado del análisis IA de comentarios (AUT-241)     |
| createdAt              | DateTime | Autogenerado                                          |
| updatedAt              | DateTime | Autogenerado (on update)                              |

### Escalation
| Columna        | Tipo     | Descripción                              |
|---------------|----------|------------------------------------------|
| id            | CUID     | PK, autogenerado                         |
| requestId     | CUID     | Único, FK a Request                      |
| reportedBy    | CUID     | FK a User (quien reporta)                |
| professionalId| CUID     | FK a Professional (reportado)            |
| status        | Enum     | OPEN \| IN_REVIEW \| RESOLVED            |
| resolution    | String?  | Texto de resolución                      |
| resolvedBy    | String?  | Admin que resolvió                       |
| createdAt     | DateTime | Autogenerado                             |
| updatedAt     | DateTime | Autogenerado (on update)                 |

### RequestPricing (AUT-316)
| Columna    | Tipo                    | Descripción                                       |
|-----------|------------------------|---------------------------------------------------|
| id        | CUID                   | PK, autogenerado                                   |
| requestId | CUID                   | Único, FK a Request                                |
| amountPaid| Int?                   | Monto pagado en pesos (sin decimales)              |
| currency  | String                 | Código de moneda (default: "ARS")                  |
| reportedAt| DateTime?              | Fecha en que el usuario reportó el precio          |
| embedding | vector(1536)?          | Placeholder para embeddings semánticos (Capa 2) — NULL hasta futura implementación |
| createdAt | DateTime               | Autogenerado                                       |
| updatedAt | DateTime               | Autogenerado (on update)                           |

- Unique constraint: `requestId`
- Índice: `@@index([requestId])`
- Relaciones: `request` → Request
- La extensión pgvector debe estar habilitada en la DB (`CREATE EXTENSION IF NOT EXISTS vector`)
- `embedding` queda en NULL hasta Capa 2 (búsqueda semántica de precios similares)
- Solo el usuario reporta el precio (no el profesional) — capturado vía `FEEDBACK_AMOUNT` step en `feedback.flow.ts`

### BotSession
| Columna       | Tipo      | Descripción                                      |
|--------------|----------|--------------------------------------------------|
| id           | CUID     | PK, autogenerado                                 |
| phone        | String   | Teléfono del usuario (parte de clave compuesta)  |
| role         | Enum     | USER \| PROFESSIONAL (requerido, parte de clave compuesta) |
| currentFlow  | String?  | Flujo actual del bot                             |
| currentStep  | String?  | Paso actual dentro del flujo                     |
| tempData     | Json?    | Datos temporales de la conversación              |
| lastInboundAt| DateTime?| Timestamp del último mensaje entrante recibido   |
| reminderSentAt    | DateTime?| Timestamp del recordatorio de timeout enviado (AUT-177) |
| lastTemplateSentAt | DateTime?| Timestamp del último template enviado por rol (AUT-271) |
| createdAt         | DateTime | Autogenerado                                     |
| updatedAt         | DateTime | Autogenerado (on update)                         |

- Unique constraint: `@@unique([phone, role])` — permite dos sesiones simultáneas e independientes del mismo teléfono (USER y PROFESSIONAL) (AUT-192)

### Enums

- **AdminRole**: SUPERADMIN, OPERATOR
- **UserStatus**: ACTIVE, BLOCKED
- **ProfessionalStatus**: PENDING, UNDER_REVIEW, ACTIVE, OBSERVATION, SUSPENDED, PAUSED, REJECTED
- **MembershipStatus**: ACTIVE, INACTIVE, EXPIRED, CANCELED — AUT-352
- **MembershipType**: MONTHLY, ANNUAL
- **RequestStatus**: CREATED, ASSIGNED, ACCEPTED, PENDING_CONFIRMATION, CANCELLED, NO_RESPONSE, COMPLETED, NOT_FULFILLED
- **RequestEventType**: ASSIGNED, ACCEPTED, REJECTED, NO_RESPONSE, PENDING_CONFIRMATION, COMPLETED, NOT_FULFILLED, CANCELLED
- **EscalationStatus**: OPEN, IN_REVIEW, RESOLVED
- **BotRole**: USER, PROFESSIONAL
- **ErrorVariant** (frontend): expired, used, invalid, missing

## Environment Variables

| Variable            | Requerida | Descripción                              |
|--------------------|-----------|------------------------------------------|
| `DATABASE_URL`     | Sí        | Connection string de PostgreSQL          |
| `JWT_SECRET`       | Sí        | Secreto para firmar/verificar JWT        |
| `PORT`             | No (3000) | Puerto del servidor HTTP                 |
| `NODE_ENV`         | No (`development`) | Entorno de ejecución (`development`/`production`) |
| `ALLOWED_ORIGIN`   | No (`http://localhost:5173`) | Origin permitido por CORS para requests con credenciales |
| `PUBLIC_URL`       | No (http://localhost:3000) | URL pública para links de verificación   |
| `SEED_ADMIN_EMAIL` | No        | Email del superadmin inicial (seed)      |
| `SEED_ADMIN_PASSWORD`| No      | Password del superadmin inicial (seed)   |
| `R2_ACCOUNT_ID`     | Sí        | Cloudflare R2 account ID                |
| `R2_ACCESS_KEY_ID`  | Sí        | Cloudflare R2 access key ID             |
| `R2_SECRET_ACCESS_KEY`| Sí      | Cloudflare R2 secret access key         |
| `R2_BUCKET_NAME`    | Sí        | Cloudflare R2 bucket name               |
| `R2_PUBLIC_URL`     | Sí        | URL pública base del bucket R2          |
| `BUILD_TARGET`      | No        | Target de build: `admin`, `app`, o `landing` (solo frontend) |
| `VITE_API_URL`      | No        | URL de la API para builds admin/app (.env.admin, .env.app) |
| `VITE_WHATSAPP_NUMBER`| No      | Número de WhatsApp para build landing (.env.landing) |
| `OPENAI_API_KEY`    | No        | API key de OpenAI (obsoleta para parseo de fechas desde AUT-166; conservada para usos futuros) |
| `OPENAI_BASE_URL`   | No        | URL base alternativa de la API de OpenAI (default: https://api.openai.com/v1) |
| `LLM_MODEL`         | No        | Modelo LLM a usar (default: gpt-4o-mini). Sin uso activo en coordinación desde AUT-166 |
| `WHATSAPP_BASE_URL`| No (`https://graph.facebook.com`) | URL base de la API WhatsApp (Meta directo o proxy BSP como Kapso) |
| `WHATSAPP_API_TOKEN_USER`| No | API key/token del proveedor WhatsApp para el número de usuarios |
| `WHATSAPP_API_TOKEN_PROFESSIONAL`| No | API key/token del proveedor WhatsApp para el número de profesionales |
| `WHATSAPP_PHONE_NUMBER_ID_USER`| No | Phone Number ID del número de WhatsApp para usuarios |
| `WHATSAPP_PHONE_NUMBER_ID_PROFESSIONAL`| No | Phone Number ID del número de WhatsApp para profesionales |
| `WHATSAPP_APP_SECRET`| No | Secret para validación HMAC-SHA256 del webhook de Meta directo (`x-hub-signature-256`) |
| `WHATSAPP_WEBHOOK_SECRET`| No | Secret para validación HMAC-SHA256 del webhook de Kapso (`x-webhook-signature`) |
| `WHATSAPP_API_VERSION`| No (v19.0) | Versión de la API de Meta |

### MCP Environment Variables

| Variable            | Requerida | Default | Descripción                              |
|--------------------|-----------|---------|------------------------------------------|
| `NORA_API_URL`     | No        | `https://api.noraconecta.com` | URL base de la API de NORA |
| `NORA_ADMIN_EMAIL` | Sí        | —       | Email del admin para autenticación MCP   |
| `NORA_ADMIN_PASSWORD` | Sí     | —       | Password del admin para autenticación MCP |

## Business Rules

- Passwords se hashean con bcrypt (10 rounds de salt)
- JWT expira en 24 horas
- Solo usuarios con rol `SUPERADMIN` pueden acceder a rutas protegidas con `requireSuperAdmin`
- Errores de autenticación retornan 401 (credenciales inválidas o token inválido/expirado)
- Errores de autorización retornan 403 (rol insuficiente)
- Auth admin usa cookie `admin_token` httpOnly (sameSite=lax, secure en producción) con persistencia de 7 días
- `POST /auth/login` no retorna JWT en el body; retorna solo `{ admin }` y setea cookie
- `requireAuth` mantiene compatibilidad con `Authorization: Bearer` y usa cookie `admin_token` como fallback
- El seed crea/actualiza superadmin, jerarquía geográfica, configuración del sistema, planes y categorías si no existen previamente
- Jerarquía geográfica:
  - Países son nodos raíz (`parentId = null`, `levelId = null`)
  - Cada país define N niveles con nombres configurables (GeoLevel)
  - La unidad mínima para matching es siempre el nodo hoja (sin hijos), sin importar en qué nivel esté
  - Un nodo no puede activarse si su padre está inactivo
  - Desactivar un nodo padre desactiva en cascada todos sus hijos
  - No se puede hacer toggle de un país directamente (422)
- Categorías:
  - El slug se genera automáticamente desde el name (lowercase, sin acentos, espacios → guiones)
  - El slug es inmutable una vez creado (no se puede editar)
  - No se permite crear categorías con name o slug duplicado → 409
  - `findBySlugOrName(query)`: búsqueda exacta por slug o name, luego Levenshtein con threshold configurable (max distance: 3) como fallback; retorna `null` si no hay match
- Usuarios:
  - El usuario no se registra explícitamente; el bot lo crea automáticamente al detectar un número nuevo solo cuando el `role` es `USER` (AUT-202)
  - `findOrCreateByPhone(phone, name?)`: busca por teléfono; si no existe, crea uno nuevo con `name` (default: phone)
  - `findByPhone(phone)`: busca por teléfono y retorna `User | null` sin crear registros
  - Cuando el `role` del bot es `PROFESSIONAL`, nunca se crea `User` nuevo de forma implícita (AUT-202)
  - `isBlocked(phone)`: retorna `true` si el status es BLOCKED; si el usuario no existe, retorna `false`
  - No existe endpoint de creación manual ni de eliminación de usuarios
  - Bloquear un usuario ya bloqueado retorna 409; desbloquear uno activo retorna 409
- Profesionales:
  - El registro es en dos etapas: etapa 1 (bot WhatsApp) crea en PENDING con token de verificación, etapa 2 (web) sube documentación y pasa a UNDER_REVIEW
  - Token de verificación: UUID v4, expira en 72h, un solo uso (segundo intento retorna 400)
  - `GET /professionals/verify/:token` retorna `{ valid, professionalName, zones: [{ id, name }] }` — las zonas provienen de la tabla ProfessionalZone con include de GeoNode
  - `POST /professionals/verify/:token` acepta `{ dniNumber, cuil, dniFrontUrl, dniBackUrl, criminalRecordUrl?, references?, presentationVideoUrl? }` — todos los campos son opcionales en backend; el frontend valida obligatoriedad de DNI, CUIL, dniFrontUrl y dniBackUrl
  - El frontend de onboarding (`/verify/:token`) es standalone (sin header ni nav), mobile-first (375px), con barra de progreso de 8 pasos y upload de archivos a R2 vía presigned URLs
  - El sistema nunca aprueba profesionales automáticamente — siempre requiere revisión manual de un SUPERADMIN
  - Aprobación: solo permite transición UNDER_REVIEW → ACTIVE y envía WhatsApp de bienvenida. Si el profesional está dentro de la ventana de 24hs se envía texto directo; si está fuera se usa el template `nora_pro_bienvenida`. Incluye la cantidad de pedidos gratuitos (`TRIAL_REQUESTS_LIMIT`, default 3)
  - Rechazo: solo permite transición UNDER_REVIEW → REJECTED. El motivo se registra en logs (no hay campo en DB para rejectionReason en MVP)
  - Suspensión: cualquier estado → SUSPENDED (excepto si ya está suspendido → 409)
  - Reactivación: solo permite transición SUSPENDED → ACTIVE
  - Badge: se puede asignar y remover; asignar un valor ya existente retorna 409
  - Token de sesión: UUID v4, expira en 30 días, solo generable para profesionales ACTIVE
  - `getActiveCandidates(categoryId, geoNodeId)`: retorna profesionales ACTIVE con zona y rubro coincidentes, con trialRequestsUsed < 5 y `canReceiveRequests() = true`
  - En MVP: un solo rubro por profesional
- Planes (ACTUALIZADO AUT-340):
  - Tres planes: Básico ($9.000/mes, prioridad 1), Profesional ($20.000/mes, prioridad 2), Premium ($40.000/mes, prioridad 3)
  - `monthlyPrice` debe ser un número no negativo
  - `annualDiscountPct` debe estar entre 0 y 100
  - No se permite crear planes con nombre duplicado → 409
  - `features` (Json?): array opcional de strings con beneficios. Los planes pueden crearse, editarse y desactivarse desde el admin — AUT-340
  - Al editar `name`, se valida unicidad contra otros planes
  - Desactivar un plan lo marca como `isActive: false`; no se elimina físicamente ni afecta membresías existentes
- Membresías:
  - `canReceiveRequests(professionalId)`: retorna `true` si hay membresía ACTIVE con `endDate > now()`, o si `trialRequestsUsed < TRIAL_REQUESTS_LIMIT`; en cualquier otro caso retorna `false`
  - Activación manual: MONTHLY → `endDate = startDate + 30 días`; ANNUAL → `endDate = startDate + 365 días`
  - Expiración lazy: si al consultar estado se detecta `endDate <= now()` → se marca la membresía como EXPIRED
  - La lógica de activación no conoce el origen del pago (preparada para integración con MercadoPago)
- Panel profesional — CTA persistente de conversión (AUT-333):
  - Cuando `!hasActiveMembership`, aparece un CTA persistente y no invasivo en todas las secciones del panel
  - Desktop: badge verde (`bg-[#F0FDF4]`, `border-[#A7F3D0]`) debajo del nombre en el sidebar con el conteo de pedidos gratuitos restantes y "Activar →"
  - Mobile: banner fijo (`fixed top-14`, `lg:hidden`) debajo del header con el emoji ⚡, texto contextual y "Activar →"
  - Padding del `<main>` se ajusta condicionalmente: `pt-28` con banner, `pt-20` sin banner
  - Al hacer click en el CTA → navega a tab `membership`
  - Cuando `hasActiveMembership = true` → ningún CTA extra aparece
  - El botón sticky previo en `ProfessionalMembership.tsx` fue eliminado (redundante en su propia sección)
- Configuración del sistema:
  - `TRIAL_REQUESTS_LIMIT` define el máximo de pedidos de prueba por profesional (default: 3)
  - `PROFESSIONAL_RESPONSE_TIMEOUT_HOURS` define el timeout de respuesta del profesional asignado (default: 2)
  - `AUTO_COMPLETE_HOURS` define las horas sin confirmación para auto-completar un pedido (default: 24)
  - `USER_SERVICE_SELECTION_MODE` define el modo de selección de categoría en el flujo de usuario: `LIST` (numerada, default) o `FREE_TEXT` (NLP)
  - `USER_ZONE_SELECTION_MODE` define el modo de selección de zona: `LIST` (provincia → zona numerada, default) o `FREE_TEXT` (NLP directo, sin paso de provincia)
  - `USER_MAX_SAVED_LOCATIONS` define el máximo de direcciones guardadas por usuario (default: 5). Al exceder, se descarta la entrada con `updatedAt` más antiguo (AUT-306)
  - Las claves de configuración se crean/actualizan vía upsert
- Motor de matching (ACTUALIZADO AUT-186):
  - Scoring en tiempo real, no persistido en DB
  - Filtros duros: status ACTIVE | OBSERVATION, zona, categoría, canReceiveRequests, máximo activos configurable, no rechazó el pedido
  - Fórmula: Compliance × 0.30 + ResponseRate × 0.22 + QualityRating × 0.18 + Proximity × 0.10 + Recommendation × 0.10 + Distribution × 0.05 + PlanScore × 0.05 + BadgeBonus (fijo) + TendencyBonus (máx ±15) + AvailabilityBonus (contextual, AUT-251)
  - Compliance: base 100, -50 por NOT_FULFILLED atenuado linealmente hasta `REPUTATION_DECAY_DAYS` (default: 90). Mín 0.
  - ResponseRate: base 100, -25 por NO_RESPONSE. Mín 0.
  - QualityRating: promedio de puntualidad, calidad, comunicación y precio justo (escala 1-5). Sin datos → 60 (score neutro). Con datos recientes (30d) → bonus/penalización de tendencia (máx ±15).
  - Proximity: distancia real en km con Haversine entre coordenadas del pedido (`userLatitude`/`userLongitude`) y del profesional (`latitude`/`longitude`). Si faltan coordenadas en cualquiera, retorna 50 (neutro). Escala lineal con tope `MATCHING_MAX_DISTANCE_KM` (default 50km).
  - Recommendation: % feedbacks con `wouldRecommend = true`. Sin feedbacks → 50.
  - Distribution: bonus por tiempo desde última asignación (días × dailyBonus). Penalizado por rechazos (REJECTED events, -10 c/u por default).
  - PlanScore: Básico=33, Profesional=66, Premium=100. Con peso 0.05, la diferencia máxima por plan es ~3 puntos.
  - BadgeBonus: +5 fijo si hasBadge = true (configurable). No ponderado — se agrega al final.
  - AvailabilityBonus (AUT-251): bonus contextual que nunca descarta profesionales, solo suma puntos extra. Solo se activa cuando el pedido tiene `isUrgent: true` o `mentionedDate` no nulo.
    - Urgencia: si el profesional tiene un slot de disponibilidad que cubre el día y hora actual → +25. No penaliza si no está disponible.
    - Fecha mencionada: parsea el día mencionado por el usuario (ej: "sábado" → día 6) y suma +15 si el profesional trabaja ese día. No penaliza si no trabaja.
    - Helper `parseDayFromMentionedDate()`: convierte menciones de días en español a número de día (0=domingo → 6=sábado), incluyendo "hoy" y "mañana" con resolución dinámica. Retorna null si no se puede determinar.
  - Ordenamiento por score descendente simple (sin desempate manual por plan).
  - El plan NUNCA puede compensar mala reputación.
  - Todos los pesos, penalizaciones y límites son configurables vía `SystemConfig` con defaults en `MATCHING_*` keys.
  - `findBestCandidate()` retorna `null` si ningún profesional pasa los filtros.
  - Sin endpoints REST propios — es invocado internamente por el módulo de Pedidos.
- Pedidos:
  - Usuario con pedido activo (CREATED, ASSIGNED, ACCEPTED, PENDING_CONFIRMATION) no puede crear otro → 409
  - Usuario bloqueado no puede crear pedidos → 403
  - Al crear pedido desde bot, `userLatitude` y `userLongitude` son opcionales (step `ASK_LOCATION`). Si el usuario omite ubicación, el pedido se crea igual.
  - Creación dispara matching automáticamente vía `findBestCandidate()`; si encuentra candidato → notifica al profesional via WhatsApp (`NotificationService.notifyProfessionalAssigned()`). Si no hay candidatos → NO_RESPONSE
- `technicalBrief` (AUT-275): al crear el pedido desde el flujo `USER_REQUEST`, el campo `technicalBrief` se genera vía LLM multimodal (`generateTechnicalBrief`) analizando la descripción, categoría, respuesta de clarificación (si hubo) y fotos. Se persiste en `Request.technicalBrief` para que el profesional asignado tenga un brief técnico generado por IA.
  - `assignmentTimeoutAt` se setea al asignar: `now() + PROFESSIONAL_RESPONSE_TIMEOUT_HOURS` (default: 2h)
  - Aceptar: incrementa `trialRequestsUsed` si el profesional no tiene membresía ACTIVA vigente. Limpia `assignmentTimeoutAt`. Inicia flujo de coordinación (`CoordinationService.initAfterAccept()`) y notifica al usuario via WhatsApp (`NotificationService.notifyUserRequestAccepted()`) (AUT-195).
  - Rechazar: registra evento REJECTED, recolecta todos los rejectores anteriores (incluyendo al actual) y reasigna excluyéndolos
  - Sin candidatos tras reasignación → NO_RESPONSE
  - Cancelación: solo permitida en CREATED o ASSIGNED → CANCELLED
  - `finish`: profesional finaliza trabajo → PENDING_CONFIRMATION + setea `completedAt` + evento PENDING_CONFIRMATION. Solo permitido en ACCEPTED.
  - `confirm`: usuario confirma satisfacción (SATISFIED/PARTIAL/UNSATISFIED). SATISFIED/PARTIAL → COMPLETED + evaluateBadge. UNSATISFIED → NOT_FULFILLED + Escalation + penalización. Solo permitido en PENDING_CONFIRMATION.
  - `dispute`: alias de `confirm(UNSATISFIED)`. Crea Escalation y penaliza al profesional automáticamente.
  - `markCompleted`: (legacy) profesional setea `completedAt`, el status sigue ACCEPTED
  - `confirmCompletion`: (legacy) usuario confirma Sí → COMPLETED, o No → NOT_FULFILLED
  - `reportNoncompliance`: (legacy) usuario reporta incumplimiento → NOT_FULFILLED
  - `submitFeedback`: solo para pedidos COMPLETED; un solo feedback por pedido → 409 si ya existe
- Timeout job (dos etapas, AUT-177, AUT-195): 
  - **Etapa 1 — Recordatorio (entre 60 y 90 minutos sin respuesta):** Busca pedidos ASSIGNED con `updatedAt` entre 60 y 90 minutos atrás cuyo profesional asignado no tenga `reminderSentAt` en su `BotSession`. Registra `reminderSentAt` y envía WhatsApp inmediato al profesional via `NotificationService.notifyProfessionalReminder()`. Si `NotificationService` no está disponible, loggea el mensaje como fallback.
  - **Etapa 2 — Reasignación (más de 90 minutos sin respuesta):** Busca pedidos ASSIGNED con `updatedAt` > 90 minutos atrás. Crea evento `NO_RESPONSE` para el profesional actual y limpia su `reminderSentAt`. Excluye al profesional vencido + rejectores previos y reasigna. Si hay nuevo candidato → notifica al nuevo profesional (`notifyProfessionalReassigned`). Si no hay candidatos → `NO_RESPONSE` + notifica al usuario (`notifyUserNoResponse`).
  - El cron corre cada 15 minutos (`*/15 * * * *`).
- Auto-complete job: busca PENDING_CONFIRMATION con `updatedAt < now() - AUTO_COMPLETE_HOURS` (default: 24h) → COMPLETED + evento con metadata `{ autoClosedAt, reason: "timeout_user_confirmation" }`. El cron corre cada hora (`node-cron` en `server.ts`). No dispara flujo de calificación.
- **Reminders job:** busca SCHEDULED con `scheduledAt` entre 23h y 24h en el futuro → envía WhatsApp inmediato a usuario y profesional via `CoordinationService.sendReminders()` (AUT-195). Al profesional lo deja en `COORDINATION/AWAITING_VISIT_CONFIRMATION` para responder `Confirmo` o `Cancelar`; si cancela, se ejecuta `cancelByProfessional` y se dispara la reasignación (AUT-215). El cron corre cada hora (`node-cron` en `server.ts`).
- **Work completion check job (AUT-216):** busca pedidos `ACCEPTED + SCHEDULED` con visita vencida (`WORK_COMPLETION_CHECK_HOURS`, default 24), pregunta al profesional si finalizó (`nora_pro_check_finalizacion`), reintenta una segunda vez con link al panel (`nora_pro_check_finalizacion_ultimo`) y, sin confirmación, abre escalada automática.
- Endpoint manual de testing: `POST /admin/requests/auto-close` (SUPERADMIN) ejecuta el mismo proceso bajo demanda.
- Los jobs `processTimeouts()` y `autoClosePendingConfirmations()` son métodos públicos invocados por el cron job interno
- **Coordinación de visita (AUT-151, AUT-152, AUT-160, AUT-195, AUT-201):**
  - Al aceptar un pedido (`POST /requests/:id/accept`), `RequestsService.accept()` dispara `CoordinationService.initAfterAccept()` que setea `coordinationStatus = AWAITING_AVAILABILITY` y configura la sesión del usuario en el bot. También envía WhatsApp inmediato al usuario via `NotificationService.notifyUserRequestAccepted()`.
  - Los mensajes de coordinación (`confirmVisit`, `notifyWorkFinished`, `sendReminders`) se envían inmediatamente por WhatsApp via `CoordinationService` (antes usaban `pendingMessage` en BotSession).
  - NORA actúa como relay entre usuario y profesional para coordinar día, hora y dirección exacta
  - Estados de coordinación: `AWAITING_AVAILABILITY` → `AWAITING_CONFIRMATION` → `AWAITING_LOCATION` → `SCHEDULED`
   - Si el profesional propone un horario diferente al del usuario → `AWAITING_USER_CONFIRMATION`:
     - Mensaje al usuario: "{nombre} no puede {disponibilidad}. Propone el DD/MM a las HH:MM. ¿Te viene bien? (Sí / No)" en vez del día de semana (AUT-167)
     - Usuario acepta → `AWAITING_LOCATION` (continúa flujo de dirección)
     - Usuario rechaza → vuelve a `AWAITING_AVAILABILITY` con mensaje que incluye formato: "Escribí así: DD/MM HH:MM (ejemplo: 20/06 16:00)" (AUT-167)
     - Tras 3 rondas sin acuerdo → se intenta con el siguiente profesional del matching (`reassignAfterNegotiation`)
  - El usuario comparte disponibilidad horaria vía chat → el coordination flow guarda la disponibilidad en `clientAvailability` y notifica al profesional
  - El profesional confirma desde el panel (`POST /requests/:id/confirm-visit`) → `confirmVisit` detecta si el horario es alternativo comparando el parseo con `parseExactDate` del texto del profesional vía `isSameSchedule`. Si la respuesta es afirmativa ("dale", "confirmo", etc.) → `AWAITING_LOCATION`. Si no es afirmativa y `parseExactDate` parseó → `AWAITING_USER_CONFIRMATION`. Si no se pudo parsear el texto del profesional → reset a `AWAITING_AVAILABILITY`. `scheduledAt` se guarda, NORA pide dirección exacta al usuario.
  - En `AWAITING_LOCATION`, el usuario comparte solo dirección exacta en texto (`clientAddress`)
  - Las coordenadas del usuario ya vienen en el pedido desde `ASK_LOCATION` del flujo `USER_REQUEST` (`userLatitude`/`userLongitude`)
  - Al recibir dirección → `coordinationStatus = SCHEDULED`, NORA notifica al profesional con dirección y, si hay coordenadas del pedido, link de Google Maps
  - El profesional ve en su panel: botón "Confirmar visita" (cuando AWAITING_CONFIRMATION), indicador "Esperando dirección" (cuando AWAITING_LOCATION, no permite marcar finalizado) y botón "Ver detalle" (cuando SCHEDULED, muestra dirección y link Google Maps)
  - El simulador web incluye un botón "📍 Compartir ubicación (simulada)" que envía coordenadas hardcodeadas de Mendoza (`-32.8908, -68.8272`) cuando NORA pide compartir ubicación desde WhatsApp — exclusivo para testing en desarrollo
  - El usuario NUNCA recibe el teléfono del profesional en ningún momento
  - El profesional SÍ recibe el teléfono del usuario en el modal "Ver detalle" del panel
  - Cron job `sendVisitReminders()` busca pedidos SCHEDULED con `scheduledAt` dentro de 23-24h y envía recordatorio a ambas partes vía `pendingMessage` en BotSession
  - El coordination flow y el coordination service están aislados del módulo de requests — `RequestsService.create()` no importa dependencias de coordinación
  - El polling del simulador (`useChat`) detecta cambios de `coordinationStatus` y muestra mensajes automáticos: disponibilidad solicitada, horario confirmado, pedido de ubicación, visita coordinada
  - El `POST /bot/message` acepta campo `location: { latitude, longitude }` en el body para simular pines de WhatsApp
  - `negotiationRounds` cuenta la cantidad de rondas de negociación; se resetea a 0 tras reasignación o cuando se retoma el flujo con otro profesional
  - **Parseo de fecha con lenguaje natural (AUT-237):** `parseDateTimeNatural()` acepta formato exacto `DD/MM HH:MM` y expresiones como "mañana a las 4" o "el viernes a las 10" mediante LLM (`callLLM()`). El formato exacto se verifica primero; si falla usa LLM; si ambos fallan pide aclaración.
  - **Timezone Argentina (AUT-167):** Al formatear fechas para mostrar al usuario o profesional, se usan `getDayArgentina`, `getHoursArgentina`, `getMinutesArgentina`, `formatDateTimeArgentina` (`utils/date-utils.ts`) que aplican offset UTC-3. Esto corrige el día de semana y la hora cuando el panel envía fechas en UTC.
- Todos los cambios de estado (asignación, aceptación, rechazo, cancelación, finalización, no respuesta) registran su `RequestEvent` inmutable
- Penalizaciones automáticas: 1er NOT_FULFILLED → OBSERVATION, 2do+ → SUSPENDED + alerta. Se ejecutan en la misma transacción que el evento.
- Reactivación (manual vía SUPERADMIN) conserva todo el historial de eventos
- Badge se otorga automáticamente cuando cumplimiento = 100% y pedidos completados ≥ `BADGE_MIN_COMPLETED_REQUESTS`
- Badge se remueve automáticamente al recibir un NOT_FULFILLED con badge activo
- Los profesionales con status OBSERVATION siguen en el pool de matching (se consideran elegibles junto con ACTIVE)
- Los profesionales con status SUSPENDED quedan fuera del pool
- Storage: el backend nunca recibe el contenido binario de archivos; los clientes suben directo a R2 usando URLs pre-firmadas
- El filename en R2 se reemplaza por UUID preservando la extensión original
- Cada folder (`request-photos`, etc.) tiene su propia lista blanca de contentTypes
- La URL pre-firmada expira después de un tiempo configurable (default: 3600 segundos)
- Escalations se crean automáticamente en `reportNoncompliance` dentro de la misma transacción
- Ventana de conversación de WhatsApp (24hs): el sistema registra `lastInboundAt` en cada mensaje entrante. Si el último mensaje recibido fue hace menos de 24hs, NORA puede responder con mensaje libre; si pasaron más de 24hs o nunca hubo mensaje, NORA debe usar una plantilla aprobada. La ventana la abre el usuario/profesional cuando escribe, no cuando NORA escribe. El helper `shouldUseTemplate()` en `utils/whatsapp-utils.ts` encapsula esta decisión para todos los módulos.
- **Dos números de WhatsApp (AUT-134):** NORA opera con dos números distintos: uno para usuarios y otro para profesionales. El rol se determina automáticamente por el `phone_number_id` del webhook de Meta, sin consultar DB.
- **Webhook WhatsApp (AUT-134, ACTUALIZADO AUT-219):** El endpoint `/webhooks/whatsapp` valida HMAC-SHA256 de forma flexible según el header recibido: Kapso (`x-webhook-signature` + `WHATSAPP_WEBHOOK_SECRET`) o Meta directo (`x-hub-signature-256` + `WHATSAPP_APP_SECRET`). Si no hay firma válida responde 401. Responde 200 inmediatamente al proveedor y procesa el mensaje de forma asincrónica. Recibe mensajes de texto, imagen, audio y ubicación.
- **Archivos entrantes de WhatsApp (AUT-134):** Imágenes y audio enviados por usuarios/profesionales se descargan de la URL temporal de Meta y se suben a R2. La URL pública de R2 se pasa al `IncomingMessage` para que el bot la procese.
- **shouldUseTemplate() en envíos salientes (AUT-134):** El `WhatsAppAdapter.sendText()` consulta `shouldUseTemplate()` antes de enviar. Si se necesita template (fuera de ventana de 24hs), usa el template `nora_notification` con el texto como parámetro.
- Escalations solo pueden transicionar OPEN→IN_REVIEW→RESOLVED; RESOLVED es terminal
- `resolve` requiere texto de resolución no vacío; registra el admin que resuelve
- Calificación post-servicio (AUT-142):
  - `POST /requests/:id/rate-professional`: solo pedidos COMPLETED; una calificación por usuario (ratedByUserAt) → 409 si ya calificó
  - `POST /requests/:id/rate-user`: solo pedidos COMPLETED; una calificación por profesional (ratedByProfessionalAt) → 409 si ya calificó
  - Todos los campos numéricos entre 1 y 5; comentarios opcionales con máximo 300 caracteres
  - La reputación (promedios por eje, % recomendación, total calificados) se calcula on-the-fly desde los feedbacks, sin campos nuevos en Professional
  - El panel del profesional muestra desglose por eje (puntualidad, calidad, comunicación, precio justo) con estrellas
  - El profesional puede calificar al usuario desde la pestaña "Mis Pedidos" del panel (botón "Calificar" en pedidos COMPLETED sin calificar)
  - El panel admin muestra reputación real con desglose por eje en el detalle del profesional
  - El simulador guía al usuario paso a paso por los 7 ejes de calificación cuando el pedido pasa a COMPLETED

## Frontend: Admin Panel (NEW — AUT-132)

Panel de administración completo con 11 pantallas. Autenticación JWT en memoria (no localStorage), layout con sidebar colapsable en mobile, y guardas de ruta por rol (SUPERADMIN / OPERATOR).

### Tech Stack
- React 19 + TypeScript
- Tailwind CSS 4 (tokens del DESIGN.md)
- lucide-react (íconos)
- react-router-dom v7 (rutas protegidas)

### Design System
- Stitch project: `projects/1505486100227666482`
- Design asset: `assets/9140616588152080241`
- DESIGN.md: `.stitch/admin/DESIGN.md`
- Modo claro, DM Sans + JetBrains Mono, NORA Green (#0B6E4F) como acento
- Todos los elementos interactivos (botones, links, toggles, cards clickeables) usan `cursor-pointer` (AUT-156)

### Pages

| Ruta | Pantalla | Rol mínimo | Funcionalidad |
|------|----------|-----------|--------------|
| `/admin/login` | Login | Ninguno | Formulario email + contraseña → JWT en memoria |
| `/admin` | Dashboard | OPERATOR | 4 métricas + rendimiento + profesionales por estado + sección "Análisis" con 3 gráficos Recharts (línea con selector 7d/15d/30d, pedidos por estado, profesionales por estado); H1 unificado con `text-4xl font-black tracking-tighter` (AUT-207, AUT-209) |
| `/admin/professionals` | Lista Profesionales | OPERATOR | Tabla desktop + cards mobile (<lg) con estado, zona, teléfono, DNI, registro y CTA de detalle; paginación compartida (AUT-207) |
| `/admin/professionals/:id` | Detalle Profesional | OPERATOR | Info, docs R2, historial, acciones SUPERADMIN |
| `/admin/users` | Usuarios | OPERATOR | Tabla desktop + cards mobile (<lg) con badge de bloqueo y acción bloquear/desbloquear; footer métricas + paginación (AUT-207) |
| `/admin/orders` | Pedidos | OPERATOR | Tabla desktop con timeline + cards mobile (<lg) con ID, estado, categoría, usuario, zona y fecha (AUT-207) |
| `/admin/escalations` | Escaladas | OPERATOR | Summary críticas + tabla desktop; cards mobile (<lg) con acciones por estado (revisar/resolver) y paginación (AUT-207) |
| `/admin/zones` | Zonas | OPERATOR | Árbol con acordeón, toggles, agregar/editar nodos |
| `/admin/categories` | Categorías | OPERATOR | Tabla desktop + cards mobile (<lg) con nombre, slug, badge activa/inactiva y toggle inline; modal crear/editar (AUT-207) |
| `/admin/plans` | Planes | OPERATOR | Cards con precio, descuento, beneficios y badges activo/inactivo. SUPERADMIN: modal crear/editar (nombre, precio, descuento, features, toggle activo) + botón desactivar con confirmación — AUT-340 |
| `/admin/settings` | Configuración | SUPERADMIN | Parámetros matching, límites, integraciones, toggles |

**Consistencia tipográfica (AUT-207):** todos los H1 del panel admin (excepto Login) usan `text-4xl font-black text-gray-900 tracking-tighter`.

### Auth Flow
1. Login → `POST /auth/login` → cookie `admin_token` httpOnly (persistente)
2. Cada request del admin usa `credentials: 'include'` para enviar la cookie automáticamente
3. Logout → `POST /auth/logout` limpia la cookie en backend → redirect a `/admin/login`
4. `ProtectedRoute` verifica autenticación y opcionalmente rol requerido
5. OPERATOR no ve Configuración; botones SUPERADMIN ocultos para OPERATOR
6. Todas las acciones destructivas (aprobar, rechazar, suspender, reactivar, bloquear, desbloquear, cambiar estado de escalada, resolver) tienen un `ConfirmDialog` que muestra el nombre del afectado antes de ejecutar el request

- **Activación de membresía vía MercadoPago (AUT-188):**
  - Cuando el matching no encuentra profesionales disponibles (todos con trial agotado), el bot pregunta al usuario si quiere esperar hasta 24hs
  - Si el usuario acepta, el pedido queda en `NO_RESPONSE` con `waitingUserConsent = true` y `waitingActivationSince = now()`
  - NORA notifica a cada profesional con trial agotado en la misma categoría y zona con links de pago de MercadoPago por plan
  - El link de pago incluye `external_reference = professionalId:planId` para identificación en el webhook
  - Webhook `POST /webhooks/mercadopago` valida firma HMAC-SHA256, responde 200 inmediatamente y procesa asíncrono
  - Al confirmar pago (`status = approved`), se activa membresía mensual con `activatedBy = 'mercadopago'`
  - Si existe un pedido en espera coincidente en categoría y zona, se reactiva para el profesional que pagó
  - Múltiples pagos para el mismo pedido: solo el primero recibe el pedido, los demás quedan con membresía activa
  - Cron `checkWaitingActivations()` corre cada 30 minutos y cierra pedidos con más de 24hs en espera
  - Si `MERCADOPAGO_ACCESS_TOKEN` no está configurado, el servidor arranca pero falla al generar links de pago
  - Los precios y nombres de planes siempre se leen desde DB, nunca hardcodeados

### AUT-283 — Debounce de fotos en webhook de WhatsApp

Cuando un usuario envía múltiples fotos en el paso `ASK_PHOTOS`, Meta las entrega como webhooks separados casi simultáneos. Para evitar que NORA responda múltiples veces (una por cada foto), se implementa un mecanismo de acumulación con debounce en `webhooks.routes.ts`.

**Mecanismo de debounce:**
- `PhotoAccumulator`: interfaz que almacena `phone`, `role`, `imageUrls`, `timer` y `originalParsed`
- `photoAccumulators`: `Map<string, PhotoAccumulator>` en memoria (clave: `phone:role`)
- `PHOTO_DEBOUNCE_MS = 3000`: tiempo de espera antes de procesar fotos acumuladas

**Funciones agregadas:**
- `sendResponse(adapter, phone, role, result)`: envía la respuesta del bot (texto, media, audio)
- `handlePendingNotification(adapter, pendingNotification)`: procesa y limpia notificaciones pendientes
- `processWithAccumulatedPhotos(accumulator)`: procesa todas las fotos acumuladas en un solo `processMessage` y despacha la respuesta

**Comportamiento:**
- El debounce solo aplica cuando `currentStep === 'ASK_PHOTOS'` — en cualquier otro step, las imágenes se procesan inmediatamente
- Si el usuario envía 1 sola foto, espera 3 segundos antes de responder (aceptable)
- Si el servidor se reinicia durante el debounce, las fotos acumuladas se pierden (aceptable para este caso de uso)
- El comportamiento en el simulador no se ve afectado (el debounce solo aplica cuando `isConfigured()` es true)

**No modifica** `bot.service.ts`, `user-request.flow.ts` ni ningún otro archivo.

### MCP Admin Server (AUT-362)

Servidor MCP (Model Context Protocol) para gestionar NORA Conecta desde Claude u OpenCode sin acceder al admin web.

**Arquitectura:**

```
mcp/
  src/
    index.ts        ← McpServer bootstrap, registra 8 tool modules
    auth.ts         ← Login con email/password, extrae JWT de cookie Set-Cookie, renovación automática 30min antes de vencer
    nora-client.ts  ← Wrapper HTTP con autenticación Bearer (noraGet, noraPost, noraPatch, noraDelete)
    tools/
      professionals.ts  ← 12 tools: list, get, approve, reject, suspend, reactivate, assign/cancel membership, badge, license status, data changes, panel session
      requests.ts       ← 2 tools: list, get
      metrics.ts        ← 5 tools: get_metrics, get_config, update_config, get_membership_discount, set_membership_discount
      locations.ts      ← 5 tools: list_countries, get_location_tree, create_geo_node, update_geo_node, toggle_geo_node
      categories.ts     ← 4 tools: list, create, update, toggle
      plans.ts          ← 4 tools: list, create, update, deactivate
      users.ts          ← 4 tools: list, get, block, unblock
      escalations.ts    ← 4 tools: list, get, change_status, resolve
```

**Autenticación:**
- Login contra `POST /auth/login` con email/password
- El endpoint devuelve JWT vía cookie httpOnly `Set-Cookie: admin_token=<jwt>`
- El MCP extrae el JWT del header `Set-Cookie` y lo usa en `Authorization: Bearer <jwt>`
- El JWT dura 24h — se renueva automáticamente 30 minutos antes de vencer

**Tools disponibles (40 tools):**

| Módulo         | Tools                         |
|---------------|-------------------------------|
| Professionals | list, get, approve, reject, suspend, reactivate, assign_membership, cancel_membership, set_badge, update_license_status, get_pending_data_changes, mark_data_change_reviewed, generate_panel_session |
| Requests      | list, get                     |
| Metrics       | get_metrics, get_config, update_config, get_membership_discount, set_membership_discount |
| Locations     | list_countries, get_location_tree, create_geo_node, update_geo_node, toggle_geo_node |
| Categories    | list, create, update, toggle  |
| Plans         | list, create, update, deactivate |
| Users         | list, get, block, unblock     |
| Escalations   | list, get, change_status, resolve |

**Variables de entorno MCP:**

| Variable            | Default                        | Descripción                          |
|--------------------|--------------------------------|--------------------------------------|
| `NORA_API_URL`     | `https://api.noraconecta.com`  | URL base de la API de NORA           |
| `NORA_ADMIN_EMAIL` | `admin@noraconecta.com`        | Email del admin para autenticación   |
| `NORA_ADMIN_PASSWORD` | —                           | Password del admin                   |

**Setup:**
```bash
cd mcp
cp .env.example .env
npm install
npm run build  # tsc → dist/
node dist/index.js  # arranca en stdio
```

**Constraints:**
- No modifica backend ni frontend
- El MCP vive exclusivamente en `mcp/` en la raíz del monorepo
- Usa ESM (`"type": "module"`)
- El JWT dura 24h — renovar automáticamente 30 minutos antes de vencer

## Scripts

| Comando              | Descripción                          |
|---------------------|--------------------------------------|
| `npm run dev:backend`  | Inicia servidor backend en modo desarrollo   |
| `npm run dev:frontend` | Inicia servidor frontend (Vite dev server)   |
| `npm run build:backend`| Compila TypeScript del backend a `dist/`     |
| `npm run build:frontend`| Compila y empaqueta frontend con Vite        |
| `npm run build:landing` | Build solo de landing (`BUILD_TARGET=landing`) |
| `npm run build:admin`   | Build solo de admin (`BUILD_TARGET=admin`)    |
| `npm run build:app`     | Build solo de app (`BUILD_TARGET=app`)        |
| `npm run build:all`     | Build secuencial de los tres targets          |
| `npm run lint`      | Ejecuta ESLint                       |
| `npm run format`    | Formatea código con Prettier         |
| `npm run prisma:generate` | Genera Prisma Client           |
| `npm run prisma:migrate`  | Ejecuta migraciones de Prisma  |
| `npm run prisma:seed`     | Ejecuta seed (superadmin + Argentina)  |
