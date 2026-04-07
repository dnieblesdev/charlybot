/**
 * Truncates text to fit within Discord embed field limits.
 * Discord embed fields have a max of 1024 characters.
 * @param content The content to truncate
 * @param maxLength Maximum length (default 1021 to leave room for "...")
 * @returns Truncated content with "..." suffix if needed
 */
export function truncateForEmbedField(
  content: string,
  maxLength: number = 1021,
): string {
  if (!content) return "";
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength) + "...";
}