import { EmbedBuilder } from "discord.js";
import { truncateForEmbedField } from "@charlybot/shared";

/**
 * Build an embed for message edit events
 */
export function buildMessageEditEmbed(data: {
  authorTag: string;
  authorAvatarURL?: string;
  channelName: string;
  channelId: string;
  messageId: string;
  jumpLink: string;
  oldContent?: string | null;
  newContent?: string | null;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x3498db) // Blue for edits
    .setAuthor({ name: data.authorTag, iconURL: data.authorAvatarURL })
    .setTitle("Mensaje Editado")
    .addFields(
      {
        name: "💬 Canal",
        value: `#${data.channelName}`,
        inline: true,
      },
      {
        name: "🔗 Mensaje",
        value: `[Ir al mensaje](${data.jumpLink})`,
        inline: true,
      },
    )
    .setFooter({
      text: `ID del mensaje: ${data.messageId}`,
    })
    .setTimestamp();

  // Add old content field
  if (data.oldContent !== undefined && data.oldContent !== null) {
    embed.addFields({
      name: "📝 Contenido Anterior",
      value: truncateForEmbedField(data.oldContent) || "_No disponible_",
      inline: false,
    });
  } else {
    embed.addFields({
      name: "📝 Contenido Anterior",
      value: "_No disponible_",
      inline: false,
    });
  }

  // Add new content field
  if (data.newContent !== undefined && data.newContent !== null) {
    embed.addFields({
      name: "📝 Contenido Nuevo",
      value: truncateForEmbedField(data.newContent) || "_Vacío_",
      inline: false,
    });
  } else {
    embed.addFields({
      name: "📝 Contenido Nuevo",
      value: "_Vacío_",
      inline: false,
    });
  }

  return embed;
}

/**
 * Build an embed for message delete events
 */
export function buildMessageDeleteEmbed(data: {
  authorTag: string;
  authorAvatarURL?: string;
  channelName: string;
  channelId: string;
  messageId: string;
  content?: string | null;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0xe74c3c) // Red for deletes
    .setAuthor({ name: data.authorTag, iconURL: data.authorAvatarURL })
    .setTitle("Mensaje Eliminado")
    .addFields(
      {
        name: "💬 Canal",
        value: `#${data.channelName}`,
        inline: true,
      },
      {
        name: "🆔 ID del Mensaje",
        value: `\`${data.messageId}\``,
        inline: true,
      },
    )
    .setFooter({
      text: `Mensaje eliminado en #${data.channelName}`,
    })
    .setTimestamp();

  // Add content field if available
  if (data.content !== undefined && data.content !== null && data.content.trim()) {
    embed.addFields({
      name: "📄 Contenido",
      value: truncateForEmbedField(data.content),
      inline: false,
    });
  } else {
    embed.addFields({
      name: "📄 Contenido",
      value: "_Contenido no disponible_",
      inline: false,
    });
  }

  return embed;
}
