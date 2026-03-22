import playdl from "play-dl";
import ytdl from "@distube/ytdl-core";
import logger from "../src/utils/logger.ts";

// Test URLs - including the problematic one from the error
const testUrls = [
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ", // Rick Roll - simple test
  "https://www.youtube.com/watch?v=jfKfPfyJRdk", // LoFi hip hop - common playlist type
];

async function testUrlValidation(url: string) {
  console.log(`\n🔍 Testing URL: ${url}`);

  try {
    const validateResult = playdl.yt_validate(url);
    console.log(`✅ Validation result: ${validateResult}`);

    if (validateResult !== "video") {
      throw new Error(`URL is not a valid video (type: ${validateResult})`);
    }

    return true;
  } catch (error) {
    console.log(
      `❌ Validation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
}

async function testVideoInfo(url: string) {
  console.log(`\n📋 Getting video info for: ${url}`);

  try {
    const videoInfo = await playdl.video_basic_info(url);

    console.log(`✅ Video info obtained:`);
    console.log(`   Title: ${videoInfo.video_details.title}`);
    console.log(`   Duration: ${videoInfo.video_details.durationInSec}s`);
    console.log(`   Live: ${videoInfo.video_details.live}`);
    console.log(`   Private: ${videoInfo.video_details.private}`);
    console.log(`   Total formats: ${videoInfo.format?.length || 0}`);

    const audioFormats =
      videoInfo.format?.filter((f) => f.mimeType?.includes("audio")) || [];
    console.log(`   Audio formats: ${audioFormats.length}`);

    if (audioFormats.length > 0) {
      console.log(`   Best audio format:`);
      const bestFormat = audioFormats.sort(
        (a, b) => (b.bitrate || 0) - (a.bitrate || 0),
      )[0];
      console.log(`     Quality: ${bestFormat.quality}`);
      console.log(`     MimeType: ${bestFormat.mimeType}`);
      console.log(`     Bitrate: ${bestFormat.bitrate}`);
      console.log(`     Has URL: ${!!bestFormat.url}`);
    }

    return { videoInfo, audioFormats };
  } catch (error) {
    console.log(
      `❌ Video info failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

async function testDirectStream(url: string) {
  console.log(`\n🎵 Testing direct stream for: ${url}`);

  const qualities = [2, 1, 0]; // highest, high, lowest

  for (const quality of qualities) {
    try {
      console.log(`   Trying quality ${quality}...`);
      const stream = await playdl.stream(url, { quality });
      console.log(`   ✅ Stream successful with quality ${quality}`);
      console.log(`     Type: ${stream.type}`);
      console.log(`     Stream available: ${!!stream.stream}`);

      // Test that we can actually read from the stream
      if (stream.stream) {
        const testRead = new Promise((resolve, reject) => {
          let dataReceived = false;
          const timeout = setTimeout(() => {
            if (!dataReceived) {
              reject(new Error("No data received within 5 seconds"));
            }
          }, 5000);

          stream.stream.once("data", () => {
            dataReceived = true;
            clearTimeout(timeout);
            resolve(true);
          });

          stream.stream.once("error", reject);
        });

        try {
          await testRead;
          console.log(`   ✅ Stream is readable`);
          stream.stream.destroy();
          return true;
        } catch (readError) {
          console.log(
            `   ⚠️ Stream not readable: ${readError instanceof Error ? readError.message : String(readError)}`,
          );
          stream.stream.destroy();
        }
      }
    } catch (error) {
      console.log(
        `   ❌ Quality ${quality} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return false;
}

async function testYtdlCore(url: string) {
  console.log(`\n🎵 Testing ytdl-core for: ${url}`);

  try {
    if (!ytdl.validateURL(url)) {
      console.log(`❌ URL not valid for ytdl-core`);
      return false;
    }

    console.log(`✅ URL validation passed for ytdl-core`);

    // Test getting video info
    try {
      const info = await ytdl.getInfo(url);
      console.log(`✅ Video info obtained:`);
      console.log(`   Title: ${info.videoDetails.title}`);
      console.log(`   Duration: ${info.videoDetails.lengthSeconds}s`);
      console.log(`   Is live: ${info.videoDetails.isLiveContent}`);
      console.log(`   Available formats: ${info.formats.length}`);

      const audioFormats = info.formats.filter(
        (f) => f.hasAudio && !f.hasVideo,
      );
      console.log(`   Audio-only formats: ${audioFormats.length}`);

      if (audioFormats.length > 0) {
        const bestAudio = audioFormats.sort(
          (a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0),
        )[0];
        console.log(`   Best audio format:`);
        console.log(`     Bitrate: ${bestAudio.audioBitrate}`);
        console.log(`     Quality: ${bestAudio.audioQuality}`);
      }
    } catch (infoError) {
      console.log(
        `⚠️ Could not get video info: ${infoError instanceof Error ? infoError.message : String(infoError)}`,
      );
    }

    // Test creating stream
    try {
      const stream = ytdl(url, {
        filter: "audioonly",
        quality: "highestaudio",
        highWaterMark: 1 << 25,
      });

      console.log(`✅ Stream created successfully`);

      // Test that we can actually read from the stream
      const testRead = new Promise((resolve, reject) => {
        let dataReceived = false;
        const timeout = setTimeout(() => {
          if (!dataReceived) {
            reject(new Error("No data received within 5 seconds"));
          }
        }, 5000);

        stream.once("data", () => {
          dataReceived = true;
          clearTimeout(timeout);
          resolve(true);
        });

        stream.once("error", reject);
      });

      try {
        await testRead;
        console.log(`✅ Stream is readable`);
        stream.destroy();
        return true;
      } catch (readError) {
        console.log(
          `⚠️ Stream not readable: ${readError instanceof Error ? readError.message : String(readError)}`,
        );
        stream.destroy();
      }
    } catch (streamError) {
      console.log(
        `❌ Stream creation failed: ${streamError instanceof Error ? streamError.message : String(streamError)}`,
      );
    }

    return false;
  } catch (error) {
    console.log(
      `❌ ytdl-core test failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
}

async function testSearch(query: string) {
  console.log(`\n🔍 Testing search for: ${query}`);

  try {
    const searchResult = await playdl.search(query, {
      limit: 3,
      source: { youtube: "video" },
    });

    console.log(`✅ Search successful, found ${searchResult.length} results`);

    for (let i = 0; i < searchResult.length; i++) {
      const video = searchResult[i];
      console.log(`   Result ${i + 1}:`);
      console.log(`     Title: ${video.title}`);
      console.log(`     URL: ${video.url}`);
      console.log(`     Duration: ${video.durationInSec}s`);
      console.log(`     Has thumbnail: ${!!video.thumbnails?.[0]?.url}`);
    }

    return searchResult;
  } catch (error) {
    console.log(
      `❌ Search failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

async function runFullTest(url: string) {
  console.log(`\n🧪 === FULL TEST FOR URL ===`);
  console.log(`URL: ${url}`);

  // Step 1: Validate URL
  const isValid = await testUrlValidation(url);
  if (!isValid) {
    console.log(`❌ Skipping further tests due to validation failure`);
    return;
  }

  // Step 2: Get video info
  const videoResult = await testVideoInfo(url);
  if (!videoResult) {
    console.log(`❌ Skipping stream test due to video info failure`);
    return;
  }

  // Step 3: Test direct stream
  const streamSuccess = await testDirectStream(url);

  // Step 4: If direct stream fails, test ytdl-core
  if (!streamSuccess) {
    console.log(`\n🔄 Direct stream failed, testing ytdl-core...`);
    const ytdlSuccess = await testYtdlCore(url);

    // Step 5: If ytdl-core also fails, test search fallback
    if (!ytdlSuccess && videoResult && videoResult.videoInfo) {
      console.log(`\n🔄 ytdl-core also failed, testing search fallback...`);
      const searchResults = await testSearch(
        videoResult.videoInfo.video_details.title || "",
      );

      if (searchResults.length > 0 && searchResults[0].url !== url) {
        console.log(`\n🔄 Testing alternative URL from search...`);
        const searchStreamSuccess = await testDirectStream(
          searchResults[0].url,
        );

        if (!searchStreamSuccess) {
          console.log(`\n🔄 Testing ytdl-core with search result...`);
          await testYtdlCore(searchResults[0].url);
        }
      }
    }
  }

  console.log(`\n✅ Full test completed for: ${url}`);
}

async function main() {
  console.log("🎵 Audio Stream Debug Tool");
  console.log("==========================");

  try {
    // Test each URL
    for (const url of testUrls) {
      await runFullTest(url);
      console.log("\n" + "=".repeat(80));
    }

    // Test the specific problematic search query
    console.log(`\n🔍 Testing problematic search query...`);
    await testSearch("【𝐏𝐥𝐚𝐲𝐥𝐢𝐬𝐭】 1-Hour Relaxing R&B Hits ♬");

    console.log("\n🎉 All tests completed!");
  } catch (error) {
    console.error("💥 Fatal error during testing:", error);
  }
}

// Run the tests
main().catch(console.error);
