# Aura Nails

## Estructura

- `public/reservar.html`: página pública para que un cliente reserve un turno.
- `public/gracias.html`: pantalla de confirmación.
- `public/aura.html`: información sobre Aura y sus redes.
- `public/disenios.html`: galería de diseños de uñas.
- `index.html`: portada con accesos a reservas, información y diseños.
- `admin/*.html`: panel administrativo, con gestión de servicios en `admin/servicios.html`.
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

Si el proyecto ya tenía las tablas y políticas creadas, volvé a ejecutar `supabase/schema.sql` para actualizar las políticas, agregar a los servicios descripción, duración e imagen demostrativa, permitir guardar el correo en las reservas, crear el bucket público de imágenes `servicios`, agregar a los turnos los campos de forma de pago y precio pagado, crear la tabla privada de fichas de clientes y habilitar el borrado administrativo de turnos. La reserva pública consulta los horarios ocupados mediante una función que no expone los datos personales del resto de las clientas. Después de ejecutar el esquema, el panel de Servicios permite cargar imágenes JPG, PNG o WebP de hasta 5 MB. La página Clientes solo mostrará las fichas agregadas manualmente por el administrador; reservar un turno no crea una ficha ni borrar una ficha elimina turnos. Desde Historial se pueden borrar turnos seleccionados (con confirmación); la economía mensual calcula ingresos solo con el precio pagado guardado al finalizar cada atención.

## Login admin por correo electrónico

1. En Supabase, abrir **Authentication > Users** y crear/invitar al usuario administrador con su correo y contraseña.
2. Si el correo del usuario no es `admin@aura-nails.local`, asignarle el rol desde **SQL Editor**, reemplazando el correo por el usado para iniciar sesión:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where lower(email) = lower('TU_CORREO');
```

3. Cerrar sesión y volver a ingresar desde `admin/login.html` con ese correo y contraseña. Si se acaba de asignar el rol, volver a iniciar sesión para que la nueva sesión lo incluya.

No asignar el rol desde `user_metadata` ni desde el navegador; usá `app_metadata` como en la consulta anterior.

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
3. En **Custom domain**, configurar `auranails.shop` y guardar.
  Con este workflow personalizado no hace falta un archivo `CNAME`; el dominio se configura en esta pantalla de Pages.
4. En el proveedor DNS del dominio (Hostinger), verificar que existan estos registros y eliminar cualquier registro A antiguo que apunte a otro proveedor:
  - A `@` -> `185.199.108.153`
  - A `@` -> `185.199.109.153`
  - A `@` -> `185.199.110.153`
  - A `@` -> `185.199.111.153`
  - CNAME `www` -> `not-tofi.github.io`
5. Subir los cambios a `main` y esperar a que termine el workflow **Deploy to GitHub Pages**.

La dirección principal del sitio será <https://auranails.shop/>. GitHub Pages puede tardar en detectar los cambios DNS y emitir el certificado HTTPS.

### Supabase en producción

GitHub Pages sólo aloja archivos estáticos; Supabase sigue siendo necesario para las reservas y el acceso administrativo. En **Authentication > URL Configuration** de Supabase, configurar:

- **Site URL:** `https://auranails.shop/`
- **Redirect URLs:** `https://auranails.shop/**` y `https://www.auranails.shop/**`

La clave `anon`/publishable usada por el navegador es pública. Nunca publicar una clave `service_role`; proteger los datos con Row Level Security (RLS) y políticas adecuadas en Supabase.
