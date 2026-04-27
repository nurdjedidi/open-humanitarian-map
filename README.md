# OHM Web

`LP/` contient l’application web de **OHM — Open Humanitarian Map**.

L’objectif n’est pas de faire une landing page marketing, mais une **carte opérationnelle** qui permet de lire rapidement :

- où la priorité humanitaire est la plus forte
- comment cette priorité évolue dans le temps
- quel est le contexte terrain autour des zones concernées

## Ce que montre l’app

L’application web affiche :

- une couche principale de priorité par région
- des couches contextuelles activables
- une timeline IPC par année
- des pages d’information séparées

## Ce que la couleur signifie

La couleur principale ne représente pas seulement une phase IPC brute.

Elle représente une **priorité d’intervention** calculée à partir de :

- la phase IPC
- le nombre de personnes en P3+
- la part de population en P3+
- un peu de contexte additionnel si disponible

Donc une région peut être visuellement prioritaire même si sa phase dominante n’est pas la plus élevée.

## Lancer l’app

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

## Données

L’app charge les manifests et GeoJSON depuis :

```text
public/data/
```

En local, un script de publication peut reconstruire un jeu de données web propre à partir de `data/outputs` :

```bash
python ..\tools\publish_web_data.py
```

Ce script :

- garde uniquement un jeu `current` par pays
- enlève les couches inutiles pour le front public
- reconstruit `public/data/index.json`

Pour la production, l’app peut aussi lire une base distante, par exemple un bucket R2, via :

```text
VITE_OHM_DATA_BASE_URL=https://<ton-endpoint>/ohm-data
```

Chaque pays peut contenir :

- un manifest principal
- un GeoJSON admin enrichi
- des couches OSM séparées

## Stack

- React Router
- TypeScript
- MapLibre GL
- deck.gl

## Note produit

Cette app est pensée comme une interface **map-first** :

- la carte est l’élément principal
- les panneaux restent secondaires
- les détails et les sources doivent aider la lecture, pas concurrencer la carte
