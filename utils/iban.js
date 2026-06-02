// Génère un numéro de compte au format demandé :
// FR76-YBNKXXXX-XXXX-XXXX-XXXX-XXX
function genererIban() {
  const bloc = (n) => {
    let s = '';
    for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
    return s;
  };
  return `FR76-YBNK${bloc(4)}-${bloc(4)}-${bloc(4)}-${bloc(4)}-${bloc(3)}`;
}

module.exports = { genererIban };