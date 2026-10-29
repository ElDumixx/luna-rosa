# Publicar Luna Rosa como PWA en GitHub Pages

La PWA es la app en versión web: se abre desde Safari y, añadida a la pantalla de inicio,
funciona a pantalla completa como una app, también sin conexión. Tus datos se guardan solo
en ese navegador del móvil.

Lo que la PWA **no** tiene (son cosas nativas del iPhone/Android): widgets, Salud / Health Connect,
recordatorios con notificación, estilos de icono y vibración.

## 1. Crea el repositorio
1. Entra en https://github.com → botón **New** (nuevo repositorio).
2. Nombre: `luna-rosa` (la dirección será `https://TU_USUARIO.github.io/luna-rosa/`).
3. Puede ser **Public**. No marques “Add a README”. Pulsa **Create repository**.

## 2. Sube el proyecto
En la Terminal, dentro de la carpeta `luna-rosa-app`:

```bash
git init -b main
git add .
git commit -m "Luna Rosa"
git remote add origin https://github.com/TU_USUARIO/luna-rosa.git
git push -u origin main
```

(La primera vez GitHub te pedirá iniciar sesión. Las carpetas `ios/`, `android/`, `node_modules/`
y los `.apk`/`.ipa` no se suben: están en `.gitignore`.)

## 3. Activa GitHub Pages
1. En el repositorio: **Settings → Pages**.
2. En **Source** elige **GitHub Actions**.
3. Ve a la pestaña **Actions**: verás “Publicar PWA” en marcha (2–4 min). Si no arrancó,
   ábrelo y pulsa **Run workflow**.
4. Cuando salga en verde, tu app está en `https://TU_USUARIO.github.io/luna-rosa/`.

## 4. Instálala en el iPhone
1. Abre la dirección en **Safari**.
2. Botón **Compartir** → **Añadir a pantalla de inicio** → **Añadir**.
3. Ábrela desde el icono de Luna Rosa: se ve a pantalla completa, como una app.

(En Android: Chrome → menú ⋮ → **Instalar app**.)

## Actualizarla
Cada vez que cambies algo y hagas `git push`, se vuelve a publicar sola. En el móvil, cierra y
abre la app (a veces dos veces) para recibir la versión nueva.

## Probarla en tu Mac antes de publicar
```bash
EXPO_BASE_URL=/luna-rosa npm run build:pwa
```
Genera la PWA en `dist/` (es lo mismo que hace GitHub).
