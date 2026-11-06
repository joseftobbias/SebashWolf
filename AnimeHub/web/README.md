# Anime Hub Web (Versión Personal)

Este es el código fuente del sitio web personal de **Anime Hub**, creado con HTML5, CSS3, JavaScript y Node.js (Express).

## 🚀 Requisitos Previos

- Tener instalado [Node.js](https://nodejs.org/) (versión 16 o superior).

## 🛠️ Cómo Ejecutar el Sitio Web

1. Abre una consola de comandos / terminal en la carpeta `web`:
   ```bash
   cd "C:/Users/Ali/Desktop/NUEVO PROJECTO/projecto youtube/SebashWolf/AnimeHub/web"
   ```

2. Instala las dependencias necesarias:
   ```bash
   npm install
   ```

3. Inicia el servidor local:
   ```bash
   npm start
   ```

4. Abre tu navegador web favorito e ingresa a:
   ```
   http://localhost:3000
   ```

## 📱 Conectar con la App Android (Opcional)

Si deseas que tu aplicación de Android (Anime Hub) cargue esta web personal en lugar de la web externa:

1. Abre el archivo `AppConfig.kt` de la App Android (`app/src/main/java/com/animehub/app/AppConfig.kt`).
2. Cambia `BASE_URL` a la URL de tu servidor local (o dirección IP local si pruebas en un dispositivo físico, ej. `http://192.168.1.X:3000/`).
