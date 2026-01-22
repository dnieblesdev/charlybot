import playdl from "play-dl";
import YTDlpWrap from "yt-dlp-wrap";
import path from "path";

// Simular el caso de error original
const originalErrorCase = {
  guildId: "494918316318523392",
  song: "【𝐏𝐥𝐚𝐲𝐥𝐢𝐬𝐭】 1-Hour Relaxing R&B Hits ♬",
  expectedError: "No se pudo obtener el formato de audio del video"
};

console.log("🔍 Testing Original Error Case");
console.log("===============================");
console.log(`Guild ID: ${originalErrorCase.guildId}`);
console.log(`Song: ${originalErrorCase.song}`);
console.log(`Expected Error: ${originalErrorCase.expectedError}\n`);

// Función para limpiar query (copiada del MusicService)
function cleanSearchQuery(query: string): string {
  let cleaned = query.trim();

  // Remover caracteres especiales de títulos de playlists
  cleaned = cleaned.replace(/【.*?】/g, ""); // Remover corchetes japoneses
  cleaned = cleaned.replace(/♬/g, ""); // Remover símbolos musicales
  cleaned = cleaned.replace(/\[.*?Playlist.*?\]/gi, ""); // Remover [Playlist]
  cleaned = cleaned.replace(/\[.*?BGM.*?\]/gi, ""); // Remover [BGM]
  cleaned = cleaned.replace(/lofi hip hop radio/gi, "lofi hip hop"); // Evitar radios
  cleaned = cleaned.replace(/24\/7/g, ""); // Remover indicadores de stream 24/7
  cleaned = cleaned.replace(/live/gi, ""); // Remover "live"
  cleaned = cleaned.replace(/radio/gi, ""); // Remover "radio"

  // Limpiar múltiples espacios
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // Si después de limpiar queda muy poco, usar términos más genéricos
  if (cleaned.length < 10) {
    if (query.toLowerCase().includes("r&b")) {
      cleaned = "R&B music hits";
    } else if (query.toLowerCase().includes("jazz")) {
      cleaned = "Jazz music";
    } else if (query.toLowerCase().includes("chill")) {
      cleaned = "chill music";
    } else {
      cleaned = query; // Usar original si no podemos inferir
    }
  }

  return cleaned;
}

// Simular estrategias del MusicService
async function testOriginalErrorWithHybridSolution() {
  const { song: originalQuery } = originalErrorCase;

  console.log("🧪 Step 1: Clean the problematic query");
  const cleanedQuery = cleanSearchQuery(originalQuery);
  console.log(`   Original: "${originalQuery}"`);
  console.log(`   Cleaned:  "${cleanedQuery}"`);
  console.log("");

  console.log("🧪 Step 2: Try play-dl search (original approach)");
  try {
    const searchResult = await playdl.search(cleanedQuery, {
      limit: 3,
      source: { youtube: "video" }
    });

    if (searchResult.length === 0) {
      console.log("   ❌ No search results found");
      return;
    }

    console.log(`   ✅ Found ${searchResult.length} results:`);
    searchResult.forEach((video, i) => {
      console.log(`      ${i + 1}. ${video.title}`);
      console.log(`         Duration: ${Math.floor(video.durationInSec / 60)}:${String(video.durationInSec % 60).padStart(2, '0')}`);
      console.log(`         URL: ${video.url}`);
    });

    // Filter suitable results (avoid very long videos)
    const goodResults = searchResult.filter(video =>
      video && video.url && video.durationInSec > 0 && video.durationInSec <= 7200
    );

    console.log(`   📋 ${goodResults.length} results after filtering (max 2 hours)`);

    if (goodResults.length === 0) {
      console.log("   ❌ No suitable results after filtering");
      return;
    }

    // Try streaming with play-dl (this is where the original error occurs)
    console.log("\n🧪 Step 3: Try play-dl streaming (where original error occurs)");
    const bestResult = goodResults[0];
    console.log(`   Attempting to stream: ${bestResult.title}`);

    try {
      const stream = await playdl.stream(bestResult.url, { quality: 1 });
      console.log("   ✅ play-dl streaming succeeded!");
      if (stream.stream) {
        stream.stream.destroy();
      }

      console.log("\n🎉 SUCCESS: The hybrid solution would work with play-dl for this case!");
      return;

    } catch (playdlError) {
      console.log(`   ❌ play-dl streaming failed: ${playdlError}`);
      console.log("   📝 This is the original error you experienced!");

      // Now test yt-dlp fallback
      console.log("\n🧪 Step 4: yt-dlp fallback (NEW SOLUTION)");

      try {
        const ytDlpPath = path.join(process.cwd(), "bin", "yt-dlp.exe");
        const ytDlp = new YTDlpWrap(ytDlpPath);

        console.log("   🔄 Getting video info with yt-dlp...");
        const info = await ytDlp.getVideoInfo(bestResult.url);

        if (info) {
          console.log(`   ✅ yt-dlp got video info:`);
          console.log(`      Title: ${info.title}`);
          console.log(`      Duration: ${info.duration}s`);
          console.log(`      Available formats: ${info.formats?.length || 0}`);

          // Check for audio formats
          const audioFormats = info.formats?.filter(
            (f: any) => f.acodec && f.acodec !== "none"
          ) || [];

          console.log(`      Audio formats: ${audioFormats.length}`);

          if (audioFormats.length > 0) {
            console.log("   ✅ yt-dlp can extract audio from this video!");
            console.log("\n🎉 SUCCESS: yt-dlp fallback would resolve the original error!");

            // Test actual streaming
            console.log("\n🧪 Step 5: Test yt-dlp streaming");
            try {
              const { spawn } = await import("child_process");

              return new Promise<void>((resolve, reject) => {
                const ytDlpProcess = spawn(ytDlpPath, [
                  "--format", "bestaudio/best",
                  "--no-playlist",
                  "--quiet",
                  "--get-url",
                  bestResult.url
                ]);

                let output = "";
                ytDlpProcess.stdout.on("data", (data) => {
                  output += data.toString();
                });

                ytDlpProcess.on("close", (code) => {
                  if (code === 0 && output.trim()) {
                    console.log("   ✅ yt-dlp can get streaming URL!");
                    console.log("   🔗 Stream URL available (not shown for brevity)");
                    console.log("\n🎉 COMPLETE SUCCESS: Hybrid solution would work!");
                    resolve();
                  } else {
                    console.log(`   ❌ yt-dlp streaming failed with code ${code}`);
                    reject(new Error(`yt-dlp failed with code ${code}`));
                  }
                });

                ytDlpProcess.on("error", (error) => {
                  console.log(`   ❌ yt-dlp process error: ${error}`);
                  reject(error);
                });

                // Timeout after 30 seconds
                setTimeout(() => {
                  ytDlpProcess.kill();
                  reject(new Error("yt-dlp timeout"));
                }, 30000);
              });

            } catch (streamError) {
              console.log(`   ❌ yt-dlp streaming test failed: ${streamError}`);
            }

          } else {
            console.log("   ❌ No audio formats available in yt-dlp");
          }
        } else {
          console.log("   ❌ yt-dlp could not get video info");
        }

      } catch (ytdlpError) {
        console.log(`   ❌ yt-dlp fallback failed: ${ytdlpError}`);
      }
    }

  } catch (searchError) {
    console.log(`   ❌ Search failed: ${searchError}`);
  }
}

// Summary function
function printSummary() {
  console.log("\n" + "=".repeat(60));
  console.log("📊 SOLUTION SUMMARY");
  console.log("=".repeat(60));
  console.log("");
  console.log("🔴 ORIGINAL PROBLEM:");
  console.log("   - Complex playlist-style titles with special characters");
  console.log("   - play-dl fails to get audio format URLs from YouTube");
  console.log("   - Error: 'No se pudo obtener el formato de audio del video'");
  console.log("");
  console.log("✅ HYBRID SOLUTION:");
  console.log("   1. Keep play-dl for Spotify (works perfectly)");
  console.log("   2. Clean problematic search queries");
  console.log("   3. Try play-dl first for YouTube (maintains compatibility)");
  console.log("   4. Use yt-dlp as fallback when play-dl fails");
  console.log("   5. yt-dlp handles YouTube's changing API better");
  console.log("");
  console.log("🎯 BENEFITS:");
  console.log("   ✅ Maintains all existing Spotify functionality");
  console.log("   ✅ Adds robust fallback for problematic YouTube videos");
  console.log("   ✅ Better handling of playlist-style titles");
  console.log("   ✅ No breaking changes to existing working features");
  console.log("   ✅ Improved error messages and debugging");
  console.log("");
  console.log("⚠️  REQUIREMENTS:");
  console.log("   - yt-dlp executable in bin/ directory (✅ already installed)");
  console.log("   - Updated MusicService with hybrid streaming logic");
  console.log("   - Proper error handling and fallback chains");
}

// Run the test
async function main() {
  try {
    await testOriginalErrorWithHybridSolution();
  } catch (error) {
    console.log(`\n💥 Test failed with error: ${error}`);
  } finally {
    printSummary();
  }
}

main().catch(console.error);
