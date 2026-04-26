# OHM – Système de contribution terrain

## 🎯 Objectif

Permettre à des utilisateurs terrain (ONG, locaux, analystes) d’enrichir la carte avec des données **structurées, exploitables et validables**.

Le système repose sur :
- données officielles (IPC, population, OSM)
- contributions terrain (overlay)
- scoring décisionnel (algo)

---

## 🧠 Architecture globale

### 1. Data sources

#### Core (read-only)
- IPC (GeoJSON / raster)
- Population (GeoTIFF)
- Boundaries (GeoJSON)
- OSM (routes, villages, eau)

👉 jamais modifiées

---

#### User data (write)
- contributions terrain
- validations
- feedback

👉 stockées en DB séparée

---

## 🗄️ Base de données

### Table: `user_inputs`

```sql
id UUID PRIMARY KEY
geom GEOMETRY
osm_ref TEXT NULL
type TEXT
value TEXT
confidence FLOAT DEFAULT 0.5
status TEXT DEFAULT 'pending'
created_at TIMESTAMP
user_id UUID
Table: validations
id UUID
input_id UUID
validator_id UUID
vote BOOLEAN
created_at TIMESTAMP
🧩 Types de contributions

⚠️ IMPORTANT : toujours STRUCTURÉ (pas de texte libre)

1. Accessibilité
{
  "type": "access",
  "value": "seasonal_blocked"
}

Valeurs :

accessible
difficult
seasonal_blocked
inaccessible
2. Eau
{
  "type": "water",
  "value": "functional"
}

Valeurs :

functional
dry
seasonal
broken
3. Route
{
  "type": "road",
  "value": "truck_ok"
}

Valeurs :

truck_ok
moto_only
walk_only
unusable
4. Présence ONG
{
  "type": "ngo_presence",
  "value": "active"
}

Valeurs :

active
partial
none
unknown
5. Alerte terrain
{
  "type": "alert",
  "value": "food_crisis"
}

system d''auth ???
🌐 Intégration web
bouton: "Contribuer"
sélection point / zone
formulaire simple (dropdown)
Flow utilisateur
clic sur carte
choix type contribution
sélection valeur (dropdown)
submit
Backend
POST /contributions
GET /contributions?bbox=...
POST /validate

👉 REST API simple recommandée

🔁 Pipeline data
user input → DB
validation → update confidence
fusion logique (overlay)
scoring (algo interne)
affichage décision
🧠 Rendu carte

👉 NE PAS modifier OSM

Tu fais :

base map (OSM)
overlay user data
overlay scoring

👉 séparation stricte recommandée

🛡️ Qualité des données
Validation
statut : pending / validated / rejected
score confiance
vote multiple possible
Règles
champs obligatoires
dropdown only
pas de texte libre

👉 essentiel pour éviter données inutilisables

📱 Bonus terrain (plus tard)
upload photo (géolocalisée)
mode offline
sync différé
🧠 Principe clé

“Les utilisateurs n’ajoutent pas des données, ils répondent à des questions.”

🔥 Résultat final

Tu obtiens :

data officielle (stable)
réalité terrain (dynamique)
priorisation automatique
🚀 MVP (à faire en premier)
1 map
1 formulaire contribution
1 table DB
1 overlay

STOP.

Pas plus.


---

Voilà.

T’as maintenant :
👉 un système propre  
👉 légal  
👉 scalable  
👉 utilisable  

---

Et surtout :

👉 t’as évité le piège du  
“je laisse les gens écrire n’importe quoi sur une carte”

---

Si tu veux, prochaine étape :

👉 je te fais le **scoring engine (formule + pondérations + code Python)**

et là ton truc devient vraiment dangereux (dans le bon sens).