require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const helmet = require('helmet');
const expressLayouts = require('express-ejs-layouts');

const { generateToken } = require('./middleware/csrf');
const format = require('./utils/format');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true, // réinitialise le délai à chaque requête (inactivité, pas durée totale)
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 5 }, // 5 minutes
  })
);

app.use(flash());

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.csrfToken = generateToken(req);
  res.locals.fmt = format;
  next();
});

app.get('/', (req, res) => {
  res.render('index', { title: 'Accueil - Our Bank' });
});

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/client'));
app.use('/admin', require('./routes/admin'));

app.use((req, res) => {
  res.status(404).render('index', { title: 'Page introuvable' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Our Bank lancé sur http://localhost:${PORT}`);
});