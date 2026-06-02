const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { csrfProtection } = require('../middleware/csrf');
const { redirectIfAuth } = require('../middleware/auth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  // Rendu d'une page stylée au lieu du message brut
  handler: (req, res) => {
    res.status(429).render('auth/rate-limit', {
      title: 'Trop de tentatives',
      minutes: 15,
    });
  },
});

// ===== INSCRIPTION =====
router.get('/register', redirectIfAuth, (req, res) => {
  res.render('auth/register', { title: 'Inscription', old: {}, fieldErrors: {} });
});

router.post(
  '/register',
  csrfProtection,
  [
    body('nom').trim().notEmpty().withMessage('Le nom est requis.'),
    body('prenom').trim().notEmpty().withMessage('Le prénom est requis.'),
    body('email').trim().isEmail().withMessage('Email invalide.'),
    body('telephone').matches(/^[0-9]{10}$/).withMessage('Le téléphone doit contenir 10 chiffres.'),
    body('password')
      .isLength({ min: 8 }).withMessage('Mot de passe : 8 caractères minimum.')
      .matches(/[A-Z]/).withMessage('Le mot de passe doit contenir une majuscule.')
      .matches(/[0-9]/).withMessage('Le mot de passe doit contenir un chiffre.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    const { nom, prenom, email, telephone, adresse, date_naissance, password } = req.body;

    // Transforme le tableau d'erreurs en objet { champ: message }
    function mapErrors(result) {
      const obj = {};
      result.array().forEach((e) => {
        if (!obj[e.path]) obj[e.path] = e.msg; // garde la 1re erreur de chaque champ
      });
      return obj;
    }

    if (!errors.isEmpty()) {
      return res.render('auth/register', {
        title: 'Inscription',
        old: req.body,
        fieldErrors: mapErrors(errors),
      });
    }

    try {
      const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
      if (existing.length > 0) {
        return res.render('auth/register', {
          title: 'Inscription',
          old: req.body,
          fieldErrors: { email: 'Cet email est déjà utilisé.' },
        });
      }

      const hash = await bcrypt.hash(password, 10);
      await db.execute(
        `INSERT INTO users (nom, prenom, email, telephone, adresse, date_naissance, password, is_admin)
         VALUES (?, ?, ?, ?, ?, ?, ?, FALSE)`,
        [nom, prenom, email, telephone, adresse || null, date_naissance || null, hash]
      );

      req.flash('success', 'Compte créé avec succès. Vous pouvez vous connecter.');
      res.redirect('/login');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Une erreur est survenue.');
      res.render('auth/register', { title: 'Inscription', old: req.body, fieldErrors: {} });
    }
  }
);

// ===== CONNEXION CLIENT =====
router.get('/login', redirectIfAuth, (req, res) => {
  res.render('auth/login', {
    title: 'Connexion',
    inactif: req.query.raison === 'inactivite',
  });
});

router.post('/login', loginLimiter, csrfProtection, async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ? AND is_actif = TRUE', [email]);
    if (rows.length === 0) {
      req.flash('error', 'Email ou mot de passe incorrect.');
      return res.redirect('/login');
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      req.flash('error', 'Email ou mot de passe incorrect.');
      return res.redirect('/login');
    }
    req.session.user = {
      id: user.id, nom: user.nom, prenom: user.prenom,
      email: user.email, is_admin: !!user.is_admin,
    };
    res.redirect(user.is_admin ? '/admin/dashboard' : '/dashboard');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Une erreur est survenue.');
    res.redirect('/login');
  }
});

// ===== CONNEXION ADMIN =====
router.get('/admin/login', redirectIfAuth, (req, res) => {
  res.render('auth/admin-login', { title: 'Connexion Admin' });
});

router.post('/admin/login', loginLimiter, csrfProtection, async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ? AND is_admin = TRUE', [email]);
    if (rows.length === 0) {
      req.flash('error', 'Identifiants administrateur incorrects.');
      return res.redirect('/admin/login');
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      req.flash('error', 'Identifiants administrateur incorrects.');
      return res.redirect('/admin/login');
    }
    req.session.user = {
      id: user.id, nom: user.nom, prenom: user.prenom,
      email: user.email, is_admin: true,
    };
    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Une erreur est survenue.');
    res.redirect('/admin/login');
  }
});

// ===== DÉCONNEXION =====
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});
// Déconnexion automatique pour inactivité (déclenchée par le minuteur côté client)
router.get('/logout-inactivite', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login?raison=inactivite');
  });
});

module.exports = router;