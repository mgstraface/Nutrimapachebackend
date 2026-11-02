#!/usr/bin/env bash
# Instala o actualiza NutriMapache en el VPS compartido (Casa Roma + robot + NutriMapache).
#
# Uso (en el VPS):
#   bash /root/nutrimapache/app/scripts/deploy-vps.sh
#
# Qué NO toca nunca:
#   - Los puertos 80/443 (son del nginx del VPS).
#   - Sitios de nginx que no sean el suyo.
#   - Contenedores, imágenes o volúmenes de otros proyectos (nada de prune global).
#
# Desde GitHub Actions entra con una clave SSH PROPIA de este proyecto, restringida en
# authorized_keys con command= a correr solo este script. No reusar la clave del robot
# ni la de Casa Roma: una clave con command= fuerza ese comando para todo el que la use.
set -euo pipefail

BASE_DIR="${BASE_DIR:-/root/nutrimapache}"
APP_DIR="$BASE_DIR/app"
REPO_URL="${REPO_URL:-git@github.com:mgstraface/Nutrimapachebackend.git}"
BRANCH="${BRANCH:-main}"
DEFAULT_WEB_PORT=8092
DEFAULT_MONGO_PORT=27022

say() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m✗ %s\033[0m\n' "$*"; exit 1; }

# Un deploy de NutriMapache a la vez (lock propio, no compartido con los otros proyectos)
exec 9>/tmp/nutrimapache-deploy.lock
flock 9

command -v docker >/dev/null || die "Falta docker"
docker compose version >/dev/null 2>&1 || die "Falta el plugin docker compose"
command -v openssl >/dev/null || die "Falta openssl"

if [ -d "$APP_DIR/.git" ]; then
  say "Actualizando código ($BRANCH)"
  BEFORE="$(git -C "$APP_DIR" rev-parse HEAD)"
  git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
  git -C "$APP_DIR" checkout --quiet "$BRANCH"
  git -C "$APP_DIR" pull --ff-only --quiet origin "$BRANCH"
  # Si el pull trajo una versión nueva de este script, se relanza con ella
  # (bash ya tenía cargada la vieja y seguiría con esa).
  if [ -z "${DEPLOY_RELAUNCHED:-}" ] && [ "$BEFORE" != "$(git -C "$APP_DIR" rev-parse HEAD)" ]; then
    export DEPLOY_RELAUNCHED=1
    exec bash "$APP_DIR/scripts/deploy-vps.sh" "$@"
  fi
else
  say "Clonando el repo"
  mkdir -p "$BASE_DIR"
  git clone --quiet --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

env_get() { grep -E "^$1=" .env 2>/dev/null | head -1 | cut -d= -f2- || true; }

if [ ! -f .env ]; then
  say "Creando .env"
  cp .env.example .env
  chmod 600 .env
fi

# Admin inicial: si falta la contraseña, se genera una y se muestra UNA vez (solo en terminal).
# La API lo crea al arrancar si todavía no existe ningún admin. Después se cambia desde el panel.
if ! grep -qE '^ADMIN_PASSWORD=.+' .env; then
  grep -qE '^ADMIN_USERNAME=' .env || echo "ADMIN_USERNAME=mati" >> .env
  sed -i '/^ADMIN_PASSWORD=/d' .env
  ADMIN_PASS="$(openssl rand -base64 18 | tr -dc 'a-zA-Z0-9' | cut -c1-14)"
  echo "ADMIN_PASSWORD=$ADMIN_PASS" >> .env
  say "Admin inicial"
  if [ -t 1 ]; then
    echo "  Usuario:    $(env_get ADMIN_USERNAME)"
    echo "  Contraseña: $ADMIN_PASS"
  fi
  echo "  (queda guardada en $APP_DIR/.env; cambiala desde el panel después de entrar)"
fi

DOMAIN="$(env_get DOMAIN)"
WEB_PORT="$(env_get WEB_PORT)"; WEB_PORT="${WEB_PORT:-$DEFAULT_WEB_PORT}"
MONGO_PORT="$(env_get MONGO_PORT)"; MONGO_PORT="${MONGO_PORT:-$DEFAULT_MONGO_PORT}"
STACK="$(env_get STACK)"; STACK="${STACK:-nutrimapache}"

if [ -z "$DOMAIN" ]; then
  warn "Falta DOMAIN en $APP_DIR/.env (ej. nutrimapache.tudominio.com)."
  warn "Editalo (nano $APP_DIR/.env) y volvé a correr este script."
  exit 1
fi
grep -qE '^CORS_ORIGIN=https://' .env || sed -i "s#^CORS_ORIGIN=.*#CORS_ORIGIN=https://$DOMAIN#" .env

# Si los contenedores todavía no existen, los puertos tienen que estar libres.
port_free_or_ours() {
  local port="$1" container="$2"
  docker ps --format '{{.Names}}' | grep -qx "$container" && return 0
  ! ss -ltn 2>/dev/null | grep -q ":$port "
}
port_free_or_ours "$WEB_PORT" "$STACK-web" || die "El puerto $WEB_PORT ya lo usa otro proyecto. Cambiá WEB_PORT en .env"
port_free_or_ours "$MONGO_PORT" "$STACK-mongo" || die "El puerto $MONGO_PORT ya lo usa otro proyecto. Cambiá MONGO_PORT en .env"

say "Construyendo y levantando contenedores ($STACK)"
docker compose up -d --build --remove-orphans

say "Verificando"
ok=0
for _ in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:$WEB_PORT/api/v1/health" >/dev/null 2>&1; then ok=1; break; fi
  sleep 3
done
[ "$ok" = 1 ] || die "No responde en 127.0.0.1:$WEB_PORT. Logs: docker compose -f $APP_DIR/docker-compose.yml logs --tail 50"
echo "  OK: responde en 127.0.0.1:$WEB_PORT"

# Limpia solo imágenes viejas de ESTE proyecto (nunca un prune global)
docker image prune -f --filter "label=com.docker.compose.project=$STACK" >/dev/null || true

# ---------- Sitio en el nginx del VPS + HTTPS (solo la primera vez) ----------
if command -v nginx >/dev/null; then
  SITE="/etc/nginx/sites-available/$STACK"
  if [ ! -f "$SITE" ]; then
    say "Creando sitio de nginx para $DOMAIN"
    cat > "$SITE" <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 12m;

    location / {
        proxy_pass http://127.0.0.1:$WEB_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
    ln -sf "$SITE" "/etc/nginx/sites-enabled/$STACK"
    if nginx -t 2>/dev/null; then
      systemctl reload nginx
    else
      rm -f "/etc/nginx/sites-enabled/$STACK"
      die "La config de nginx falló; la desactivé para no afectar los otros sitios. Revisá $SITE"
    fi
  fi

  if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ] && command -v certbot >/dev/null; then
    say "Pidiendo certificado HTTPS para $DOMAIN"
    if certbot --nginx -d "$DOMAIN" --non-interactive --redirect --keep-until-expiring >/tmp/certbot-$STACK.log 2>&1; then
      echo "  HTTPS listo"
    else
      warn "No se pudo emitir el certificado (¿el DNS de $DOMAIN ya apunta a este VPS?)."
      warn "Se reintenta solo en el próximo deploy. Detalle: /tmp/certbot-$STACK.log"
    fi
  fi
else
  warn "No encontré nginx en el VPS: configurá el dominio para que apunte a 127.0.0.1:$WEB_PORT"
fi

say "Listo: https://$DOMAIN"
