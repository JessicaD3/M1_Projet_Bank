function formaterMontant(valeur) {
  const nombre = parseFloat(valeur);
  if (isNaN(nombre)) return '0,00 €';
  return nombre.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' €';
}

function formaterDate(valeur) {
  if (!valeur) return '—';
  return new Date(valeur).toLocaleDateString('fr-FR');
}

function formaterDateHeure(valeur) {
  if (!valeur) return '—';
  return new Date(valeur).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function libelleTypeCompte(type) {
  const labels = { courant: 'Compte courant', livret_a: 'Livret A', pel: 'PEL' };
  return labels[type] || type;
}

function libelleTypeTransaction(type) {
  const labels = {
    depot: 'Dépôt', retrait: 'Retrait',
    virement_emis: 'Virement émis', virement_recu: 'Virement reçu',
  };
  return labels[type] || type;
}

module.exports = {
  formaterMontant,
  formaterDate,
  formaterDateHeure,
  libelleTypeCompte,
  libelleTypeTransaction,
};