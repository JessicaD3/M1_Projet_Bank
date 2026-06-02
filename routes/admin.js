const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');

// Tout l'espace admin nécessite le rôle admin
router.use(requireAdmin);

// ===================== DASHBOARD + STATISTIQUES =====================
router.get('/dashboard', async (req, res) => {
  try {
    const [[{ nbClients }]] = await db.execute(
      'SELECT COUNT(*) AS nbClients FROM users WHERE is_admin = FALSE AND is_actif = TRUE'
    );
    const [[{ nbComptes }]] = await db.execute(
      `SELECT COUNT(*) AS nbComptes FROM comptes_bancaires c
       JOIN users u ON c.user_id = u.id WHERE u.is_actif = TRUE`
    );
    const [[{ totalDepots }]] = await db.execute(
      `SELECT COALESCE(SUM(t.montant),0) AS totalDepots FROM transactions t
       JOIN comptes_bancaires c ON t.compte_source_id = c.id
       JOIN users u ON c.user_id = u.id
       WHERE t.type_transaction = 'depot' AND u.is_actif = TRUE`
    );

    const [comptesParType] = await db.execute(
      `SELECT c.type_compte, COUNT(*) AS nb FROM comptes_bancaires c
       JOIN users u ON c.user_id = u.id WHERE u.is_actif = TRUE
       GROUP BY c.type_compte`
    );
    const [txParType] = await db.execute(
      `SELECT t.type_transaction, COUNT(*) AS nb FROM transactions t
       JOIN comptes_bancaires c ON t.compte_source_id = c.id
       JOIN users u ON c.user_id = u.id WHERE u.is_actif = TRUE
       GROUP BY t.type_transaction`
    );

    res.render('admin/dashboard', {
      title: 'Tableau de bord admin',
      stats: { nbClients, nbComptes, totalDepots },
      comptesParType,
      txParType,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Erreur lors du chargement des statistiques.');
    res.redirect('/');
  }
});

// ===================== LISTE + RECHERCHE CLIENTS =====================
router.get('/clients', async (req, res) => {
  const q = (req.query.q || '').trim();
  const voirInactifs = req.query.inactifs === '1';
  try {
    let clients;
    if (q) {
      // Ici la table users a l'alias "u" -> on préfixe par u.
      const filtreActif = voirInactifs ? '' : 'AND u.is_actif = TRUE';
      const like = `%${q}%`;
      [clients] = await db.execute(
        `SELECT DISTINCT u.id, u.nom, u.prenom, u.email, u.telephone, u.is_actif
         FROM users u
         LEFT JOIN comptes_bancaires c ON c.user_id = u.id
         WHERE u.is_admin = FALSE ${filtreActif}
           AND (u.nom LIKE ? OR u.prenom LIKE ? OR u.email LIKE ? OR c.numero_compte LIKE ?)
         ORDER BY u.nom`,
        [like, like, like, like]
      );
    } else {
      // Ici pas d'alias -> on n'écrit pas u.
      const filtreActif = voirInactifs ? '' : 'AND is_actif = TRUE';
      [clients] = await db.execute(
        `SELECT id, nom, prenom, email, telephone, is_actif
         FROM users WHERE is_admin = FALSE ${filtreActif} ORDER BY nom`
      );
    }
    res.render('admin/clients', { title: 'Gestion des clients', clients, q, voirInactifs });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Erreur lors du chargement des clients.');
    res.redirect('/admin/dashboard');
  }
});

// ===================== DÉTAIL D'UN CLIENT + SES COMPTES =====================
router.get('/clients/:id', async (req, res) => {
  try {
    const [users] = await db.execute(
      'SELECT id, nom, prenom, email, telephone, adresse, date_naissance, is_actif FROM users WHERE id = ? AND is_admin = FALSE',
      [req.params.id]
    );
    if (users.length === 0) {
      req.flash('error', 'Client introuvable.');
      return res.redirect('/admin/clients');
    }
    const [comptes] = await db.execute(
      'SELECT * FROM comptes_bancaires WHERE user_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );
    res.render('admin/client-detail', { title: 'Détail client', client: users[0], comptes });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Erreur.');
    res.redirect('/admin/clients');
  }
});

// ===================== MODIFIER UN CLIENT =====================
router.post(
  '/clients/:id',
  csrfProtection,
  [
    body('nom').trim().notEmpty().withMessage('Le nom est requis.'),
    body('prenom').trim().notEmpty().withMessage('Le prénom est requis.'),
    body('email').trim().isEmail().withMessage('Email invalide.'),
    body('telephone').matches(/^[0-9]{10}$/).withMessage('Le téléphone doit contenir 10 chiffres.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    const retour = `/admin/clients/${req.params.id}`;
    if (!errors.isEmpty()) {
      errors.array().forEach((e) => req.flash('error', e.msg));
      return res.redirect(retour);
    }
    const { nom, prenom, email, telephone, adresse, date_naissance } = req.body;
    try {
      const [dup] = await db.execute('SELECT id FROM users WHERE email = ? AND id <> ?', [
        email,
        req.params.id,
      ]);
      if (dup.length > 0) {
        req.flash('error', 'Cet email est déjà utilisé par un autre compte.');
        return res.redirect(retour);
      }
      await db.execute(
        'UPDATE users SET nom=?, prenom=?, email=?, telephone=?, adresse=?, date_naissance=? WHERE id=? AND is_admin=FALSE',
        [nom, prenom, email, telephone, adresse || null, date_naissance || null, req.params.id]
      );
      req.flash('success', 'Client mis à jour.');
      res.redirect(retour);
    } catch (err) {
      console.error(err);
      req.flash('error', 'Erreur lors de la mise à jour.');
      res.redirect(retour);
    }
  }
);

// ===================== DÉSACTIVER / RÉACTIVER UN CLIENT (soft delete) =====================
router.post('/clients/:id/activation', csrfProtection, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT is_actif FROM users WHERE id = ? AND is_admin = FALSE',
      [req.params.id]
    );
    if (rows.length === 0) {
      req.flash('error', 'Client introuvable.');
      return res.redirect('/admin/clients');
    }
    const nouvelEtat = rows[0].is_actif ? 0 : 1;
    await db.execute('UPDATE users SET is_actif = ? WHERE id = ?', [nouvelEtat, req.params.id]);
    req.flash('success', nouvelEtat ? 'Client réactivé.' : 'Client désactivé (données masquées).');
    res.redirect('/admin/clients' + (nouvelEtat ? '' : '?inactifs=1'));
  } catch (err) {
    console.error(err);
    req.flash('error', 'Erreur lors du changement de statut.');
    res.redirect('/admin/clients');
  }
});

// ===================== SUPPRIMER DÉFINITIVEMENT UN CLIENT =====================
router.post('/clients/:id/supprimer', csrfProtection, async (req, res) => {
  try {
    // ON DELETE CASCADE supprime aussi ses comptes ; les transactions passent à NULL (SET NULL)
    await db.execute('DELETE FROM users WHERE id = ? AND is_admin = FALSE', [req.params.id]);
    req.flash('success', 'Client supprimé définitivement.');
    res.redirect('/admin/clients');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Erreur lors de la suppression.');
    res.redirect('/admin/clients');
  }
});

// ===================== LISTE DE TOUS LES COMPTES =====================
router.get('/comptes', async (req, res) => {
  try {
    const [comptes] = await db.execute(
      `SELECT c.*, u.nom, u.prenom, u.email
       FROM comptes_bancaires c
       JOIN users u ON c.user_id = u.id
       WHERE u.is_actif = TRUE
       ORDER BY c.created_at DESC`
    );
    res.render('admin/comptes', { title: 'Tous les comptes', comptes });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Erreur lors du chargement des comptes.');
    res.redirect('/admin/dashboard');
  }
});

// ===================== BLOQUER / DÉBLOQUER UN COMPTE =====================
router.post('/comptes/:id/statut', csrfProtection, async (req, res) => {
  const retour = req.body.retour || '/admin/comptes';
  try {
    const [rows] = await db.execute('SELECT statut FROM comptes_bancaires WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      req.flash('error', 'Compte introuvable.');
      return res.redirect(retour);
    }
    const nouveau = rows[0].statut === 'actif' ? 'bloque' : 'actif';
    await db.execute('UPDATE comptes_bancaires SET statut = ? WHERE id = ?', [nouveau, req.params.id]);
    req.flash('success', `Compte ${nouveau === 'bloque' ? 'bloqué' : 'débloqué'}.`);
    res.redirect(retour);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Erreur.');
    res.redirect(retour);
  }
});

// ===================== HISTORIQUE D'UN COMPTE =====================
router.get('/comptes/:id/historique', async (req, res) => {
  try {
    const [comptes] = await db.execute(
      `SELECT c.*, u.nom, u.prenom FROM comptes_bancaires c
       JOIN users u ON c.user_id = u.id WHERE c.id = ?`,
      [req.params.id]
    );
    if (comptes.length === 0) {
      req.flash('error', 'Compte introuvable.');
      return res.redirect('/admin/comptes');
    }
    const [transactions] = await db.execute(
      `SELECT t.*, cs.numero_compte AS source_iban, cd.numero_compte AS dest_iban
       FROM transactions t
       LEFT JOIN comptes_bancaires cs ON t.compte_source_id = cs.id
       LEFT JOIN comptes_bancaires cd ON t.compte_destinataire_id = cd.id
       WHERE t.compte_source_id = ? OR t.compte_destinataire_id = ?
       ORDER BY t.date_transaction DESC`,
      [req.params.id, req.params.id]
    );
    res.render('admin/compte-historique', {
      title: 'Historique du compte',
      compte: comptes[0],
      transactions,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Erreur.');
    res.redirect('/admin/comptes');
  }
});

module.exports = router;