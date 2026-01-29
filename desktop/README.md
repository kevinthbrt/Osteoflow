# Osteoflow Desktop (POC)

## Pré-requis
- Node.js 18+
- Rust (stable)

## Lancer en développement
```bash
cd desktop
npm install
npm run tauri dev
```

## Notes
- Ce POC crée des profils locaux et une base SQLite chiffrée (SQLCipher).
- La base est stockée dans le dossier `AppData`/`Application Support` de l'utilisateur.
