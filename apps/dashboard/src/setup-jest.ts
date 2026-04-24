// Setup file for Jest tests
// Polyfill TextEncoder/TextDecoder for esbuild compatibility with Node 24+
import { TextEncoder, TextDecoder } from 'util';
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
}
