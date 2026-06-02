const PDFDocument = require('pdfkit');
const { formaterMontant, formaterDateHeure, libelleTypeCompte, libelleTypeTransaction } = require('./format');

// Couleurs du thème
const EMERALD = '#059669';
const NIGHT = '#0f1729';
const GREY = '#64748b';

function genererReleve(res, { compte, titulaire, transactions }) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  // En-têtes HTTP : téléchargement
  const nomFichier = `releve_${compte.numero_compte.replace(/[^A-Za-z0-9]/g, '')}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nomFichier}"`);
  doc.pipe(res);

  // ---------- EN-TÊTE ----------
  doc.fillColor(EMERALD).fontSize(24).font('Helvetica-Bold').text('Our Bank', 50, 50);
  doc.fillColor(GREY).fontSize(9).font('Helvetica').text('Banque en ligne', 50, 78);

  doc.fillColor(NIGHT).fontSize(16).font('Helvetica-Bold')
    .text('Relevé de compte', 50, 50, { align: 'right' });
  doc.fillColor(GREY).fontSize(9).font('Helvetica')
    .text('Édité le ' + formaterDateHeure(new Date()), 50, 72, { align: 'right' });

  doc.moveTo(50, 100).lineTo(545, 100).strokeColor('#e2e8f0').stroke();

  // ---------- INFOS COMPTE ----------
  let y = 120;
  doc.fillColor(NIGHT).fontSize(11).font('Helvetica-Bold').text('Titulaire', 50, y);
  doc.fillColor(GREY).font('Helvetica').text(`${titulaire.prenom} ${titulaire.nom}`, 50, y + 16);
  doc.fillColor(GREY).fontSize(9).text(titulaire.email, 50, y + 32);

  doc.fillColor(NIGHT).fontSize(11).font('Helvetica-Bold').text('Compte', 320, y);
  doc.fillColor(GREY).fontSize(9).font('Helvetica').text(libelleTypeCompte(compte.type_compte), 320, y + 16);
  doc.font('Courier').text(compte.numero_compte, 320, y + 30);

  // Encart solde
  y += 64;
  doc.roundedRect(50, y, 495, 50, 8).fill('#ecfdf5');
  doc.fillColor(GREY).fontSize(10).font('Helvetica').text('Solde actuel', 65, y + 12);
  doc.fillColor(EMERALD).fontSize(20).font('Helvetica-Bold')
    .text(formaterMontant(compte.solde), 65, y + 24);

  // ---------- TABLEAU TRANSACTIONS ----------
  y += 80;
  doc.fillColor(NIGHT).fontSize(13).font('Helvetica-Bold').text('Historique des transactions', 50, y);
  y += 24;

  // En-têtes de colonnes
  doc.fillColor(GREY).fontSize(9).font('Helvetica-Bold');
  doc.text('Date', 50, y);
  doc.text('Type', 160, y);
  doc.text('Libellé', 280, y);
  doc.text('Montant', 50, y, { align: 'right' });
  y += 14;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').stroke();
  y += 8;

  doc.font('Helvetica').fontSize(9);

  if (transactions.length === 0) {
    doc.fillColor(GREY).text('Aucune transaction.', 50, y);
  } else {
    transactions.forEach((t) => {
      // Saut de page si on arrive en bas
      if (y > 760) {
        doc.addPage();
        y = 50;
      }
      const estCredit = (t.type_transaction === 'depot' || t.type_transaction === 'virement_recu');
      const signe = estCredit ? '+' : '-';

      doc.fillColor(NIGHT).font('Helvetica');
      doc.text(formaterDateHeure(t.date_transaction), 50, y, { width: 105 });
      doc.text(libelleTypeTransaction(t.type_transaction), 160, y, { width: 115 });
      doc.fillColor(GREY).text(t.libelle || '—', 280, y, { width: 150 });
      doc.fillColor(estCredit ? EMERALD : '#dc2626').font('Helvetica-Bold')
        .text(signe + formaterMontant(t.montant), 50, y, { align: 'right' });

      y += 22;
    });
  }

  // ---------- PIED DE PAGE ----------
  doc.fontSize(8).fillColor(GREY).font('Helvetica')
    .text('Our Bank — Document généré automatiquement. Données fictives, aucune valeur légale.',
      50, 790, { align: 'center', width: 495 });

  doc.end();
}

module.exports = { genererReleve };