#!/bin/bash
# Ce script retire le blocage macOS (Gatekeeper) sur Osteoflow
# Double-cliquez dessus si l'app affiche "endommagée et ne peut pas être ouverte"

APP="/Applications/Osteoflow.app"

if [ ! -d "$APP" ]; then
  osascript -e 'display dialog "Veuillez d'"'"'abord glisser Osteoflow.app dans le dossier Applications, puis relancer ce script." buttons {"OK"} default button "OK" with icon caution'
  exit 1
fi

# Remove quarantine flag
xattr -cr "$APP" 2>/dev/null

# Open the app
open "$APP"
