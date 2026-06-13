import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import authRoutes from './routes/auth.route.js';
import keywordRoutes from './routes/rankTrack.route.js';
import analysisRouter from './routes/analysis.route.js';
import { authenticateJWT } from './middlewares/auth.middleware.js';

const app = express();

// 1. SECURITY HEADERS (Must run first to protect all subsequent processes)
app.use(helmet());

// 2. CORS CONFIGURATION (Blocks unallowed origins early)
app.use(cors({
  origin: process.env.FRONTEND_DOMAIN, // Replace with your exact domain
  optionsSuccessStatus: 200,
  credentials: true,
}));

// 3. RATE LIMITING (Prevents DoS attacks before consuming server parsing resources)
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use(limiter);

// 4. REQUEST LOGGING (Logs incoming requests after security checks)
app.use(morgan('dev'));

// 5. STATIC FILES (Serves assets immediately without hitting body parsers)
app.use(express.static('public'));

// 6. BODY PARSERS (Populates req.body for downstream routes)
app.use(express.json({
  limit: '16kb'
}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'SEO Rank Tracker server is running' });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/rankkeyword', authenticateJWT, keywordRoutes);
app.use('/api/v1/analysis', authenticateJWT, analysisRouter);

// 404 Handlerx
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err : {},
  });
});

export default app;