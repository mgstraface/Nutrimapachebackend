# NutriMapache 🦝

PWA para iPhone que acompaña hábitos alimentarios sin culpa, con un mapache que celebra y acompaña. Multiusuario: cada persona crea su cuenta y arma su perfil (comidas del día, rutina, objetivo, qué números ver).

## Estructura

```
apps/web         React + Vite (PWA, mobile-first)
apps/api         Node + Express + MongoDB
packages/shared  Esquemas Zod, plantillas de perfil, lógica del mapache
docker/          Caddyfile (HTTPS + estáticos + proxy a la API)
```

## Desarrollo

```bash
npm install
docker compose -f docker-compose.dev.yml up -d   # Mongo local
cp .env.example .env
npm run dev                                      # API :4000 + web :5173
```

Para probar en el iPhone: abrir `http://<ip-de-tu-compu>:5173` en Safari desde la misma red.

## Producción (VPS)

Corre en el mismo VPS que Casa Roma y el robot. El nginx del VPS es el único que atiende los dominios y el HTTPS; cada proyecto publica sus contenedores solo en `127.0.0.1`, en puertos propios.

| Proyecto | Carpeta en el VPS | Web | Mongo |
|---|---|---|---|
| Robot (prod) | `/root/robot` | `127.0.0.1:8090` | `127.0.0.1:27020` |
| Robot (pruebas) | `/root/robot-dev` | `127.0.0.1:8091` | `127.0.0.1:27021` |
| NutriMapache | `/root/nutrimapache/app` | `127.0.0.1:8092` | `127.0.0.1:27022` |
| Casa Roma | `/root/casa_roma` | — | — |

Primera vez, en el VPS:

```bash
git clone git@github.com:mgstraface/Nutrimapachebackend.git /root/nutrimapache/app
bash /root/nutrimapache/app/scripts/deploy-vps.sh   # crea el .env y se frena
nano /root/nutrimapache/app/.env                    # completar DOMAIN
bash /root/nutrimapache/app/scripts/deploy-vps.sh   # levanta, crea el sitio de nginx y pide HTTPS
```

Después, cada push a `main` despliega solo (`.github/workflows/deploy.yml`). Secrets del repo: `VPS_HOST`, `VPS_PORT`, `VPS_USER` y `VPS_SSH_KEY`, con una **clave SSH nueva y propia** de este proyecto, restringida en `authorized_keys` del VPS:

```
command="bash /root/nutrimapache/app/scripts/deploy-vps.sh",no-port-forwarding,no-agent-forwarding,no-pty ssh-ed25519 AAAA... nutrimapache-deploy
```

No reusar la clave del robot ni la de Casa Roma: una clave con `command=` corre siempre ese script, sin importar qué repo la use.

En el iPhone: Safari → Compartir → **Agregar a inicio**.

## Estado

- **Fase 1 (esta):** interfaz, mapache con 5 expresiones, onboarding con plantillas, registro manual de comidas guardado en el teléfono, historial, exportar y borrar.
- **Fase 2:** cuentas en la API, comidas en Mongo, catálogo de alimentos con rangos, fotos sin análisis, admin de usuarios.
- **Fase 3:** menú semanal, recetas, entrenamiento.
- **Fase 4:** análisis de fotos con IA, solo con consentimiento.
- **Fase 5:** deploy y backups.

## Principios

Ninguna comida es buena o mala. Sin puntos, rachas ni sanciones. Toda estimación es un rango con su confianza. Fotos y datos no salen del servidor sin consentimiento. Las claves de API viven solo en el backend.
