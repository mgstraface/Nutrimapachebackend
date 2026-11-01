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

```bash
cp .env.example .env    # completar DOMAIN y JWT_SECRET
docker compose up -d --build
```

Caddy saca el certificado HTTPS solo. En el iPhone: Safari → Compartir → **Agregar a inicio**.

## Estado

- **Fase 1 (esta):** interfaz, mapache con 5 expresiones, onboarding con plantillas, registro manual de comidas guardado en el teléfono, historial, exportar y borrar.
- **Fase 2:** cuentas en la API, comidas en Mongo, catálogo de alimentos con rangos, fotos sin análisis, admin de usuarios.
- **Fase 3:** menú semanal, recetas, entrenamiento.
- **Fase 4:** análisis de fotos con IA, solo con consentimiento.
- **Fase 5:** deploy y backups.

## Principios

Ninguna comida es buena o mala. Sin puntos, rachas ni sanciones. Toda estimación es un rango con su confianza. Fotos y datos no salen del servidor sin consentimiento. Las claves de API viven solo en el backend.
