# Aura Nails

## Estructura

- `public/reservar.html`: página pública para que un cliente reserve un turno.
- `public/gracias.html`: pantalla de confirmación.
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

## Login demo admin

- usuario: `admin`
- contraseña: `admin123`

## Importante

Esto ya está conectado para usar una base compartida de Supabase. Sin completar la configuración de Supabase, la app no puede guardar ni leer los turnos reales.
