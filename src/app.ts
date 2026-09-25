import express from 'express';
import cors from 'cors';
import pc from 'picocolors';
import { ENV } from './config/env';
import { testDatabaseConnection } from './config/database';
import apiRouter from './routes';
import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/logger.middleware';
import { decryptRequestMiddleware, decryptParamHandler } from './middleware/crypto.middleware';
import { optionalAuthMiddleware } from './middleware/auth.middleware';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global optional authentication (populates req.user if Bearer token present)
app.use(optionalAuthMiddleware);

// Auto-decrypt encrypted IDs in request bodies and queries
app.use(decryptRequestMiddleware);

// Auto-decrypt route parameter IDs (:id, etc.)
app.param('id', decryptParamHandler);
app.param('userId', decryptParamHandler);
app.param('orderId', decryptParamHandler);
app.param('menuId', decryptParamHandler);
app.param('roleId', decryptParamHandler);

// Request & Response Terminal Logger
app.use(requestLogger);

// API Version 1 Routes
app.use('/api/v1', apiRouter);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Almas Laundry Backend API (Express TypeScript)',
    docs: '/api/v1/health',
    version: '1.0.0',
  });
});

// Global Error Handler
app.use(errorHandler);

// Start Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(ENV.PORT, async () => {
    console.log(pc.cyan('┌─────────────────────────────────────────────────────────┐'));
    console.log(pc.cyan('│') + ' ' + pc.bold(pc.green('● [SERVER]')) + ' ' + pc.bold('Laundry App Backend is RUNNING').padEnd(43) + pc.cyan('│'));
    console.log(pc.cyan('│') + ' ' + pc.blue('➜ [URL]   ') + ` http://localhost:${ENV.PORT}`.padEnd(44) + pc.cyan('│'));
    console.log(pc.cyan('│') + ' ' + pc.cyan('➜ [API]   ') + ` http://localhost:${ENV.PORT}/api/v1`.padEnd(44) + pc.cyan('│'));
    console.log(pc.cyan('│') + ' ' + pc.magenta('➜ [DB]    ') + ` ${ENV.DB_HOST}:${ENV.DB_PORT} (${ENV.DB_DATABASE})`.padEnd(44) + pc.cyan('│'));
    console.log(pc.cyan('│') + ' ' + pc.gray('ℹ [LOG]   ') + ' Real-time HTTP & SQL logger active'.padEnd(44) + pc.cyan('│'));
    console.log(pc.cyan('└─────────────────────────────────────────────────────────┘'));

    // Test DB connection
    await testDatabaseConnection();
  });
}

export default app;
