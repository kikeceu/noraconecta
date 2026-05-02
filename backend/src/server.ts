import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './middleware/error-handler';
import authRoutes from './modules/auth/auth.routes';
import categoriesRoutes from './modules/categories/categories.routes';
import locationsRoutes from './modules/locations/locations.routes';
import usersRoutes from './modules/users/users.routes';
import professionalsRoutes from './modules/professionals/professionals.routes';
import plansRoutes from './modules/plans/plans.routes';
import membershipsRoutes from './modules/memberships/memberships.routes';
import configRoutes from './modules/config/config.routes';

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

app.use(errorHandler);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on port ${PORT}`);
});

export default app;
