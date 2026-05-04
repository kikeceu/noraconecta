import 'dotenv/config';

import express from 'express';
import cors from 'cors';
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
import { RequestsService } from './modules/requests/requests.service';
import { RequestsRepository } from './modules/requests/requests.repository';
import { UsersRepository } from './modules/users/users.repository';

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

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

app.use(errorHandler);

// Cron job: auto-close PENDING_CONFIRMATION requests older than 24h (runs every hour)
const requestsRepository = new RequestsRepository();
const usersRepository = new UsersRepository();
const requestsService = new RequestsService(requestsRepository, usersRepository);

cron.schedule('0 * * * *', () => {
  void requestsService.autoClosePendingConfirmations();
});

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on port ${PORT}`);
});

export default app;
