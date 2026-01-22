import { createAudioResource } from "@discordjs/voice";
import { createReadStream } from "fs";
import { Readable } from "stream";

console.log("🎵 Testing Opus Encoders Availability");
console.log("=====================================\n");

// Test 1: Check what Opus encoders are available
async function testOpusAvailability() {
  console.log("📋 Checking available Opus encoders...");

  try {
    // Try to import prism-media to see what it detects
    const prism = await import("prism-media");
    console.log("✅ prism-media imported successfully");

    // Check what opus encoders it can find
    const { opus } = prism;

    if (opus) {
      console.log("✅ Opus module available in prism-media");

      // Try to create an opus encoder
      try {
        const encoder = new opus.Encoder({ rate: 48000, channels: 2, frameSize: 960 });
        console.log("✅ @discordjs/opus encoder working");
        encoder.destroy();
      } catch (opusError) {
        console.log(`❌ @discordjs/opus encoder failed: ${opusError.message}`);
      }
    } else {
      console.log("❌ No Opus module found in prism-media");
    }

  } catch (prismError) {
    console.log(`❌ Failed to import prism-media: ${prismError.message}`);
  }
}

// Test 2: Check specific Opus packages
async function testSpecificOpusPackages() {
  console.log("\n📋 Testing specific Opus packages...");

  // Test @discordjs/opus
  try {
    const discordOpus = await import("@discordjs/opus");
    console.log("✅ @discordjs/opus package available");

    // Try to create an encoder
    try {
      const encoder = new discordOpus.OpusEncoder(48000, 2);
      console.log("✅ @discordjs/opus OpusEncoder working");
    } catch (encoderError) {
      console.log(`❌ @discordjs/opus OpusEncoder failed: ${encoderError.message}`);
    }
  } catch (discordOpusError) {
    console.log(`❌ @discordjs/opus not available: ${discordOpusError.message}`);
  }

  // Test opusscript
  try {
    const opusscript = await import("opusscript");
    console.log("✅ opusscript package available");

    // Try to create an encoder
    try {
      const encoder = new opusscript.OpusEncoder(48000, 2);
      console.log("✅ opusscript OpusEncoder working");
    } catch (encoderError) {
      console.log(`❌ opusscript OpusEncoder failed: ${encoderError.message}`);
    }
  } catch (opusscriptError) {
    console.log(`❌ opusscript not available: ${opusscriptError.message}`);
  }
}

// Test 3: Try to create an AudioResource (this is where the error occurs)
async function testAudioResourceCreation() {
  console.log("\n📋 Testing AudioResource creation (where the error occurs)...");

  try {
    // Create a simple readable stream
    const testStream = new Readable({
      read() {
        this.push(Buffer.alloc(1024, 0)); // Push some dummy data
        this.push(null); // End the stream
      }
    });

    console.log("✅ Test stream created");

    // Try to create an AudioResource (this should trigger the Opus encoder)
    const resource = createAudioResource(testStream, {
      inlineVolume: true,
    });

    console.log("✅ AudioResource created successfully!");
    console.log(`   Resource type: ${resource.metadata?.type || 'unknown'}`);

    // Clean up
    if (resource.audioPlayer) {
      resource.audioPlayer.stop();
    }

  } catch (resourceError) {
    console.log(`❌ AudioResource creation failed: ${resourceError.message}`);
    console.log(`   This is the same error you're experiencing!`);

    // Show the full error stack for debugging
    if (resourceError.stack) {
      console.log(`\n📋 Full error stack:`);
      console.log(resourceError.stack);
    }
  }
}

// Test 4: Environment information
async function testEnvironmentInfo() {
  console.log("\n📋 Environment Information...");

  console.log(`   Node.js version: ${process.version}`);
  console.log(`   Platform: ${process.platform}`);
  console.log(`   Architecture: ${process.arch}`);

  // Check if ffmpeg is available
  try {
    const { spawn } = await import("child_process");

    const ffmpegTest = new Promise<boolean>((resolve) => {
      const ffmpeg = spawn("ffmpeg", ["-version"], { stdio: "pipe" });

      ffmpeg.on("close", (code) => {
        resolve(code === 0);
      });

      ffmpeg.on("error", () => {
        resolve(false);
      });

      setTimeout(() => {
        ffmpeg.kill();
        resolve(false);
      }, 5000);
    });

    const ffmpegAvailable = await ffmpegTest;
    console.log(`   FFmpeg available: ${ffmpegAvailable ? "✅ Yes" : "❌ No"}`);

  } catch (error) {
    console.log(`   FFmpeg test failed: ${error}`);
  }
}

// Test 5: Alternative solutions
async function testAlternativeSolutions() {
  console.log("\n📋 Testing alternative solutions...");

  console.log("💡 Possible solutions if Opus fails:");
  console.log("   1. Use opusscript as fallback (JavaScript implementation)");
  console.log("   2. Disable inline volume to avoid Opus requirement");
  console.log("   3. Use external FFmpeg for audio processing");
  console.log("   4. Switch to different audio input format");

  // Test creating AudioResource without inline volume
  try {
    const testStream = new Readable({
      read() {
        this.push(Buffer.alloc(1024, 0));
        this.push(null);
      }
    });

    const resource = createAudioResource(testStream, {
      inlineVolume: false, // This might avoid the Opus requirement
    });

    console.log("✅ AudioResource without inline volume works!");

  } catch (error) {
    console.log(`❌ AudioResource without inline volume still fails: ${error.message}`);
  }
}

// Summary function
function printSummary() {
  console.log("\n" + "=".repeat(60));
  console.log("📊 OPUS TEST SUMMARY");
  console.log("=".repeat(60));
  console.log("");
  console.log("🔍 DIAGNOSIS:");
  console.log("   The error occurs when Discord.js tries to create an AudioResource");
  console.log("   and needs an Opus encoder to compress audio for Discord.");
  console.log("");
  console.log("💡 COMMON SOLUTIONS:");
  console.log("   1. Ensure @discordjs/opus is properly installed");
  console.log("   2. Install opusscript as JavaScript fallback");
  console.log("   3. Install node-opus (native performance)");
  console.log("   4. Disable inlineVolume if not needed");
  console.log("");
  console.log("🚀 NEXT STEPS:");
  console.log("   1. Check which encoders are working above");
  console.log("   2. Install missing dependencies");
  console.log("   3. Consider using ffmpeg-static for audio processing");
  console.log("   4. Test with different AudioResource options");
}

// Run all tests
async function runAllTests() {
  try {
    await testOpusAvailability();
    await testSpecificOpusPackages();
    await testAudioResourceCreation();
    await testEnvironmentInfo();
    await testAlternativeSolutions();
  } catch (error) {
    console.log(`\n💥 Test suite failed: ${error}`);
  } finally {
    printSummary();
  }
}

// Execute tests
runAllTests().catch(console.error);
