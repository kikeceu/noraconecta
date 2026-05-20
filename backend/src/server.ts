import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import cron from 'node-cron';
import { errorHandler } from './middleware/error-handler';
import authRoutes from './modules/auth/auth.routes';
import categoriesRoutes from './modules/categories/categories.routes';
import locationsRoutes from './modules/locations/locations.routes';
import usersRoutes from './modules/users/users.routes';
import professionalsRoutes from './modules/professionals/professionals.routes';
import plansRoutes from './modules/plans/plans.routes';
import membershipsRoutes from './modules/memberships/memberships.routes';
import configRoutes from './modules/config/config.routes';
import requestsRoutes from './modules/requests/requests.routes';
import escalationsRoutes from './modules/escalations/escalations.routes';
import adminRoutes from './modules/admin/admin.routes';
import storageRoutes from './modules/storage/storage.routes';
import botRoutes from './modules/bot/bot.routes';
import webhooksRoutes from './routes/webhooks.routes';
import paymentsRoutes from './modules/payments/payments.routes';
import { RequestsService } from './modules/requests/requests.service';
import { RequestsRepository } from './modules/requests/requests.repository';
import { MatchingRepository } from './modules/matching/matching.repository';
import { UsersRepository } from './modules/users/users.repository';
import { CoordinationService } from './modules/bot/coordination.service';
import { BotRepository } from './modules/bot/bot.repository';
import { NotificationService } from './modules/notifications/notification.service';
import { WhatsAppAdapter } from './lib/whatsapp-adapter';
import { R2Client } from './lib/r2-client';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(morgan('dev'));
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as unknown as { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);

const whatsappToken = process.env.WHATSAPP_API_TOKEN;
const phoneIdUser = process.env.WHATSAPP_PHONE_NUMBER_ID_USER;
const phoneIdProfessional = process.env.WHATSAPP_PHONE_NUMBER_ID_PROFESSIONAL;

if (!whatsappToken || !phoneIdUser || !phoneIdProfessional) {
  // eslint-disable-next-line no-console
  console.warn(
    '[server] WhatsApp API not fully configured. Webhook endpoint will respond 503. Simulator remains operational.',
  );
}

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/auth', authRoutes);
app.use('/categories', categoriesRoutes);
app.use('/locations', locationsRoutes);
app.use('/users', usersRoutes);
app.use('/professionals', professionalsRoutes);
app.use('/plans', plansRoutes);
app.use('/professionals', membershipsRoutes);
app.use('/config', configRoutes);
app.use('/requests', requestsRoutes);
app.use('/escalations', escalationsRoutes);
app.use('/admin', adminRoutes);
app.use('/storage', storageRoutes);
app.use('/bot', botRoutes);
app.use('/webhooks', webhooksRoutes);
app.use('/webhooks', paymentsRoutes);

app.use(errorHandler);

// Cron job: process timeouts (expired ASSIGNED and CREATED requests)
// Runs every 15 minutes
const requestsRepository = new RequestsRepository();
const usersRepository = new UsersRepository();
const matchingRepository = new MatchingRepository();
const botRepository = new BotRepository();
const r2Client = new R2Client();
const whatsappAdapter = new WhatsAppAdapter(r2Client, botRepository);
const notificationService = new NotificationService(whatsappAdapter, botRepository);
const coordinationService = new CoordinationService(botRepository, whatsappAdapter);
const requestsService = new RequestsService(
  requestsRepository,
  usersRepository,
  matchingRepository,
  botRepository,
  undefined,
  undefined,
  notificationService,
  coordinationService,
);

cron.schedule('*/15 * * * *', () => {
  void requestsService.processTimeouts();
});

// Cron job: auto-close PENDING_CONFIRMATION requests older than 24h (runs every hour)
cron.schedule('0 * * * *', () => {
  void requestsService.autoClosePendingConfirmations();
});

// Cron job: send visit reminders 24h before scheduledAt (runs every hour)
cron.schedule('0 * * * *', () => {
  void coordinationService.sendReminders();
});

// Cron job: check waiting activations expiry (24h timeout, runs every 30 minutes)
cron.schedule('*/30 * * * *', () => {
  void requestsService.checkWaitingActivations();
});

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on port ${PORT}`);
});

export default app;
