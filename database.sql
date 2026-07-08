DROP DATABASE IF EXISTS our_bank;
CREATE DATABASE our_bank CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE our_bank;

CREATE TABLE users (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    nom             VARCHAR(100) NOT NULL,
    prenom          VARCHAR(100) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    telephone       VARCHAR(10),
    adresse         VARCHAR(255),
    date_naissance  DATE,
    password        VARCHAR(255) NOT NULL,
    is_admin        BOOLEAN NOT NULL DEFAULT FALSE,
    is_actif        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE comptes_bancaires (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT NOT NULL,
    numero_compte VARCHAR(40) NOT NULL UNIQUE,
    type_compte   ENUM('courant','livret_a','pel') NOT NULL DEFAULT 'courant',
    solde         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    statut        ENUM('actif','bloque') NOT NULL DEFAULT 'actif',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_compte_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE transactions (
    id                     INT AUTO_INCREMENT PRIMARY KEY,
    compte_source_id       INT,
    compte_destinataire_id INT,
    type_transaction       ENUM('depot','retrait','virement_emis','virement_recu') NOT NULL,
    montant                DECIMAL(12,2) NOT NULL,
    libelle                VARCHAR(255) DEFAULT NULL,
    date_transaction       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tx_source FOREIGN KEY (compte_source_id)
        REFERENCES comptes_bancaires(id) ON DELETE SET NULL,
    CONSTRAINT fk_tx_dest FOREIGN KEY (compte_destinataire_id)
        REFERENCES comptes_bancaires(id) ON DELETE SET NULL
);

INSERT INTO users (nom, prenom, email, telephone, adresse, date_naissance, password, is_admin, is_actif)
VALUES
('Admin', 'Super', 'admin@ourbank.fr', '0600000000', '1 rue de la Banque, Paris', '1990-01-01', 'A_REMPLACER', TRUE, TRUE),
('Dupont', 'Jean', 'jean.dupont@mail.fr', '0611111111', '12 rue Victor Hugo, Lyon', '1995-06-15', 'A_REMPLACER', FALSE, TRUE);
