# Luna Rosa · app nativa (iPhone y Android)

Versión instalable de Luna Rosa, hecha con Expo (React Native). Incluye todo lo de la versión web y además:

- **Apple Salud (iPhone):** importa tus reglas y guarda allí los días de regla y el dolor (como «Calambres abdominales»).
- **Health Connect (Android):** importa tus reglas y guarda allí cada regla terminada.
- **Widgets de verdad** en la pantalla de inicio: pequeño (día del ciclo) y mediano (próxima regla).
- **Recordatorio con notificación** cuando tu regla suele llegar.
- **Lu**, el asistente, conectado a Claude a través de un pequeño servidor tuyo.

La conexión con Salud o Health Connect se activa en **Ajustes → Conectar con Salud / Health Connect**.

---

## Qué necesitas

| Qué | Para qué | Coste |
|---|---|---|
| **Node.js 20 o superior** en este Mac | Instalar dependencias y lanzar las compilaciones | Gratis |
| **Cuenta de Expo** (expo.dev) | Compilar la app en la nube, sin Xcode ni Android Studio | Gratis (plan gratuito con compilaciones limitadas al mes) |
| **Apple Developer Program** | Instalar la app en tu iPhone con Salud, widgets y App Groups | 99 $ al año |
| **Móvil Android 9 o superior** | En Android 14+ Health Connect viene incluido; en 9–13 se instala desde Google Play | Gratis |
| **Cuenta de Cloudflare** (opcional) | Servidor de Lu | Gratis para este uso |
| **Clave de la API de Claude** (opcional) | Que Lu responda con Claude (console.anthropic.com) | Pago por uso; preguntas cortas cuestan muy poco |

Sin servidor, Lu responde con unas preguntas frecuentes incluidas en la app.

No necesitas Xcode ni Android Studio: Expo compila en sus servidores. Solo harían falta para compilar en tu propio Mac.

---

## Paso a paso

### 1. Instalar Node.js

Descarga la versión LTS de https://nodejs.org e instálala. Comprueba en el Terminal:

```bash
node --version
```

### 2. Instalar las dependencias

Desde la carpeta `luna-rosa-app`:

```bash
npm install
```

```bash
npx expo install --fix
```

El segundo comando ajusta las versiones de las librerías a la versión de Expo instalada.

### 3. Entrar en Expo y crear el proyecto

```bash
npx eas-cli login
```

```bash
npx eas-cli init
```

`eas init` te da un **projectId**. Ponlo en `app.config.ts` (campo `extra.eas.projectId`) o como variable `EAS_PROJECT_ID`. Este proyecto ya está vinculado a `@paulbumb/luna-rosa`; si usas otra cuenta, cambia ese valor.

### 4. Rellenar tus datos en `eas.json`

En `build.base.env` (EAS no acepta valores vacíos: añade cada línea solo cuando tengas el dato):

- `BUNDLE_ID`: un identificador único, por ejemplo `com.tunombre.lunarosa`.
- `APPLE_TEAM_ID`: tu Team ID de Apple (developer.apple.com → Membership). Solo para iPhone.
- `EXPO_PUBLIC_ASSISTANT_URL`: la dirección de tu servidor de Lu (paso 7). Sin ella, Lu responde en el propio móvil.

### 5. Android: compilar e instalar

```bash
npx eas-cli build --platform android --profile preview
```

Al terminar, Expo te da un enlace a un archivo `.apk`. Ábrelo en el móvil e instálalo (Android pedirá permitir instalar apps de esa fuente).

Widgets: mantén pulsada la pantalla de inicio → Widgets → Luna Rosa.

### 6. iPhone: registrar el móvil, compilar e instalar

```bash
npx eas-cli device:create
```

Sigue el enlace desde tu iPhone para registrarlo. Después:

```bash
npx eas-cli build --platform ios --profile preview
```

Expo te pedirá entrar con tu cuenta de Apple y creará los certificados. Al terminar, abre el enlace en el iPhone para instalar la app. En iOS 16 o superior hay que activar **Ajustes → Privacidad y seguridad → Modo desarrollador**.

Widgets: mantén pulsada la pantalla de inicio → «+» → Luna Rosa.

### 7. (Opcional) Servidor de Lu con Claude

Desde la carpeta `server`:

```bash
npm install @anthropic-ai/sdk
```

```bash
npm install -D wrangler
```

```bash
npx wrangler login
```

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

```bash
npx wrangler deploy
```

`wrangler deploy` muestra la dirección del servidor (algo como `https://luna-rosa-assistant.tu-cuenta.workers.dev`). Ponla en `EXPO_PUBLIC_ASSISTANT_URL` (paso 4) y vuelve a compilar la app.

Para que solo tu app pueda usar el servidor, crea también `APP_TOKEN` con `npx wrangler secret put APP_TOKEN` y pon el mismo valor en `EXPO_PUBLIC_ASSISTANT_TOKEN`.

---

## Expo CLI y Expo Go (sin compilar)

Node.js, CocoaPods y el SDK de Android están instalados en tu carpeta de usuario (`~/.local` y `~/Library/Android/sdk`), fuera de la ruta de comandos de tu Terminal. Por eso un `npx` a secas da «command not found». El lanzador `expo.sh` los pone en la ruta solo mientras se ejecuta, sin cambiar tu configuración. Desde la carpeta `luna-rosa-app`:

```bash
./expo.sh
```

Arranca Expo CLI en modo Expo Go y muestra el QR. Teclas: `i` abre el simulador del iPhone, `a` el emulador de Android, `r` recarga, `s` cambia a la app de desarrollo. Otros comandos pasan tal cual:

```bash
./expo.sh login
```

```bash
./expo.sh start --dev-client
```

Para abrirla en tu móvil:

1. Instala **Expo Go** desde la App Store o Google Play (versión para Expo SDK 58).
2. Conecta el móvil a la **misma Wi-Fi** que este Mac.
3. Escanea el QR: en iPhone con la Cámara, en Android desde Expo Go. También tienes el QR en `expo-go-qr.png` (válido mientras el Mac tenga la IP `192.168.0.246`).

En Expo Go funciona todo menos lo que necesita la app instalada: la conexión con Salud / Health Connect y los widgets (los Ajustes lo indican). Liquid Glass aparece en iPhone con iOS 26 o posterior.

**Si prefieres usar `npx expo` directamente en cualquier Terminal**, añade Node a tu ruta de comandos. Este comando agrega una línea al final de `~/.zshrc`; abre una pestaña nueva del Terminal después:

```bash
echo 'export PATH="$HOME/.local/node/bin:$HOME/.local/bin:$PATH"' >> ~/.zshrc
```

## Ejecutar en Xcode (en este Mac)

Ya está preparado: Node está en `~/.local/node`, CocoaPods en `~/.local/bin/pod` y el proyecto de iOS en `ios/`.

1. Arranca el servidor de JavaScript desde la carpeta `luna-rosa-app`:

```bash
./expo.sh start --dev-client
```

2. Abre `ios/LunaRosa.xcworkspace` en Xcode (el `.xcworkspace`, no el `.xcodeproj`).
3. Elige el esquema **LunaRosa** y un simulador de iPhone, y pulsa ▶︎ (Run).

Si cambias `app.config.ts` o añades una librería nativa, vuelve a generar el proyecto:

```bash
PATH="$HOME/.local/bin:$HOME/.local/node/bin:$PATH" npx expo prebuild --platform ios --clean
```

Para instalarla en un iPhone real desde Xcode hace falta elegir tu equipo (Team) en **Signing & Capabilities** de los objetivos LunaRosa y LunaWidget.

## Android

El proyecto nativo de Android está en `android/`. En este Mac ya está instalado lo mínimo para compilarlo, sin la app Android Studio: el SDK en `~/Library/Android/sdk` (plataforma 37, NDK 27.1, CMake, emulador) y un emulador **LunaRosa_API36** (Pixel 8, Android 16). También puedes compilar en la nube con `npx eas-cli build --platform android` (paso 5).

1. Abre el emulador:

```bash
~/Library/Android/sdk/emulator/emulator -avd LunaRosa_API36
```

2. Compila e instala la app desde la carpeta `luna-rosa-app`:

```bash
./expo.sh run:android
```

La primera compilación tarda unos 10 minutos; las siguientes, mucho menos.

Ajustes pensados para Android:

- **Versión final más pequeña y rápida:** se eliminan el código y los recursos que no se usan (R8). Las librerías de Health Connect y de widgets se conservan enteras.
- **Menos permisos:** se quitan los de almacenamiento y superposición que Expo añade por defecto. Quedan solo notificaciones, vibración, Internet (para Lu) y la regla en Health Connect.
- **Icono temático** (Android 13+) y **modo oscuro del sistema**.
- **Sombras y degradados nativos**, sin las sombras grises de Android sobre tarjetas translúcidas.
- **Vibración del sistema** (sigue los ajustes de vibración del móvil) y efecto de onda al tocar los días.
- **Pantalla de borde a borde**, teclado que no tapa los campos y giro de pantalla sin reiniciar la app.
- **Widgets** que se actualizan cada 3 horas (y al abrir la app) para gastar menos batería.

## Cómo funciona la conexión con salud

- **Al conectar**, la app pide permiso e importa las reglas del último año que no choquen con las que ya tienes.
- **Después**, cada vez que registras algo, lo guarda en Salud / Health Connect. Lleva la cuenta de lo ya guardado para no duplicarlo, y lo que importa nunca lo vuelve a escribir.
- **Una vez al día**, al abrir la app, importa reglas nuevas que hayas registrado en otras apps.
- **Si quitas una regla en Luna Rosa**, no se borra de Salud / Health Connect: bórrala allí si quieres.
- **En Android** solo se guarda una regla cuando la marcas como terminada, para no tener que editarla luego.

## Estructura

```
app/                 pantallas (Hoy, Calendario, Guía, Lu, día, ajustes)
src/cycle.ts         aprende tu ciclo de tus registros y calcula previsiones
src/store.tsx        guarda los datos en el móvil y sincroniza widgets, recordatorio y salud
src/health/          Apple Salud (ios.ts) y Health Connect (android.ts)
src/widgets/         widgets de Android y datos compartidos con el widget de iPhone
targets/widget/      widget de iPhone (SwiftUI)
server/              servidor de Lu (Cloudflare Worker + API de Claude)
```

## Diseño «Pétalo»

- **Colores:** rosa pastel como color principal sobre un fondo rubor, con melocotón, lila y menta para las fases del ciclo; frambuesa para los botones y el texto destacado. Hay versión oscura de todo.
- **Formas:** la forma de pétalo (dos esquinas muy redondeadas y dos más cerradas) en la tarjeta principal, las insignias, los días de la semana, el selector de dolor y la pestaña elegida.
- **Letra:** Fraunces (serif suave) para títulos y números, y su cursiva para «Luna Rosa»; Nunito para el texto.
- **Rendimiento:** superficies opacas con una sola sombra, sin capas translúcidas, brillos ni degradados apilados; el anillo del ciclo se dibuja una vez, sin animaciones; los chips no crean animaciones propias; y todas las pantallas comparten una sola copia de los datos. Está en `src/theme.ts` y `src/components/ui.tsx`.

## Lo que se ha probado

- **iPhone (simulador, iOS 26, Xcode 27.1):** compila y funciona con el diseño «Pétalo» y la barra de pestañas nativa de Liquid Glass; widgets en la galería del sistema (pequeño, mediano y grande).
- **Android (emulador Pixel 8, Android 16):** compila y funciona con el diseño «Pétalo»: inicio, calendario, registro del día, Ajustes con la galería de widgets e iconos, widgets en la pantalla de inicio en claro y oscuro, y el icono Cristal.
- **Lu sin conexión:** `npm run test:lu` le hace 120 preguntas reales (con sinónimos como «periodo» o «menstruación», faltas como «q» o «kuando», dos preguntas a la vez, seguimientos como «¿y qué más?» o «¿es grave?», y frases para apuntar la regla) y comprueba que entiende todas las sugerencias que ofrece. En el emulador de Android: respuestas, botón «Apuntar inicio hoy» y faltas de ortografía.
- **Sin probar:** la app dentro de Expo Go (el código está preparado, pero no la he abierto en Expo Go), un móvil real, el iPad, la conexión con Salud y Health Connect, los widgets en la pantalla de bloqueo, las notificaciones y el servidor de Lu con Claude.

## Widgets

- **Android (8):** Día (con la fase, lo que falta y una barra de fases), Anillo de fases, Cuenta atrás con la fecha (2×2, también en la pantalla de bloqueo de Android 16), Próxima regla (ventana, ovulación y ciclo), Fase (con la fase siguiente), Semana (regla, prevista, ovulación y tu registro de hoy), Tus datos (4×2) y Registro rápido (4×1, con lo que registraste hoy y un botón que abre el registro). Tienen versión clara y oscura, usan las fuentes de la app y se actualizan al cambiar algo y cada hora. Se dibujan en `src/widgets/AndroidWidgets.tsx`; en Ajustes hay una galería con un botón «Añadir» para cada uno.
- **iPhone (6):** Día y próxima regla (pequeño, mediano y grande con anillo, semana y tus datos), Anillo de fases, Cuenta atrás (también en la pantalla de bloqueo: círculo, rectángulo y línea), Fase, Semana y Tus datos. Siguen el modo claro, oscuro y tintado. Están en `targets/widget/` (`Model.swift` calcula los datos y `index.swift` los dibuja).
- Los dos usan la misma lógica que `src/widgets/snapshot.ts`: el día, la fase, la cuenta atrás, la fase siguiente y la semana se calculan al dibujar, así que siguen bien aunque no abras la app.

## Icono de la app

- **iOS 26 o posterior:** `assets/LunaRosa.icon` es un icono por capas de Icon Composer (fondo, orbe de cristal, luna y destello). El sistema genera a partir de él las versiones Liquid Glass clara, oscura, transparente y tintada. Para editarlo, ábrelo con Icon Composer, que viene con Xcode.
- **Estilos para Android:** Ajustes → Icono de la app: Clásico, Cristal (cristal esmerilado), Noche, Perla, Atardecer y Lavanda. Todos son iconos adaptables con capa monocroma para los iconos temáticos. Se dibujan con el mismo script (`assets/icons/`) y los registra `plugins/withAndroidIconStyles.js`.
- **Android y versiones anteriores de iOS:** los PNG de `assets/` (`icon.png`, `adaptive-icon*.png`) simulan un cristal ligero. Se generan con `swift scripts/make-icons.swift assets`.

## iPhone sin pagar: AltStore

`dist-ios/LunaRosa.ipa` es la app para iPhone, con el código JavaScript incluido: no necesita Expo Go ni el Mac para funcionar. AltStore la firma con tu Apple ID gratuito y la renueva antes de que caduquen los 7 días.

Para generarla de nuevo después de cambiar algo:

```bash
xcodebuild -workspace ios/LunaRosa.xcworkspace -scheme LunaRosa -configuration Release -sdk iphoneos -destination generic/platform=iOS -derivedDataPath ios/build-device CODE_SIGNING_ALLOWED=NO build
```

Después, firma la app ad hoc con `ios/LunaRosa/LunaRosa.entitlements` (sin `aps-environment`), firma el widget con `ios/.targets/LunaWidget/generated.entitlements` y comprime `Payload/LunaRosa.app` en `LunaRosa.ipa`.

## Versión web (PWA)

`npm run build:pwa` genera la PWA en `dist/` (`scripts/build-pwa.js`). Se publica en GitHub Pages con `.github/workflows/pwa.yml`; los pasos están en [PUBLICAR-PWA.md](PUBLICAR-PWA.md).
