const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');
const env = dotenv.config();
dotenvExpand.expand(env);

const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const passport = require('passport');
require('./config/passport'); // Importer la configuration Passport
const configurerSwagger = require('./middleware/swagger');
const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');

// Initialisation de l'application Express
const app = express();

// Middleware de sécurité
app.use(helmet());

// Middleware de base
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Configuration CORS avec support des cookies
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));

// Initialisation de Passport
app.use(passport.initialize());

// Configuration Swagger
configurerSwagger(app);

// Routes
app.use('/', indexRouter);
app.use('/api/v1/auth', authRouter);

// Gestion des erreurs globale
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Erreur interne du serveur',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

module.exports = app;
