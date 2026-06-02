(function () {
  const LIMITE = 5 * 60 * 1000;        // 5 minutes
  const AVERTISSEMENT = 60 * 1000;     // alerte 1 min avant
  let minuteur, minuteurAlerte;

  function deconnexion() {
  // Déconnexion pour inactivité : on passe par une route qui marque la raison
  window.location.href = '/logout-inactivite';
}

  function alerte() {
    if (window.Swal) {
      Swal.fire({
        title: 'Toujours là ?',
        text: 'Vous allez être déconnecté dans 1 minute pour inactivité.',
        icon: 'warning',
        timer: AVERTISSEMENT,
        timerProgressBar: true,
        showConfirmButton: true,
        confirmButtonText: 'Je suis là',
      }).then((r) => {
        if (r.isConfirmed) reinitialiser(); // l'utilisateur réagit : on relance
      });
    }
  }

  function reinitialiser() {
    clearTimeout(minuteur);
    clearTimeout(minuteurAlerte);
    minuteurAlerte = setTimeout(alerte, LIMITE - AVERTISSEMENT);
    minuteur = setTimeout(deconnexion, LIMITE);
  }

  // Toute activité réinitialise le compteur
  ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach((evt) =>
    document.addEventListener(evt, reinitialiser, { passive: true })
  );

  reinitialiser();
})();