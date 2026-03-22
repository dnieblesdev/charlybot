import playdl from "play-dl";

// Test URLs for different scenarios
const testCases = [
  {
    name: "Spotify Track",
    query: "https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh",
    expectedMethod: "play-dl",
    description: "Should use play-dl for Spotify URLs"
  },
  {
    name: "YouTube Video",
    query: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    expectedMethod: "play-dl or yt-dlp fallback",
    description: "Should try play-dl first, fallback to yt-dlp if needed"
  },
  {
    name: "Problematic YouTube Playlist Style",
    query: "【𝐏𝐥𝐚𝐲𝐥𝐢𝐬𝐭】 1-Hour Relaxing R&B Hits ♬",
    expectedMethod: "search + multiple fallbacks",
    description: "Should clean query, search, and use best available method"
  },
  {
    name: "Simple Search Query",
    query: "lofi hip hop chill music",
    expectedMethod: "play-dl search",
    description: "Should use play-dl search for simple queries"
  }
];

// Test query cleaning function (simulating MusicService logic)
function cleanSearchQuery(query: string): string {
  let cleaned = query.trim();

  // Apply cleaning logic
  cleaned = cleaned.replace(/【.*?】/g, ""); // Remove Japanese brackets
  cleaned = cleaned.replace(/♬/g, ""); // Remove music symbols
  cleaned = cleaned.replace(/\[.*?Playlist.*?\]/gi, ""); // Remove [Playlist]
  cleaned = cleaned.replace(/\[.*?BGM.*?\]/gi, ""); // Remove [BGM]
  cleaned = cleaned.replace(/lofi hip hop radio/gi, "lofi hip hop"); // Avoid radios
  cleaned = cleaned.replace(/24\/7/g, ""); // Remove 24/7 indicators
  cleaned = cleaned.replace(/live/gi, ""); // Remove "live"
  cleaned = cleaned.replace(/radio/gi, ""); // Remove "radio"
  cleaned = cleaned.replace(/\s+/g, " ").trim(); // Clean multiple spaces

  // If too short after cleaning, use generic terms
  if (cleaned.length < 10) {
    if (query.toLowerCase().includes("r&b")) {
      cleaned = "R&B music hits";
    } else if (query.toLowerCase().includes("jazz")) {
      cleaned = "Jazz music";
    } else if (query.toLowerCase().includes("chill")) {
      cleaned = "chill music";
    }
  }

  return cleaned;
}

// Test play-dl functionality
async function testPlayDl(query: string): Promise<{ success: boolean; method: string; error?: string }> {
  try {
    // Test Spotify
    if (playdl.sp_validate(query) === "track") {
      console.log(`   🎵 Detected Spotify track`);
      const spotifyInfo: any = await playdl.spotify(query);
      const searchResult = await playdl.search(
        `${spotifyInfo.name} ${spotifyInfo.artists?.[0]?.name || ""}`,
        { limit: 1, source: { youtube: "video" } }
      );

      if (searchResult.length > 0) {
        return { success: true, method: "play-dl (Spotify)" };
      }
      return { success: false, method: "play-dl (Spotify)", error: "No YouTube results for Spotify track" };
    }

    // Test YouTube URL
    if (playdl.yt_validate(query) === "video") {
      console.log(`   🎵 Detected YouTube video`);

      // Try streaming
      try {
        const stream = await playdl.stream(query, { quality: 1 });
        if (stream && stream.stream) {
          stream.stream.destroy();
          return { success: true, method: "play-dl (YouTube direct)" };
        }
      } catch (streamError) {
        return { success: false, method: "play-dl (YouTube direct)", error: `Stream failed: ${streamError}` };
      }
    }

    // Test search
    console.log(`   🔍 Searching with play-dl`);
    const cleanedQuery = cleanSearchQuery(query);
    const searchResult = await playdl.search(cleanedQuery, {
      limit: 3,
      source: { youtube: "video" }
    });

    if (searchResult.length === 0) {
      return { success: false, method: "play-dl (Search)", error: "No search results" };
    }

    // Filter results (avoid live streams and very long videos)
    const goodResults = searchResult.filter(video =>
      video &&
      video.url &&
      video.durationInSec > 0 &&
      video.durationInSec <= 7200 // 2 hours max
    );

    if (goodResults.length === 0) {
      return { success: false, method: "play-dl (Search)", error: "No suitable results after filtering" };
    }

    // Try to stream the best result
    const bestResult = goodResults[0];
    try {
      const stream = await playdl.stream(bestResult.url, { quality: 1 });
      if (stream && stream.stream) {
        stream.stream.destroy();
        return { success: true, method: "play-dl (Search + Stream)" };
      }
    } catch (streamError) {
      return { success: false, method: "play-dl (Search)", error: `Stream failed for search result: ${streamError}` };
    }

    return { success: false, method: "play-dl (Search)", error: "Stream creation failed" };

  } catch (error) {
    return {
      success: false,
      method: "play-dl",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Test yt-dlp availability (simulated)
async function testYtDlpAvailability(): Promise<boolean> {
  try {
    const { spawn } = await import("child_process");
    const path = await import("path");

    const ytDlpPath = path.join(process.cwd(), "bin", "yt-dlp.exe");

    return new Promise((resolve) => {
      const process = spawn(ytDlpPath, ["--version"], { stdio: "pipe" });

      let output = "";
      process.stdout.on("data", (data) => {
        output += data.toString();
      });

      process.on("close", (code) => {
        if (code === 0 && output.trim().length > 0) {
          console.log(`   ✅ yt-dlp available: ${output.trim()}`);
          resolve(true);
        } else {
          console.log(`   ❌ yt-dlp not available or failed`);
          resolve(false);
        }
      });

      process.on("error", () => {
        console.log(`   ❌ yt-dlp executable not found`);
        resolve(false);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        process.kill();
        resolve(false);
      }, 5000);
    });
  } catch (error) {
    console.log(`   ❌ Error testing yt-dlp: ${error}`);
    return false;
  }
}

// Run comprehensive test
async function runHybridTest() {
  console.log("🎵 Hybrid System Test (play-dl + yt-dlp)");
  console.log("=========================================\n");

  // Test yt-dlp availability first
  console.log("📋 Testing yt-dlp availability...");
  const ytDlpAvailable = await testYtDlpAvailability();
  console.log("");

  // Test each case
  for (const testCase of testCases) {
    console.log(`🧪 Testing: ${testCase.name}`);
    console.log(`   Query: ${testCase.query}`);
    console.log(`   Expected: ${testCase.expectedMethod}`);
    console.log(`   Description: ${testCase.description}`);

    const result = await testPlayDl(testCase.query);

    if (result.success) {
      console.log(`   ✅ SUCCESS with ${result.method}`);
    } else {
      console.log(`   ❌ FAILED with ${result.method}`);
      if (result.error) {
        console.log(`      Error: ${result.error}`);
      }

      // If play-dl failed and yt-dlp is available, mention fallback
      if (ytDlpAvailable && (testCase.query.includes("youtube.com") || testCase.query.includes("youtu.be"))) {
        console.log(`   🔄 yt-dlp fallback would be attempted for YouTube URLs`);
      }
    }

    console.log("");
  }

  // Summary
  console.log("📊 Test Summary:");
  console.log(`   - play-dl: Primary method for all sources`);
  console.log(`   - Spotify: Uses play-dl exclusively (search YouTube for tracks)`);
  console.log(`   - YouTube: Uses play-dl first, yt-dlp as fallback if available`);
  console.log(`   - Search queries: Cleaned and processed through play-dl`);
  console.log(`   - yt-dlp availability: ${ytDlpAvailable ? "✅ Available" : "❌ Not available"}`);

  if (!ytDlpAvailable) {
    console.log(`   ⚠️  Some YouTube videos may fail without yt-dlp fallback`);
  }

  console.log("\n🎉 Hybrid system test completed!");
}

// Execute the test
runHybridTest().catch(console.error);
