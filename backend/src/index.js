require('dotenv').config();
const { InitDB, InitDummyData, pool } = require('./config/db');
const redisClient = require('./config/redis');
const rateLimiter = require('./middleware/rateLimiter');
const readline = require('node:readline/promises');
const { stdin: input, stdout: output } = require('node:process');
const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');
const marksRouter = require('./routes/marksRouter');
const examRouter = require('./routes/examRouter');
const attendanceRouter = require('./routes/attendanceRouter');
const authRouter = require('./routes/authRouter');
const adminRouter = require('./routes/adminRouter');
const attainmentRouter = require('./routes/attainmentRouter');
const subjectRouter = require('./routes/subjectRouter');
const lectureRouter = require('./routes/lectureRouter');
const nbaGeneratorRouter = require('./routes/nbaGeneratorRouter');
const hodAssignmentRoutes = require('./routes/hodAssignmentRoutes');
const facultyRouter = require('./routes/facultyRouter');
const studentRouter = require('./routes/studentRouter');
const cors = require('cors');

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser clients and same-origin requests with no Origin header.
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) return callback(null, true);

    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev) {
      try {
        const url = new URL(origin);
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
          return callback(null, true);
        }
      } catch (error) {
        return callback(error);
      }
    }

    return callback(new Error('CORS: Origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Disposition'],
};

app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.use(rateLimiter);

app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Backend is running',
  });
});

app.use('/user', authRouter);
app.use('/attendance', attendanceRouter);
app.use('/marks', marksRouter);
app.use('/exam', examRouter);
app.use('/admin', adminRouter);
app.use('/attainment', attainmentRouter);
app.use('/subject', subjectRouter);
app.use('/lecture', lectureRouter);
app.use('/nba', nbaGeneratorRouter);
app.use('/hod-assignment', hodAssignmentRoutes);
app.use('/faculty', facultyRouter);
app.use('/student', studentRouter);

const PORT = process.env.PORT || 3000;

const initializeConnection = async () => {
  try{
    await pool.query('SELECT 1');

    redisClient.on?.('error', (error) => {
      console.warn('Redis connection error:', error.message);
    });

    redisClient.connect().catch((error) => {
      console.warn('Redis unavailable. Continuing without Redis-backed session revocation/rate limiting:', error.message);
    });

    InitDB().catch((error) => {
      console.error('Database schema initialization failed:', error);
    });

    console.log('Database connection verified.');

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    })
  }
  catch(err){
    console.log('CRITICAL: Database failed to initialize', err);
  }
}

initializeConnection();
