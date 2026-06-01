import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
// import rateLimit from 'express-rate-limit';
import morgan from 'morgan';

const app = express();

// 1. SECURITY HEADERS (Must run first to protect all subsequent processes)
app.use(helmet());

// 2. CORS CONFIGURATION (Blocks unallowed origins early)
app.use(cors({ origin: 'https://yourfrontend.com' }));

// 3. RATE LIMITING (Prevents DoS attacks before consuming server parsing resources)
// const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
// app.use(limiter);

// 4. REQUEST LOGGING (Logs incoming requests after security checks)
app.use(morgan('dev'));

// 5. STATIC FILES (Serves assets immediately without hitting body parsers)
app.use(express.static('public'));

// 6. BODY PARSERS (Populates req.body for downstream routes)
app.use(express.json({
    limit:'16kb'
}));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'SEO Rank Tracker server is running' });
});

export default app;