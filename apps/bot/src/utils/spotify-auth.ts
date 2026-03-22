import express from "express";
import logger from "./logger";

// Interface para la respuesta de tokens de Spotify
interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token: string;
  error?: string;
  error_description?: string;
}

const app = express();
const PORT = 3000;

// URL de autorización de Spotify
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = "http://127.0.0.1:3000/callback";

// Generar URL de autorización
export function getAuthUrl(): string {
  if (!CLIENT_ID) {
    throw new Error("SPOTIFY_CLIENT_ID no está configurado en .env");
  }

  const scopes = "user-read-private user-read-email"; // Scopes mínimos
  const authUrl =
    `https://accounts.spotify.com/authorize?` +
    `client_id=${CLIENT_ID}&` +
    `response_type=code&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `scope=${encodeURIComponent(scopes)}`;

  return authUrl;
}

// Endpoint para manejar el callback
app.get("/callback", async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    logger.error("Error en autorización de Spotify", { error });
    res.send(`❌ Error: ${error}`);
    return;
  }

  if (!code) {
    logger.error("No se recibió código de autorización");
    res.send("❌ No authorization code received");
    return;
  }

  try {
    logger.info("Intercambiando código por tokens...");

    // Intercambiar código por tokens
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code as string,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const tokens = (await response.json()) as SpotifyTokenResponse;

    if (tokens.error) {
      logger.error("Error obteniendo tokens", {
        error: tokens.error_description,
      });
      res.send(`❌ Error getting tokens: ${tokens.error_description}`);
      return;
    }

    logger.info("✅ Tokens obtenidos exitosamente");

    // Mostrar los tokens (incluye refresh_token)
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Spotify Auth - CharlyBot</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
          .success { color: #28a745; }
          .token { background: #f8f9fa; padding: 15px; border-radius: 5px; word-break: break-all; }
          .env-example { background: #343a40; color: #fff; padding: 15px; border-radius: 5px; }
          .warning { color: #dc3545; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>🎉 ¡Autorización exitosa!</h1>

        <div class="success">
          <h2>✅ Tokens obtenidos correctamente</h2>
        </div>

        <h3>🔑 Tu Refresh Token:</h3>
        <div class="token">
          <code>${tokens.refresh_token}</code>
        </div>

        <h3>📝 Agrega esto a tu archivo .env:</h3>
        <div class="env-example">
          <code>SPOTIFY_REFRESH_TOKEN=${tokens.refresh_token}</code>
        </div>

        <div class="warning">
          <h3>⚠️ Importante:</h3>
          <ul>
            <li>Copia el REFRESH_TOKEN a tu archivo .env</li>
            <li>Reinicia tu bot después de agregar el token</li>
            <li>Este token no expira, pero manténlo seguro</li>
            <li>Ya puedes cerrar esta ventana</li>
          </ul>
        </div>

        <h3>ℹ️ Información adicional:</h3>
        <ul>
          <li><strong>Access Token:</strong> ${tokens.access_token.substring(0, 20)}... (temporal)</li>
          <li><strong>Expires in:</strong> ${tokens.expires_in} segundos</li>
          <li><strong>Token Type:</strong> ${tokens.token_type}</li>
          <li><strong>Scope:</strong> ${tokens.scope}</li>
        </ul>

        <p><em>El servidor se cerrará automáticamente en 30 segundos...</em></p>
      </body>
      </html>
    `);

    console.log("\n🎉 ¡REFRESH TOKEN OBTENIDO!");
    console.log("📋 Copia esto a tu .env:");
    console.log(`SPOTIFY_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log("");

    // Cerrar servidor automáticamente después de 30 segundos
    setTimeout(() => {
      logger.info("🔄 Cerrando servidor de autorización...");
      process.exit(0);
    }, 30000);
  } catch (error) {
    logger.error("Error en el proceso de autorización", { error });
    res.send(
      `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
});

// Endpoint raíz con instrucciones
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Spotify Auth - CharlyBot</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        .auth-button {
          background: #1db954; color: white; padding: 15px 30px;
          text-decoration: none; border-radius: 25px; display: inline-block;
          font-weight: bold; margin: 20px 0;
        }
        .auth-button:hover { background: #1ed760; }
      </style>
    </head>
    <body>
      <h1>🎵 Autorización de Spotify - CharlyBot</h1>
      <p>Para obtener tu refresh token de Spotify, haz clic en el botón de abajo:</p>

      <a href="${getAuthUrl()}" class="auth-button">
        🔗 Autorizar con Spotify
      </a>

      <h3>📋 ¿Qué va a pasar?</h3>
      <ol>
        <li>Te redirigirá a Spotify para iniciar sesión</li>
        <li>Spotify te pedirá autorizar la aplicación</li>
        <li>Serás redirigido de vuelta aquí con tu token</li>
        <li>Copiarás el token a tu archivo .env</li>
      </ol>

      <p><em>Asegúrate de tener configurado SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET en tu .env</em></p>
    </body>
    </html>
  `);
});

export function startAuthServer(): void {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    logger.error("❌ Faltan credenciales de Spotify");
    console.log("");
    console.log("❌ Error: Faltan credenciales de Spotify en .env");
    console.log("📋 Asegúrate de tener:");
    console.log("   SPOTIFY_CLIENT_ID=tu_client_id");
    console.log("   SPOTIFY_CLIENT_SECRET=tu_client_secret");
    console.log("");
    return;
  }

  const server = app.listen(PORT, "127.0.0.1", () => {
    console.log("");
    console.log("🚀 Servidor de autorización iniciado");
    console.log(`📍 URL: http://127.0.0.1:${PORT}`);
    console.log("");
    console.log("📋 Pasos para obtener tu refresh token:");
    console.log("1. Abre tu navegador en: http://127.0.0.1:3000");
    console.log('2. Haz clic en "Autorizar con Spotify"');
    console.log("3. Inicia sesión en Spotify si es necesario");
    console.log("4. Autoriza la aplicación");
    console.log("5. Copia el REFRESH_TOKEN a tu .env");
    console.log("");
    console.log("🔗 O abre directamente: " + getAuthUrl());
    console.log("");
  });

  // Manejar cierre del servidor
  process.on("SIGINT", () => {
    logger.info("🛑 Cerrando servidor de autorización...");
    server.close();
    process.exit(0);
  });
}
