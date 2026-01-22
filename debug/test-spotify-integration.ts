import dotenv from "dotenv";
import playdl from "play-dl";
import logger from "../src/utils/logger";

// Cargar variables de entorno
dotenv.config();

console.log("🎵 Test de Integración Spotify - CharlyBot");
console.log("=========================================");
console.log("");

// URLs de prueba
const testUrls = [
  {
    name: "Track individual",
    url: "https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh", // Shape of You - Ed Sheeran
    type: "track",
  },
  {
    name: "Track popular",
    url: "https://open.spotify.com/track/7qiZfU4dY1lWllzX7mPBI3", // Blinding Lights - The Weeknd
    type: "track",
  },
  {
    name: "Playlist pequeña",
    url: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M", // Today's Top Hits (ejemplo)
    type: "playlist",
  },
];

async function initializeSpotify(): Promise<boolean> {
  console.log("🔧 Inicializando configuración de Spotify...");

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

  console.log("📋 Verificando credenciales:");
  console.log(`   CLIENT_ID: ${clientId ? "✅ Configurado" : "❌ Faltante"}`);
  console.log(
    `   CLIENT_SECRET: ${clientSecret ? "✅ Configurado" : "❌ Faltante"}`,
  );
  console.log(
    `   REFRESH_TOKEN: ${refreshToken ? "✅ Configurado" : "❌ Faltante"}`,
  );
  console.log("");

  if (!clientId || !clientSecret) {
    console.log("❌ Error: Faltan credenciales básicas de Spotify");
    return false;
  }

  try {
    console.log("🚀 Configurando play-dl...");

    await playdl.setToken({
      spotify: {
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken || "",
        market: "US",
      },
    });

    console.log("✅ play-dl configurado exitosamente");
    return true;
  } catch (error) {
    console.log("❌ Error configurando play-dl:", error);
    return false;
  }
}

async function testSpotifyValidation() {
  console.log("🔍 Test 1: Validación de URLs");
  console.log("-----------------------------");

  for (const test of testUrls) {
    console.log(`\n📎 Probando: ${test.name}`);
    console.log(`   URL: ${test.url}`);

    try {
      const startTime = Date.now();
      const validation = playdl.sp_validate(test.url);
      const endTime = Date.now();

      console.log(`   ⏱️  Tiempo: ${endTime - startTime}ms`);
      console.log(`   📊 Resultado: ${validation}`);
      console.log(`   ✅ Esperado: ${test.type}`);
      console.log(
        `   ${validation === test.type ? "✅ CORRECTO" : "❌ INCORRECTO"}`,
      );
    } catch (error) {
      console.log(`   ❌ Error en validación: ${error}`);
    }
  }
}

async function testSpotifyDataRetrieval() {
  console.log("\n\n📥 Test 2: Obtención de datos");
  console.log("------------------------------");

  for (const test of testUrls) {
    console.log(`\n📎 Probando: ${test.name}`);

    try {
      const startTime = Date.now();
      console.log("   🔄 Obteniendo datos...");

      // Crear timeout personalizado
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Timeout después de 15 segundos`));
        }, 15000);
      });

      const spotifyData = await Promise.race([
        playdl.spotify(test.url),
        timeoutPromise,
      ]);

      const endTime = Date.now();
      console.log(`   ⏱️  Tiempo: ${endTime - startTime}ms`);

      if (test.type === "track") {
        console.log("   📊 Datos del track:");
        console.log(`      Título: ${spotifyData.name}`);
        console.log(`      Artista: ${spotifyData.artists?.[0]?.name}`);
        console.log(`      Duración: ${spotifyData.durationInMs}ms`);
        console.log(`      URL externa: ${spotifyData.external_urls?.spotify}`);
        console.log("   ✅ Track obtenido exitosamente");
      } else if (test.type === "playlist") {
        console.log("   📊 Datos de la playlist:");
        console.log(`      Nombre: ${spotifyData.name}`);
        console.log(
          `      Descripción: ${spotifyData.description?.substring(0, 50)}...`,
        );
        console.log(`      Total tracks: ${spotifyData.total_tracks}`);
        console.log(`      Propietario: ${spotifyData.owner?.display_name}`);
        console.log("   ✅ Playlist obtenida exitosamente");
      }
    } catch (error) {
      console.log(
        `   ❌ Error obteniendo datos: ${error instanceof Error ? error.message : String(error)}`,
      );

      if (error instanceof Error && error.message.includes("Timeout")) {
        console.log("   🚨 PROBLEMA: La request se está colgando!");
      }

      if (error instanceof Error && error.message.includes("bearer")) {
        console.log("   🚨 PROBLEMA: Error de autenticación Bearer!");
        console.log("   💡 Solución: Verifica tu REFRESH_TOKEN");
      }
    }
  }
}

async function testYouTubeSearch() {
  console.log("\n\n🔍 Test 3: Búsqueda en YouTube");
  console.log("-------------------------------");

  // Obtener un track de Spotify y buscar en YouTube
  const testTrackUrl = testUrls[0].url;

  try {
    console.log("📎 Obteniendo track de Spotify...");
    const spotifyData = await playdl.spotify(testTrackUrl);

    const searchQuery = `${spotifyData.name} ${spotifyData.artists?.[0]?.name || ""}`;
    console.log(`🔍 Query de búsqueda: "${searchQuery}"`);

    console.log("🔄 Buscando en YouTube...");
    const startTime = Date.now();

    const searchResult = await playdl.search(searchQuery, {
      limit: 3,
      source: { youtube: "video" },
    });

    const endTime = Date.now();
    console.log(`⏱️  Tiempo de búsqueda: ${endTime - startTime}ms`);
    console.log(`📊 Resultados encontrados: ${searchResult.length}`);

    if (searchResult.length > 0) {
      console.log("📋 Primeros resultados:");
      searchResult.slice(0, 3).forEach((video, index) => {
        console.log(`   ${index + 1}. ${video.title}`);
        console.log(`      URL: ${video.url}`);
        console.log(`      Duración: ${video.durationInSec}s`);
        console.log(`      Vistas: ${video.views || "N/A"}`);
        console.log("");
      });
      console.log("✅ Búsqueda en YouTube exitosa");
    } else {
      console.log("❌ No se encontraron resultados en YouTube");
    }
  } catch (error) {
    console.log(
      `❌ Error en búsqueda: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function testCompleteFlow() {
  console.log("\n\n🔄 Test 4: Flujo completo (Spotify → YouTube)");
  console.log("----------------------------------------------");

  const testTrackUrl = testUrls[1].url; // Usar el segundo track

  try {
    console.log("📎 URL de prueba:", testTrackUrl);

    // Paso 1: Validar
    console.log("1️⃣ Validando URL...");
    const validation = playdl.sp_validate(testTrackUrl);
    console.log(`   Validación: ${validation}`);

    if (validation !== "track") {
      throw new Error(`Validación incorrecta: ${validation}`);
    }

    // Paso 2: Obtener datos de Spotify
    console.log("2️⃣ Obteniendo datos de Spotify...");
    const spotifyInfo = await playdl.spotify(testTrackUrl);
    console.log(`   Track: ${spotifyInfo.name}`);
    console.log(`   Artista: ${spotifyInfo.artists?.[0]?.name}`);

    // Paso 3: Buscar en YouTube
    console.log("3️⃣ Buscando equivalente en YouTube...");
    const searchQuery = `${spotifyInfo.name} ${spotifyInfo.artists?.[0]?.name || ""}`;
    const searchResult = await playdl.search(searchQuery, {
      limit: 1,
      source: { youtube: "video" },
    });

    if (searchResult.length === 0) {
      throw new Error("No se encontraron resultados en YouTube");
    }

    const video = searchResult[0];
    console.log(`   YouTube: ${video.title}`);
    console.log(`   URL: ${video.url}`);

    // Paso 4: Verificar que el stream funciona
    console.log("4️⃣ Verificando stream...");

    // Validar información del video antes de crear stream
    if (!video || !video.url) {
      throw new Error("Video info is invalid or missing URL");
    }

    console.log("   📊 Video info validation:");
    console.log(`      Has URL: ${!!video.url}`);
    console.log(`      Has title: ${!!video.title}`);
    console.log(`      Duration: ${video.durationInSec || "unknown"}`);
    console.log(`      Type: ${video.type || "unknown"}`);

    try {
      // Intentar crear stream con timeout
      const streamPromise = playdl.stream_from_info(video);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Stream creation timeout")), 10000);
      });

      const streamInfo = await Promise.race([streamPromise, timeoutPromise]);

      if (streamInfo && streamInfo.stream) {
        console.log("   ✅ Stream creado exitosamente");
        console.log(`      Type: ${streamInfo.type || "unknown"}`);
        console.log(`      Quality: ${streamInfo.quality || "unknown"}`);

        // Verificar que el stream es legible
        if (typeof streamInfo.stream.readable !== "undefined") {
          console.log(`      Stream readable: ${streamInfo.stream.readable}`);
        }

        streamInfo.stream.destroy(); // Limpiar
        console.log("   🧹 Stream cerrado");
      } else {
        throw new Error("Stream info is null or missing stream property");
      }
    } catch (streamError) {
      console.log(
        "   ❌ Error creando stream:",
        streamError instanceof Error
          ? streamError.message
          : String(streamError),
      );

      // Intentar método alternativo si el stream falla
      console.log("   🔄 Intentando método alternativo...");
      try {
        const altStream = await playdl.stream(video.url);
        if (altStream && altStream.stream) {
          console.log("   ✅ Stream alternativo creado");
          altStream.stream.destroy();
        } else {
          throw new Error("Alternative stream method also failed");
        }
      } catch (altError) {
        throw new Error(
          `Both stream methods failed: ${streamError instanceof Error ? streamError.message : String(streamError)} | Alt: ${altError instanceof Error ? altError.message : String(altError)}`,
        );
      }
    }

    console.log("\n🎉 FLUJO COMPLETO EXITOSO");
    console.log("=============================");
    console.log(
      `✅ Spotify: ${spotifyInfo.name} - ${spotifyInfo.artists?.[0]?.name}`,
    );
    console.log(`✅ YouTube: ${video.title}`);
    console.log(`✅ Stream: Funcional`);
  } catch (error) {
    console.log("\n💥 ERROR EN FLUJO COMPLETO");
    console.log("===========================");
    console.log(
      `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function runAllTests() {
  console.log("⏰ Iniciando tests de integración...");
  console.log("");

  // Inicializar Spotify
  const spotifyReady = await initializeSpotify();

  if (!spotifyReady) {
    console.log("💥 No se puede continuar sin configuración de Spotify válida");
    return;
  }

  console.log("\n⚡ Spotify inicializado, comenzando tests...\n");

  // Ejecutar todos los tests
  await testSpotifyValidation();
  await testSpotifyDataRetrieval();
  await testYouTubeSearch();
  await testCompleteFlow();

  console.log("\n\n📊 RESUMEN DE TESTS");
  console.log("===================");
  console.log(
    "Si todos los tests pasaron, tu integración de Spotify está funcionando.",
  );
  console.log("Si hay errores, revisa los mensajes específicos arriba.");
  console.log("");
  console.log("🔧 Problemas comunes:");
  console.log("   • Error bearer: REFRESH_TOKEN incorrecto o faltante");
  console.log("   • Timeouts: Problemas de red o API de Spotify lenta");
  console.log("   • 400 errors: CLIENT_ID/CLIENT_SECRET incorrectos");
  console.log("");
}

// Ejecutar tests
runAllTests().catch((error) => {
  console.error("💥 Error fatal en tests:", error);
  process.exit(1);
});
