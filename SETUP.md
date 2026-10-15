# Configuration Firebase — Budget Famille

## 1. Créer le projet Firebase

1. Va sur [console.firebase.google.com](https://console.firebase.google.com)
2. **Add project** → nom : `budget-famille` → Continue
3. Désactive Google Analytics (inutile ici) → **Create project**

## 2. Activer Firestore

1. Dans le menu gauche → **Firestore Database** → **Create database**
2. Choisis **Start in test mode** (on sécurisera après) → **Next** → **Enable**

## 3. Récupérer les clés

1. Roue dentée (⚙) → **Project settings** → onglet **General**
2. Descends jusqu'à "Your apps" → clique l'icône `</>` (Web)
3. Nom : `budget-famille` → **Register app**
4. Copie l'objet `firebaseConfig` affiché

## 4. Remplir js/config.js

Remplace les valeurs `VOTRE_...` par celles copiées :

```js
const FIREBASE_CONFIG = {
  apiKey:            'AIzaSy...',
  authDomain:        'budget-famille-xxxx.firebaseapp.com',
  projectId:         'budget-famille-xxxx',
  storageBucket:     'budget-famille-xxxx.appspot.com',
  messagingSenderId: '123456789',
  appId:             '1:123456789:web:abcdef'
};
```

## 5. Règles Firestore (sécurité minimale)

Dans Firestore → onglet **Rules**, remplace par :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /virements/{id} {
      allow read, write: if true;
    }
  }
}
```

> ⚠️ Ces règles donnent accès à quiconque connaît l'URL.
> Suffisant pour un usage familial privé.

## 6. Pusher la config sur GitHub

```bash
git add js/config.js
git commit -m "Config Firebase"
git push
```

Le site GitHub Pages se met à jour en 1-2 minutes.
