# Aura Nails

## Estructura

- `public/reservar.html`: página pública para que un cliente reserve un turno.
- `public/gracias.html`: pantalla de confirmación.
- `public/aura.html`: información sobre Aura y sus redes.
- `public/disenios.html`: galería de diseños de uñas.
- `index.html`: portada con accesos a reservas, información y diseños.
- `admin/*.html`: panel administrativo.
- `supabase/schema.sql`: esquema de base de datos para Supabase.
- `assets/js/supabase-config.js`: configuración base para Supabase.

## Configuración de Supabase

1. Crear un proyecto en Supabase.
2. Ir a Project Settings > API.
3. Copiar la URL del proyecto y la anon key.
4. Reemplazar estos valores en `assets/js/supabase-config.js`:

```js
window.AURA_SUPABASE = {
  url: 'https://YOUR_PROJECT_REF.supabase.co',
  anonKey: 'YOUR_SUPABASE_ANON_KEY'
};
```

5. Ejecutar el SQL de `supabase/schema.sql` en el SQL editor de Supabase.

## Login admin

Crear una cuenta de administrador en Supabase Auth y usar ese correo para entrar al panel.

Ejemplo recomendado:

- email: `admin@aura-nails.local`
- contraseña: la que definas en Supabase Auth

## Importante

Esto está pensado para usar Supabase como base de verdad. Sin completar la configuración y la autenticación de Supabase, la app no puede guardar ni leer los turnos reales.

## Publicar en GitHub Pages

El workflow `.github/workflows/deploy-pages.yml` publica el sitio automáticamente cuando se actualiza la rama `main`, o manualmente desde la pestaña **Actions**. No hace falta instalar dependencias ni generar una compilación.

Para habilitarlo en GitHub:

1. Abrir **Settings > Pages** del repositorio.
2. En **Build and deployment**, elegir **GitHub Actions** como origen.
3. Subir los cambios a `main` y esperar a que termine el workflow **Deploy to GitHub Pages**.

Para este repositorio, la dirección del sitio será <https://not-tofi.github.io/aura2/>.

### Supabase en producción

GitHub Pages sólo aloja archivos estáticos; Supabase sigue siendo necesario para las reservas y el acceso administrativo. En **Authentication > URL Configuration** de Supabase, configurar:

- **Site URL:** `https://not-tofi.github.io/aura2/`
- **Redirect URLs:** `https://not-tofi.github.io/aura2/**`

La clave `anon`/publishable usada por el navegador es pública. Nunca publicar una clave `service_role`; proteger los datos con Row Level Security (RLS) y políticas adecuadas en Supabase.
