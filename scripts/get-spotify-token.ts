import dotenv from 'dotenv';
import { startAuthServer } from '../apps/bot/src/utils/spotify-auth';

// Cargar variables de entorno
dotenv.config();

console.log('🎵 CharlyBot - Obtener Refresh Token de Spotify');
console.log('==============================================');
console.log('');

console.log('📋 Este script te ayudará a obtener el refresh_token necesario');
console.log('   para que tu bot pueda usar la API de Spotify.');
console.log('');

console.log('✅ Requisitos previos:');
console.log('   • SPOTIFY_CLIENT_ID configurado en .env');
console.log('   • SPOTIFY_CLIENT_SECRET configurado en .env');
console.log('   • Redirect URI configurado en Spotify: http://127.0.0.1:3000/callback');
console.log('');

console.log('🚀 Iniciando proceso de autorización...');
console.log('');

// Verificar que las credenciales estén configuradas
const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.log('❌ ERROR: Faltan credenciales de Spotify');
  console.log('');
  console.log('📝 Agrega estas líneas a tu archivo .env:');
  console.log('   SPOTIFY_CLIENT_ID=tu_client_id_aqui');
  console.log('   SPOTIFY_CLIENT_SECRET=tu_client_secret_aqui');
  console.log('');
  console.log('💡 Puedes obtener estas credenciales en:');
  console.log('   https://developer.spotify.com/dashboard');
  console.log('');
  process.exit(1);
}

console.log('✅ Credenciales encontradas');
console.log(`   Client ID: ${clientId.substring(0, 8)}...`);
console.log(`   Client Secret: ${clientSecret.substring(0, 8)}...`);
console.log('');

try {
  startAuthServer();
} catch (error) {
  console.log('❌ Error al iniciar el servidor:', error);
  process.exit(1);
}
