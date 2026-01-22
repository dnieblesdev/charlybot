import dotenv from "dotenv";
import playdl from "play-dl";
import logger from "../src/utils/logger";

// Cargar variables de entorno
dotenv.config();

console.log("🔧 Test de Diagnóstico - Error de Formato");
console.log("=========================================");
console.log("");

// URLs problemáticas conocidas
const testUrls = [
  "https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh", // Shape of You
  "https://open.spotify.com/track/7qiZfU4dY1lWllzX7mPBI3", // Blinding Lights
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ", // Rick Roll
];

async function initializePlayDl() {
  console.log("🚀 Inicializando play-dl...");

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!clientId || !clientSecret) {
    console.log("❌ Faltan credenciales de Spotify");
    return false;
  }

  try {
    await playdl.setToken({
      spotify: {
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken || "",
        market: "US",
      },
    });
    console.log("✅ play-dl inicializado correctamente");
    return true;
  } catch (error) {
    console.log("❌ Error inicializando play-dl:", error);
    return false;
  }
}

async function testUrlValidation(url: string) {
  console.log(`\n📎 Validando: ${url}`);

  try {
    // Test si es Spotify
    if (url.includes("spotify.com")) {
      const validation = playdl.sp_validate(url);
      console.log(`   Spotify validation: ${validation}`);

      if (validation === "track") {
        console.log("   📥 Obteniendo info de Spotify...");
        const spotifyInfo = await playdl.spotify(url);
        console.log(`   ✅ Spotify: ${spotifyInfo.name} - ${spotifyInfo.artists?.[0]?.name}`);

        // Buscar en YouTube
        const searchQuery = `${spotifyInfo.name} ${spotifyInfo.artists?.[0]?.name || ""}`;
        console.log(`   🔍 Buscando: "${searchQuery}"`);

        const searchResult = await playdl.search(searchQuery, {
          limit: 1,
          source: { youtube: "video" },
        });

        if (searchResult.length > 0) {
          const video = searchResult[0];
          console.log(`   🎬 YouTube encontrado: ${video.title}`);
          return video.url;
        } else {
          throw new Error("No se encontró en YouTube");
        }
      }
    }

    // Si es YouTube directo
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      console.log("   🎬 URL de YouTube directa");
      return url;
    }

    throw new Error("URL no soportada");
  } catch (error) {
    console.log(`   ❌ Error en validación: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function testStreamCreation(url: string, method: "stream" | "stream_from_info" = "stream") {
  console.log(`\n🎵 Probando ${method} con: ${url}`);

  try {
    let streamInfo;

    if (method === "stream") {
      // Método directo
      console.log("   📡 Usando playdl.stream()...");
      streamInfo = await playdl.stream(url, { quality: 1 });
    } else {
      // Método con info
      console.log("   📋 Obteniendo video info...");
      const videoInfo = await playdl.video_info(url);

      console.log("   📊 Video info obtenida:");
      console.log(`      Título: ${videoInfo.video_details?.title || "N/A"}`);
      console.log(`      Duración: ${videoInfo.video_details?.durationInSec || "N/A"}s`);
      console.log(`      Formats disponibles: ${videoInfo.format?.length || 0}`);

      // Validar que formats existe y tiene contenido
      if (!videoInfo.format || videoInfo.format.length === 0) {
        throw new Error("❌ No hay formatos disponibles (format.length = 0)");
      }

      console.log("   📡 Usando playdl.stream_from_info()...");
      streamInfo = await playdl.stream_from_info(videoInfo);
    }

    // Validar resultado del stream
    if (!streamInfo) {
      throw new Error("Stream info es null");
    }

    if (!streamInfo.stream) {
      throw new Error("Stream.stream es null");
    }

    console.log("   ✅ Stream creado exitosamente");
    console.log(`      Type: ${streamInfo.type || "unknown"}`);
    console.log(`      Quality: ${streamInfo.quality || "unknown"}`);
    console.log(`      Stream readable: ${streamInfo.stream.readable}`);

    // Limpiar
    streamInfo.stream.destroy();
    console.log("   🧹 Stream cerrado");

    return true;
  } catch (error) {
    console.log(`   ❌ Error creando stream: ${error instanceof Error ? error.message : String(error)}`);

    // Diagnóstico específico del error
    if (error instanceof Error) {
      if (error.message.includes("format.length")) {
        console.log("   🚨 ERROR DETECTADO: format.length undefined");
        console.log("   💡 Causa probable: video_info no devolvió formatos válidos");
      } else if (error.message.includes("Cannot read properties")) {
        console.log("   🚨 ERROR DETECTADO: Propiedades undefined");
        console.log("   💡 Causa probable: Objeto de video info incompleto");
      } else if (error.message.includes("sign")) {
        console.log("   🚨 ERROR DETECTADO: Problema de signatura de YouTube");
        console.log("   💡 Causa probable: URL expirada o bloqueada");
      }
    }

    return false;
  }
}

async function testAlternativeMethods(url: string) {
  console.log(`\n🔄 Probando métodos alternativos para: ${url}`);

  const methods = [
    { name: "stream directo", method: "stream" as const },
    { name: "stream_from_info", method: "stream_from_info" as const },
  ];

  const results: boolean[] = [];

  for (const { name, method } of methods) {
    console.log(`\n📋 Método: ${name}`);
    const success = await testStreamCreation(url, method);
    results.push(success);

    // Pausa entre métodos para evitar rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n📊 Resultados para ${url}:`);
  methods.forEach(({ name }, index) => {
    console.log(`   ${results[index] ? '✅' : '❌'} ${name}`);
  });

  return results;
}

async function diagnosticFormatError() {
  console.log("\n🔍 DIAGNÓSTICO ESPECÍFICO DEL ERROR format.length");
  console.log("================================================");

  const testUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

  try {
    console.log("📋 Paso 1: Obtener video_info sin usar stream_from_info");
    const videoInfo = await playdl.video_info(testUrl);

    console.log("\n📊 Análisis de video_info:");
    console.log(`   videoInfo existe: ${!!videoInfo}`);
    console.log(`   videoInfo.format existe: ${!!videoInfo.format}`);
    console.log(`   videoInfo.format es array: ${Array.isArray(videoInfo.format)}`);
    console.log(`   videoInfo.format.length: ${videoInfo.format?.length || 'undefined'}`);

    if (videoInfo.format && Array.isArray(videoInfo.format)) {
      console.log(`   Primer formato disponible: ${!!videoInfo.format[0]}`);
      if (videoInfo.format[0]) {
        console.log(`   Formato 0 - quality: ${videoInfo.format[0].quality || 'N/A'}`);
        console.log(`   Formato 0 - url existe: ${!!videoInfo.format[0].url}`);
      }
    }

    console.log("\n📋 Paso 2: Inspeccionar estructura completa");
    const keys = Object.keys(videoInfo);
    console.log(`   Propiedades principales: ${keys.join(", ")}`);

    if (videoInfo.video_details) {
      console.log("   ✅ video_details disponible");
      console.log(`   Título: ${videoInfo.video_details.title}`);
    } else {
      console.log("   ❌ video_details no disponible");
    }

    // Intentar método seguro
    console.log("\n📋 Paso 3: Método de stream seguro");
    if (videoInfo.format && videoInfo.format.length > 0) {
      console.log("   ✅ Formatos disponibles, intentando stream_from_info");
      const stream = await playdl.stream_from_info(videoInfo);
      console.log("   ✅ Stream creado sin errores");
      stream.stream?.destroy();
    } else {
      console.log("   ❌ No hay formatos, usando método directo");
      const stream = await playdl.stream(testUrl);
      console.log("   ✅ Stream directo creado");
      stream.stream?.destroy();
    }

  } catch (error) {
    console.log("\n💥 Error en diagnóstico detallado:");
    console.log(`   Mensaje: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.log(`   Stack: ${error.stack.split('\n')[1]}`); // Solo primera línea del stack
    }
  }
}

async function runAllDiagnostics() {
  console.log("⏰ Iniciando diagnósticos completos...");

  // Inicializar
  const initialized = await initializePlayDl();
  if (!initialized) {
    console.log("💥 No se pudo inicializar play-dl");
    return;
  }

  // Test de validación y conversión
  console.log("\n📋 FASE 1: Validación y conversión de URLs");
  console.log("==========================================");

  const validUrls: string[] = [];
  for (const url of testUrls) {
    const validUrl = await testUrlValidation(url);
    if (validUrl) {
      validUrls.push(validUrl);
    }
    // Pausa entre requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Test de métodos de stream
  console.log("\n📋 FASE 2: Test de métodos de streaming");
  console.log("=====================================");

  for (const url of validUrls.slice(0, 2)) { // Solo primeras 2 para no sobrecargar
    await testAlternativeMethods(url);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Diagnóstico específico del error
  await diagnosticFormatError();

  console.log("\n📊 RESUMEN DE DIAGNÓSTICOS");
  console.log("=========================");
  console.log("✅ Si todos los métodos pasan: play-dl está funcionando correctamente");
  console.log("❌ Si hay errores de format.length: usar método directo playdl.stream()");
  console.log("🔄 Si hay errores intermitentes: implementar retry con fallbacks");
  console.log("");
  console.log("💡 RECOMENDACIONES:");
  console.log("   1. Usa playdl.stream() directamente cuando sea posible");
  console.log("   2. Solo usa stream_from_info() si necesitas metadata específica");
  console.log("   3. Implementa timeouts y retry logic");
  console.log("   4. Valida siempre que format existe antes de usarlo");
}

// Ejecutar diagnósticos
runAllDiagnostics().catch((error) => {
  console.error("💥 Error fatal en diagnósticos:", error);
  process.exit(1);
});
