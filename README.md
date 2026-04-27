# OHM Web

`LP/` contient l’application web de **OHM — Open Humanitarian Map**.

L’objectif est simple : proposer une **carte interactive claire et utile**, pensée pour des ONG, des équipes opérations et des personnes qui ont besoin de comprendre rapidement **où agir en priorité**.

## Ce que permet l’app

L’app web permet de :

- visualiser les zones prioritaires sur une carte
- lire l’évolution IPC dans le temps
- afficher ou masquer des couches de contexte
- passer d’une lecture régionale à une lecture plus terrain

## Ce que montre la carte

La couche principale affiche une **priorité d’intervention**.

Cette priorité ne correspond pas seulement à une phase IPC brute. Elle combine notamment :

- la phase IPC
- le nombre de personnes en P3+
- la part de population en P3+
- du contexte terrain quand il est disponible

L’idée est de produire une lecture plus utile pour l’action qu’une simple carte thématique isolée.

## Lancer l’app en local

```bash
npm install
npm run dev
```

Puis ouvrir :

```text
http://localhost:5173
```

## Build

```bash
npm run build
```

## Vérification TypeScript

```bash
npm run typecheck
```

## D’où viennent les données

En développement, l’app peut lire des fichiers publiés dans :

```text
public/data/
```

Un script permet de reconstruire un jeu de données web propre à partir des exports du pipeline Python :

```bash
python ..\tools\publish_web_data.py
```

Ce script :

- garde un jeu `current` par pays
- reconstruit `public/data/index.json`
- prépare des fichiers plus propres pour le front

En production, l’app peut aussi lire les données depuis un stockage distant, par exemple un bucket R2, via :

```text
VITE_OHM_DATA_BASE_URL=https://<ton-endpoint>/data
```

## Stack

- React Router
- TypeScript
- MapLibre GL
- deck.gl

## Intention produit

OHM Web n’est pas une vitrine marketing.

C’est une interface **map-first** :

- la carte est l’élément principal
- les contrôles doivent rester légers
- les détails doivent aider la lecture, pas encombrer l’écran

Si tu veux comprendre le projet dans son ensemble, regarde aussi le [README racine](../README.md).
