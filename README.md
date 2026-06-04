<div align="center">

# 🏦 Our Bank

**Application web bancaire complète — Node.js / Express / MySQL**

Projet pédagogique M1 : gestion de comptes bancaires en ligne avec espace client et espace administrateur.

![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-MariaDB-4479A1?logo=mysql&logoColor=white)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-7952B3?logo=bootstrap&logoColor=white)
![EJS](https://img.shields.io/badge/Templates-EJS-B4CA65)

</div>

---

## 📋 Présentation

Our Bank est une application web permettant à des clients de gérer leurs comptes bancaires en ligne (création de comptes, dépôts, retraits, virements, historique) et à des administrateurs de superviser l'ensemble du système (gestion des clients, blocage de comptes, statistiques).

## ✨ Fonctionnalités

### Espace client
- Inscription avec validation en temps réel (force du mot de passe, format email/téléphone)
- Connexion sécurisée / déconnexion (manuelle et automatique après 5 min d'inactivité)
- Tableau de bord : solde total, comptes, raccourcis
- Gestion du profil (modification des informations personnelles)
- Création de comptes bancaires (Compte courant, Livret A, PEL) avec **IBAN généré automatiquement**
- Suppression d'un compte (uniquement si solde = 0, avec confirmation)
- **Opérations bancaires** : dépôt, retrait, virement entre ses comptes et vers d'autres clients (via IBAN)
- Historique des transactions avec crédits/débits colorés
- **Relevé de compte téléchargeable en PDF**

### Espace administrateur
- Connexion administrateur dédiée
- Gestion des clients : liste avec **recherche instantanée**, détail, modification, suppression définitive
- **Soft delete** : désactivation/réactivation d'un client (données masquées mais conservées, réversible)
- Gestion des comptes : liste globale, blocage/déblocage, historique par compte
- Statistiques : nombre de clients, de comptes, total des dépôts + **graphiques Chart.js**

### Sécurité (règles de gestion)
- Mots de passe **hashés avec bcrypt** (jamais stockés en clair)
- **Middlewares** `requireAuth` / `requireAdmin` protégeant les pages réservées
- **Protection CSRF** sur tous les formulaires (token `_csrf` synchronisé en session — équivalent Express du `@csrf` de Laravel)
- **Rate limiting** : blocage temporaire après 5 tentatives de connexion échouées (15 min)
- Requêtes SQL **préparées** (protection contre l'injection SQL)
- **Virements atomiques** : transactions SQL (`beginTransaction` / `commit` / `rollback`) avec verrouillage `FOR UPDATE`
- En-têtes HTTP sécurisés via Helmet
- Session glissante avec expiration après 5 min d'inactivité

## 🛠️ Stack technique

| Couche | Technologie |
|---|---|
| Back-end | Node.js, Express |
| Vues | EJS + express-ejs-layouts |
| Base de données | MySQL / MariaDB (driver `mysql2`) |
| Authentification | express-session, bcrypt |
| Sécurité | csrf-sync, express-rate-limit, helmet, express-validator |
| Front-end | Bootstrap 5, Bootstrap Icons, SweetAlert2, Chart.js |
| PDF | PDFKit |

> **Choix MySQL vs MongoDB** : le cahier des charges propose « MySQL, MongoDB — 1 seule connexion ». MySQL a été retenu car le domaine (comptes, transactions, intégrité référentielle, relations 1:N, contraintes d'unicité) correspond pleinement au modèle relationnel.

## 🚀 Installation

### Prérequis
- [Node.js](https://nodejs.org/fr) (LTS)
- MySQL ou MariaDB (par exemple via [XAMPP](https://www.apachefriends.org/))

### Étapes

```bash
# 1. Cloner le dépôt
git clone https://github.com/JessicaD3/M1_Projet_Bank.git
cd M1_Projet_Bank

# 2. Installer les dépendances
npm install

# 3. Créer la base de données (MySQL démarré)
mysql -u root < database.sql
# ou via phpMyAdmin : onglet SQL > coller le contenu de database.sql > Exécuter
```

### Configuration

Créer un fichier `.env` à la racine :

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=our_bank
SESSION_SECRET=une_longue_chaine_aleatoire_a_changer
PORT=3000
```

> Avec XAMPP, `root` n'a pas de mot de passe par défaut : laisser `DB_PASSWORD=` vide.

### Lancement

```bash
# Développement (rechargement auto)
npm run dev

# Production
npm start
```

L'application est accessible sur **http://localhost:3000**.

## 🔑 Comptes de test

| Rôle | Email | Mot de passe |
|---|---|---|
| Administrateur | `admin@ourbank.fr` | `Password1` |
| Client | `jean.dupont@mail.fr` | `Password1` |
| Client | `marie.martin@mail.fr` | `Password3` |

L'espace administrateur est accessible via `/admin/login`.

## 🗄️ Base de données

Trois tables relationnelles :

- **`users`** — clients et administrateurs (email unique, mot de passe hashé, statut actif/désactivé)
- **`comptes_bancaires`** — comptes liés à un utilisateur (1:N), IBAN unique, type, solde, statut actif/bloqué
- **`transactions`** — opérations liées aux comptes ; un virement relie un compte source et un compte destinataire (double lien 1:N)

Les diagrammes MCD et MLD sont disponibles dans le dossier [`docs/`](docs/).

## 📁 Structure du projet

```
our-bank/
├── app.js                  # Point d'entrée Express (middlewares, sessions, routes)
├── database.sql            # Script de création + données de test
├── seed.js                 # (Re)génération des hash des comptes de test
├── config/
│   └── db.js               # Pool de connexion MySQL (promesses)
├── middleware/
│   ├── auth.js             # requireAuth / requireAdmin / redirectIfAuth
│   └── csrf.js             # Protection CSRF (csrf-sync)
├── routes/
│   ├── auth.js             # Inscription, connexions, déconnexions, rate limiting
│   ├── client.js           # Dashboard, profil, comptes, opérations, historique, relevé PDF
│   └── admin.js            # Clients, comptes, statistiques, soft delete
├── utils/
│   ├── iban.js             # Génération d'IBAN (FR76-YBNK...)
│   ├── format.js           # Formatage montants/dates/libellés (helpers de vues)
│   └── releve.js           # Génération du relevé PDF (PDFKit)
├── views/                  # Vues EJS (layout, partials, auth, client, admin)
└── public/                 # CSS (thème personnalisé), JS (timer d'inactivité), images/logo
```

## 📌 Points techniques notables

- **Virements atomiques** : débit + crédit + double écriture (`virement_emis` / `virement_recu`) dans une transaction SQL — aucune perte ni duplication d'argent possible en cas d'erreur.
- **Soft delete réversible** : un client désactivé disparaît des listes, statistiques et historiques des autres clients (IBAN remplacé par « Compte clôturé »), ne peut plus se connecter, mais toutes ses données sont conservées et restaurables.
- **Déconnexion d'inactivité à deux niveaux** : session serveur glissante (`rolling`) + minuteur client avec avertissement SweetAlert2 avant déconnexion.
- **Design system personnalisé** « Émeraude Nuit » : variables CSS surchargeant Bootstrap, identité visuelle dédiée (logo SVG, palette, typographie Inter/JetBrains Mono).

---

<div align="center">
<sub>Projet pédagogique — données fictives, aucune transaction réelle.</sub>
</div>
