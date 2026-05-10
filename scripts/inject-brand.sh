#!/bin/bash

set -a
source .env
set +a

APP_NAME=${APP_NAME:-NORA}
APP_FULL_NAME=${APP_FULL_NAME:-NORA Conecta}
APP_TAGLINE=${APP_TAGLINE:-Tu profesional de confianza}
APP_URL=${APP_URL:-https://noraconecta.com}

echo "Inyectando marca: $APP_FULL_NAME"

cp landing/index.template.html landing/index.html

sed -i "s|{{APP_FULL_NAME}}|$APP_FULL_NAME|g" landing/index.html
sed -i "s|{{APP_NAME}}|$APP_NAME|g" landing/index.html
sed -i "s|{{APP_TAGLINE}}|$APP_TAGLINE|g" landing/index.html
sed -i "s|{{APP_URL}}|$APP_URL|g" landing/index.html

echo "✅ landing/index.html generado con marca: $APP_FULL_NAME"
