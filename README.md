# DevDesdeCero · sitio web

Sitio público de DevDesdeCero: planeación, diseño y desarrollo web. Bilingüe (`/` español, `/en/` inglés).

- **Astro** (sitio estático, sin frameworks en el navegador)
- **Supabase**: formulario de contacto anti-spam, analítica propia y textos editables
- **GitHub Pages**: se publica solo al hacer push a `main`

## Desarrollo local

```bash
cp .env.example .env   # pon la URL y la clave publicable de Supabase
npm install
npm run dev
```

## Supabase

La base de datos está en `supabase/migrations/`. Todo lo público pasa por tres funciones:

| Función | Para qué |
| --- | --- |
| `submit_lead` | Guarda un mensaje del formulario. Valida datos, bloquea bots (campo oculto + tiempo mínimo) y limita envíos por correo/IP (1 por minuto, 5 por día). |
| `track_event` | Registra visitas y contactos (una visita por sesión cada 30 min). |
| `get_site_content` | Devuelve textos editables, correo y redes. |

Las tablas tienen RLS sin políticas públicas: nadie puede leerlas desde el navegador.

**Dónde ver las cosas** (panel de Supabase → Table Editor / SQL):

- Mensajes: tabla `leads` (columna `status` para darles seguimiento)
- Visitas por día: `select * from site_stats;`
- Redes y correo: tabla `site_settings`
- Textos: tabla `site_texts`. Ejemplo para cambiar el subtítulo del inicio:
  ```sql
  insert into site_texts (key, lang, value) values ('hero_sub', 'es', 'Tu nuevo texto')
  on conflict (key, lang) do update set value = excluded.value, updated_at = now();
  ```
  Cualquier elemento con `data-edit="clave"` se puede editar así.

## Publicación

En GitHub: **Settings → Pages → Source: GitHub Actions**, y en **Settings → Secrets and variables → Actions → Variables** agrega:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Son claves públicas. La `service_role` nunca va en el repositorio ni en GitHub.

Con dominio propio, agrega el archivo `public/CNAME` con el dominio.
