const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const torresRoutes = require('./routes/torres.routes');
const departamentosRoutes = require('./routes/departamentos.routes');
const personasRoutes = require('./routes/personas.routes');
const reservasRoutes = require('./routes/reservas.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

const corsOrigin = process.env.CORS_ORIGIN || '*';
const authRateWindowMs = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const authRateMax = Number(process.env.AUTH_RATE_LIMIT_MAX) || 20;

const authLimiter = rateLimit({
  windowMs: authRateWindowMs,
  max: authRateMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiados intentos de autenticacion, intenta mas tarde' },
});

app.use(helmet());
app.use(cors({ origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((item) => item.trim()) }));
app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => {
  res.json({ message: 'API del conjunto habitacional funcionando' });
});

app.use('/auth', authLimiter, authRoutes);
app.use('/torres', torresRoutes);
app.use('/departamentos', departamentosRoutes);
app.use('/personas', personasRoutes);
app.use('/reservas', reservasRoutes);
app.use('/usuarios', usuariosRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

app.use(errorHandler);

module.exports = app;
