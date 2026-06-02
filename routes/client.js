const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const { genererIban } = require('../utils/iban');
const { genererReleve } = require('../utils/releve');

// Toutes les routes client nécessitent une connexion
router.use(requireAuth);

// ===================== DASHBOARD =====================
router.get('/dashboard', async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [comptes] = await db.execute(
      'SELECT * FROM comptes_bancaires WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    const soldeTotal = comptes.reduce((acc, c) => acc + parseFloat(c.solde), 0);
    res.render('client/dashboard', {
      title: 'Mon tableau de bord',
      comptes,
      soldeTotal,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Erreur lors du chargement du tableau de bord.');
    res.redirect('/');
  }
});

// ===================== PROFIL (consultation + modif) =====================
router.get('/profil', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, nom, prenom, email, telephone, adresse, date_naissance FROM users WHERE id = ?',
      [req.session.user.id]
    );
    res.render('client/profil', { title: 'Mon profil', profil: rows[0] });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Erreur lors du chargement du profil.');
    res.redirect('/dashboard');
  }
});

router.post(
  '/profil',
  csrfProtection,
  [
    body('nom').trim().notEmpty().withMessage('Le nom est requis.'),
    body('prenom').trim().notEmpty().withMessage('Le prénom est requis.'),
    body('email').trim().isEmail().withMessage('Email invalide.'),
    body('telephone').matches(/^[0-9]{10}$/).withMessage('Le téléphone doit contenir 10 chiffres.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach((e) => req.flash('error', e.msg));
      return res.redirect('/profil');
    }
    const { nom, prenom, email, telephone, adresse, date_naissance } = req.body;
    try {
      // Vérifie que l'email n'est pas pris par un AUTRE utilisateur
      const [dup] = await db.execute('SELECT id FROM users WHERE email = ? AND id <> ?', [
        email,
        req.session.user.id,
      ]);
      if (dup.length > 0) {
        req.flash('error', 'Cet email est déjà utilisé par un autre compte.');
        return res.redirect('/profil');
      }

      await db.execute(
        `UPDATE users SET nom = ?, prenom = ?, email = ?, telephone = ?, adresse = ?, date_naissance = ?
         WHERE id = ?`,
        [nom, prenom, email, telephone, adresse || null, date_naissance || null, req.session.user.id]
      );

      // Met à jour la session pour refléter les changements (nom affiché dans la navbar, etc.)
      req.session.user.nom = nom;
      req.session.user.prenom = prenom;
      req.session.user.email = email;

      req.flash('success', 'Profil mis à jour avec succès.');
      res.redirect('/profil');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Erreur lors de la mise à jour.');
      res.redirect('/profil');
    }
  }
);

// ===================== LISTE DES COMPTES =====================
router.get('/comptes', async (req, res) => {
  try {
    const [comptes] = await db.execute(
      'SELECT * FROM comptes_bancaires WHERE user_id = ? ORDER BY created_at DESC',
      [req.session.user.id]
    );
    res.render('client/comptes', { title: 'Mes comptes', comptes });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Erreur lors du chargement des comptes.');
    res.redirect('/dashboard');
  }
});

// ===================== DÉTAIL D'UN COMPTE =====================
router.get('/comptes/:id', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM comptes_bancaires WHERE id = ? AND user_id = ?',
      [req.params.id, req.session.user.id]
    );
    if (rows.length === 0) {
      req.flash('error', "Compte introuvable ou non autorisé.");
      return res.redirect('/comptes');
    }
    res.render('client/compte-detail', { title: 'Détail du compte', compte: rows[0] });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Erreur.');
    res.redirect('/comptes');
  }
});

// ===================== RELEVÉ PDF D'UN COMPTE =====================
router.get('/comptes/:id/releve', async (req, res) => {
  try {
    const userId = req.session.user.id;
    // Le compte doit appartenir à l'utilisateur connecté
    const [comptes] = await db.execute(
      'SELECT * FROM comptes_bancaires WHERE id = ? AND user_id = ?',
      [req.params.id, userId]
    );
    if (comptes.length === 0) {
      req.flash('error', 'Compte introuvable.');
      return res.redirect('/comptes');
    }
    const compte = comptes[0];

    // Transactions du compte (mêmes règles que l'historique)
    const [transactions] = await db.execute(
      `SELECT t.*, cs.numero_compte AS source_iban, cd.numero_compte AS dest_iban
       FROM transactions t
       LEFT JOIN comptes_bancaires cs ON t.compte_source_id = cs.id
       LEFT JOIN comptes_bancaires cd ON t.compte_destinataire_id = cd.id
       WHERE
         (t.type_transaction IN ('depot','retrait','virement_emis') AND t.compte_source_id = ?)
         OR
         (t.type_transaction = 'virement_recu' AND t.compte_destinataire_id = ?)
       ORDER BY t.date_transaction DESC`,
      [req.params.id, req.params.id]
    );

    genererReleve(res, {
      compte,
      titulaire: req.session.user,
      transactions,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Erreur lors de la génération du relevé.');
    res.redirect('/comptes/' + req.params.id);
  }
});

// ===================== CRÉER UN COMPTE =====================
router.post('/comptes', csrfProtection, async (req, res) => {
  const { type_compte } = req.body;
  const typesValides = ['courant', 'livret_a', 'pel'];
  if (!typesValides.includes(type_compte)) {
    req.flash('error', 'Type de compte invalide.');
    return res.redirect('/comptes');
  }
  try {
    // Génère un IBAN unique (réessaie en cas de collision, très improbable)
    let numero;
    let unique = false;
    for (let i = 0; i < 5 && !unique; i++) {
      numero = genererIban();
      const [dup] = await db.execute(
        'SELECT id FROM comptes_bancaires WHERE numero_compte = ?',
        [numero]
      );
      if (dup.length === 0) unique = true;
    }

    await db.execute(
      'INSERT INTO comptes_bancaires (user_id, numero_compte, type_compte, solde, statut) VALUES (?, ?, ?, 0.00, ?)',
      [req.session.user.id, numero, type_compte, 'actif']
    );
    req.flash('success', 'Nouveau compte créé avec succès.');
    res.redirect('/comptes');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Erreur lors de la création du compte.');
    res.redirect('/comptes');
  }
});

// ===================== SUPPRIMER UN COMPTE (si solde = 0) =====================
router.post('/comptes/:id/supprimer', csrfProtection, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM comptes_bancaires WHERE id = ? AND user_id = ?',
      [req.params.id, req.session.user.id]
    );
    if (rows.length === 0) {
      req.flash('error', 'Compte introuvable.');
      return res.redirect('/comptes');
    }
    if (parseFloat(rows[0].solde) !== 0) {
      req.flash('error', 'Impossible de supprimer un compte dont le solde n\'est pas nul.');
      return res.redirect('/comptes');
    }
    await db.execute('DELETE FROM comptes_bancaires WHERE id = ?', [req.params.id]);
    req.flash('success', 'Compte supprimé.');
    res.redirect('/comptes');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Erreur lors de la suppression.');
    res.redirect('/comptes');
  }
});

// ===================== HELPER : valider un montant =====================
function parseMontant(val) {
  const m = parseFloat(val);
  if (isNaN(m) || m <= 0) return null;
  // 2 décimales max
  if (!/^\d+(\.\d{1,2})?$/.test(String(val).trim())) return null;
  return Math.round(m * 100) / 100;
}

// ===================== DÉPÔT =====================
router.post('/comptes/:id/depot', csrfProtection, async (req, res) => {
  const montant = parseMontant(req.body.montant);
  const compteId = req.params.id;
  const retour = `/comptes/${compteId}`;

  if (montant === null || montant < 1) {
    req.flash('error', 'Montant invalide. Dépôt minimum : 1 €.');
    return res.redirect(retour);
  }

  try {
    const [rows] = await db.execute(
      'SELECT * FROM comptes_bancaires WHERE id = ? AND user_id = ?',
      [compteId, req.session.user.id]
    );
    if (rows.length === 0) {
      req.flash('error', 'Compte introuvable.');
      return res.redirect('/comptes');
    }
    if (rows[0].statut === 'bloque') {
      req.flash('error', 'Ce compte est bloqué, aucune opération possible.');
      return res.redirect(retour);
    }

    await db.execute('UPDATE comptes_bancaires SET solde = solde + ? WHERE id = ?', [montant, compteId]);
    await db.execute(
      'INSERT INTO transactions (compte_source_id, type_transaction, montant, libelle) VALUES (?, ?, ?, ?)',
      [compteId, 'depot', montant, req.body.libelle || 'Dépôt']
    );

    req.flash('success', `Dépôt de ${montant.toFixed(2)} € effectué.`);
    res.redirect(retour);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Erreur lors du dépôt.');
    res.redirect(retour);
  }
});

// ===================== RETRAIT =====================
router.post('/comptes/:id/retrait', csrfProtection, async (req, res) => {
  const montant = parseMontant(req.body.montant);
  const compteId = req.params.id;
  const retour = `/comptes/${compteId}`;

  if (montant === null || montant < 1) {
    req.flash('error', 'Montant invalide. Retrait minimum : 1 €.');
    return res.redirect(retour);
  }
  if (montant > 1000) {
    req.flash('error', 'Montant maximum par retrait : 1000 €.');
    return res.redirect(retour);
  }

  try {
    const [rows] = await db.execute(
      'SELECT * FROM comptes_bancaires WHERE id = ? AND user_id = ?',
      [compteId, req.session.user.id]
    );
    if (rows.length === 0) {
      req.flash('error', 'Compte introuvable.');
      return res.redirect('/comptes');
    }
    if (rows[0].statut === 'bloque') {
      req.flash('error', 'Ce compte est bloqué, aucune opération possible.');
      return res.redirect(retour);
    }
    if (parseFloat(rows[0].solde) < montant) {
      req.flash('error', 'Solde insuffisant.');
      return res.redirect(retour);
    }

    await db.execute('UPDATE comptes_bancaires SET solde = solde - ? WHERE id = ?', [montant, compteId]);
    await db.execute(
      'INSERT INTO transactions (compte_source_id, type_transaction, montant, libelle) VALUES (?, ?, ?, ?)',
      [compteId, 'retrait', montant, req.body.libelle || 'Retrait']
    );

    req.flash('success', `Retrait de ${montant.toFixed(2)} € effectué.`);
    res.redirect(retour);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Erreur lors du retrait.');
    res.redirect(retour);
  }
});

// ===================== VIREMENT (interne ou vers autre client via IBAN) =====================
router.post('/comptes/:id/virement', csrfProtection, async (req, res) => {
  const montant = parseMontant(req.body.montant);
  const sourceId = req.params.id;
  const ibanDest = (req.body.iban_destinataire || '').trim();
  const libelle = req.body.libelle || 'Virement';
  const retour = `/comptes/${sourceId}`;

  if (montant === null || montant < 1) {
    req.flash('error', 'Montant invalide. Virement minimum : 1 €.');
    return res.redirect(retour);
  }
  if (!ibanDest) {
    req.flash('error', 'IBAN du destinataire requis.');
    return res.redirect(retour);
  }

  // On récupère une connexion dédiée pour la transaction SQL
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Compte source (doit appartenir à l'utilisateur connecté)
    const [srcRows] = await conn.execute(
      'SELECT * FROM comptes_bancaires WHERE id = ? AND user_id = ? FOR UPDATE',
      [sourceId, req.session.user.id]
    );
    if (srcRows.length === 0) {
      await conn.rollback();
      req.flash('error', 'Compte source introuvable.');
      return res.redirect('/comptes');
    }
    const source = srcRows[0];

    // Compte destinataire (recherché par IBAN, peut appartenir à n'importe qui)
    const [destRows] = await conn.execute(
      'SELECT * FROM comptes_bancaires WHERE numero_compte = ? FOR UPDATE',
      [ibanDest]
    );
    if (destRows.length === 0) {
      await conn.rollback();
      req.flash('error', 'IBAN destinataire introuvable.');
      return res.redirect(retour);
    }
    const dest = destRows[0];

    // Vérifications métier
    if (dest.id === source.id) {
      await conn.rollback();
      req.flash('error', 'Impossible de virer vers le même compte.');
      return res.redirect(retour);
    }
    if (source.statut === 'bloque' || dest.statut === 'bloque') {
      await conn.rollback();
      req.flash('error', 'Un des comptes est bloqué, virement impossible.');
      return res.redirect(retour);
    }
    if (parseFloat(source.solde) < montant) {
      await conn.rollback();
      req.flash('error', 'Solde insuffisant pour ce virement.');
      return res.redirect(retour);
    }

    // Débit source + crédit destinataire
    await conn.execute('UPDATE comptes_bancaires SET solde = solde - ? WHERE id = ?', [montant, source.id]);
    await conn.execute('UPDATE comptes_bancaires SET solde = solde + ? WHERE id = ?', [montant, dest.id]);

    // Deux écritures : virement émis (côté source) et virement reçu (côté destinataire)
    await conn.execute(
      'INSERT INTO transactions (compte_source_id, compte_destinataire_id, type_transaction, montant, libelle) VALUES (?, ?, ?, ?, ?)',
      [source.id, dest.id, 'virement_emis', montant, libelle]
    );
    await conn.execute(
      'INSERT INTO transactions (compte_source_id, compte_destinataire_id, type_transaction, montant, libelle) VALUES (?, ?, ?, ?, ?)',
      [source.id, dest.id, 'virement_recu', montant, libelle]
    );

    await conn.commit();
    req.flash('success', `Virement de ${montant.toFixed(2)} € effectué vers ${dest.numero_compte}.`);
    res.redirect(retour);
  } catch (err) {
    await conn.rollback();
    console.error(err);
    req.flash('error', 'Erreur lors du virement. Opération annulée.');
    res.redirect(retour);
  } finally {
    conn.release();
  }
});

// ===================== HISTORIQUE DES TRANSACTIONS =====================
router.get('/historique', async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [transactions] = await db.execute(
      `SELECT t.*,
              cs.numero_compte AS source_iban,
              cd.numero_compte AS dest_iban,
              us.is_actif AS source_actif,
              ud.is_actif AS dest_actif
       FROM transactions t
       LEFT JOIN comptes_bancaires cs ON t.compte_source_id = cs.id
       LEFT JOIN comptes_bancaires cd ON t.compte_destinataire_id = cd.id
       LEFT JOIN users us ON cs.user_id = us.id
       LEFT JOIN users ud ON cd.user_id = ud.id
       WHERE
         (t.type_transaction IN ('depot','retrait','virement_emis') AND cs.user_id = ?)
         OR
         (t.type_transaction = 'virement_recu' AND cd.user_id = ?)
       ORDER BY t.date_transaction DESC`,
      [userId, userId]
    );
    res.render('client/historique', { title: 'Historique', transactions, userId });
  } catch (err) {
    console.error(err);
    req.flash('error', "Erreur lors du chargement de l'historique.");
    res.redirect('/dashboard');
  }
});

module.exports = router;