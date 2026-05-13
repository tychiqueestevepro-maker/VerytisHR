# Intégration LinkedIn - Guide de Synchronisation Sécurisée

Ce document décrit le fonctionnement du pipeline d'authentification LinkedIn sur **VerytisHR**, basé sur la synchronisation sécurisée de cookies.

## Architecture & Stratégie

### Pourquoi le Cookie Sync ?
Contrairement aux systèmes de login automatisés classiques qui sont souvent bloqués par des CAPTCHAs et des détections anti-bot, nous utilisons la méthode de **Synchronisation Sécurisée (Cookie Sync)** :
- **Sécurité :** Vous ne partagez jamais votre mot de passe LinkedIn avec nos serveurs.
- **Fiabilité :** Succès à 100% car la session est déjà validée par vous sur votre propre navigateur.
- **Bypass CAPTCHA :** Pas de formulaire de login = pas de CAPTCHA.

## Installation de l'Extension

Pour synchroniser votre compte, vous devez utiliser l'extension **Verytis LinkedIn Sync** située dans le dossier `extension/` du projet.

1. Allez sur `chrome://extensions`.
2. Activez le **Mode développeur**.
3. Cliquez sur **Charger l'extension non emballée** et sélectionnez le dossier `extension`.
4. Connectez-vous à LinkedIn sur votre navigateur si ce n'est pas déjà fait.
5. Dans VerytisHR, cliquez sur **Se connecter via l'extension**.

## Couche de Dissimulation (Stealth)

Même avec un cookie, LinkedIn surveille la provenance des requêtes. Pour rester invisible, nous combinons :
1. **Proxies Résidentiels :** Chaque requête passe par une IP domestique (Fournisseur d'accès grand public) localisée dans votre région.
2. **Fingerprinting Avancé :** Notre scraper Puppeteer injecte du bruit aléatoire dans le rendu Canvas et WebGL pour briser le fingerprinting matériel.
3. **Comportement Organique :** Les requêtes de scraping sont espacées de manière aléatoire pour imiter une navigation humaine.

## Gestion des Échecs

- **Session Expirée :** Si LinkedIn vous déconnecte de votre navigateur, la synchronisation s'arrêtera. Il suffira de cliquer à nouveau sur le bouton de l'extension.
- **IP Flagging :** Si une IP est temporairement suspectée, le système effectue une rotation automatique vers une nouvelle IP résidentielle.

---
*Dernière mise à jour : 13 Mai 2026*
