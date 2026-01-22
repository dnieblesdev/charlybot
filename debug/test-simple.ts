import playdl from "play-dl";

// Simple test for the problematic search query
async function testProblematicQuery() {
  console.log("🧪 Testing problematic search query...");

  const query = "【𝐏𝐥𝐚𝐲𝐥𝐢𝐬𝐭】 1-Hour Relaxing R&B Hits ♬";

  try {
    // Test the search function
    const searchResult = await playdl.search(query, {
      limit: 5,
      source: { youtube: "video" }
    });

    console.log(`✅ Found ${searchResult.length} results for problematic query`);

    // Filter results like our improved code does
    const goodResults = searchResult.filter(video =>
      video &&
      video.url &&
      video.durationInSec > 0 &&
      video.durationInSec <= 7200 // 2 hours max
    );

    console.log(`✅ Filtered to ${goodResults.length} suitable results`);

    if (goodResults.length > 0) {
      const bestResult = goodResults[0];
      console.log(`🎵 Best result:`);
      console.log(`   Title: ${bestResult.title}`);
      console.log(`   Duration: ${Math.floor(bestResult.durationInSec / 60)}:${String(bestResult.durationInSec % 60).padStart(2, '0')}`);
      console.log(`   URL: ${bestResult.url}`);

      // Try to stream it
      try {
        const stream = await playdl.stream(bestResult.url, { quality: 1 });
        console.log(`✅ Stream successful!`);
        if (stream.stream) {
          stream.stream.destroy(); // Clean up
        }
        return true;
      } catch (streamError) {
        console.log(`❌ Stream failed: ${streamError instanceof Error ? streamError.message : String(streamError)}`);
        return false;
      }
    }

    return false;
  } catch (error) {
    console.log(`❌ Test failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

// Test search query cleaning
function testQueryCleaning() {
  console.log("\n🧹 Testing query cleaning...");

  const testQueries = [
    "【𝐏𝐥𝐚𝐲𝐥𝐢𝐬𝐭】 1-Hour Relaxing R&B Hits ♬",
    "[Playlist] Lofi Hip Hop Radio 24/7 Live",
    "Jazz BGM for Study ♬ Relaxing Music",
    "Chill R&B Hits"
  ];

  testQueries.forEach(query => {
    let cleaned = query.trim();

    // Apply cleaning logic from our code
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

    console.log(`   "${query}"`);
    console.log(`   -> "${cleaned}"`);
    console.log("");
  });
}

// Test multiple streaming strategies
async function testStreamingStrategies() {
  console.log("\n🎵 Testing streaming strategies...");

  // Test with a known working URL
  const testUrl = "https://www.youtube.com/watch?v=jfKfPfyJRdk"; // LoFi stream
  const qualities = [2, 1, 0];

  for (const quality of qualities) {
    try {
      console.log(`   Trying quality ${quality}...`);
      const stream = await playdl.stream(testUrl, { quality });
      console.log(`   ✅ Quality ${quality} successful`);
      if (stream.stream) {
        stream.stream.destroy();
      }
      return true;
    } catch (error) {
      console.log(`   ❌ Quality ${quality} failed`);
    }
  }

  return false;
}

async function main() {
  console.log("🎵 Simple Music Service Test");
  console.log("============================\n");

  // Test query cleaning
  testQueryCleaning();

  // Test streaming strategies
  const streamingWorks = await testStreamingStrategies();
  console.log(`Streaming test: ${streamingWorks ? "✅ PASSED" : "❌ FAILED"}\n`);

  // Test problematic query
  const problematicQueryWorks = await testProblematicQuery();
  console.log(`\nProblematic query test: ${problematicQueryWorks ? "✅ PASSED" : "❌ FAILED"}`);

  console.log("\n🎉 Test completed!");
}

main().catch(console.error);
