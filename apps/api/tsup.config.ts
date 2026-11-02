import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  // El paquete compartido es TypeScript sin compilar: va dentro del bundle.
  // El resto de las dependencias (express, mongoose, zod…) quedan externas y se instalan en la imagen.
  noExternal: ['@nutrimapache/shared'],
});
