import { Events, TextChannel, EmbedBuilder } from "discord.js";
import type { GuildMember } from "discord.js";
import { getGuildConfig } from "../../config/repositories/GuildConfigRepo.ts";
import { listSocialLinks } from "../../config/repositories/SocialLinkRepo.ts";
import { listWelcomeCustomVars } from "../../config/repositories/WelcomeCustomVarRepo.ts";
import logger from "../../utils/logger.ts";

/**
 * Formats a welcome message template by replacing placeholders.
 *
 * Placeholders:
 * - `{user}` → member mention
 * - `{username}` → member username
 * - `{server}` → guild name
 * - `{name}` → first look up WelcomeCustomVar[name], then SocialLink[name] (name as platform key),
 *              leave as-is if neither found
 */
export function formatWelcomeMessage(
  template: string,
  member: GuildMember,
  customVars: Map<string, string>,
  socialLinks: Map<string, string>
) {
  return template
    .replace(/{user}/g, member.toString())
    .replace(/{username}/g, member.user.username)
    .replace(/{server}/g, member.guild.name)
    .replace(/{(\w+)}/g, (_, name: string) => {
      // Built-in variables handled above; skip them here
      if (name === "user" || name === "username" || name === "server") {
        return `{${name}}`;
      }
      // Try WelcomeCustomVar first
      if (customVars.has(name)) {
        return customVars.get(name)!;
      }
      // Fall back to SocialLink using name as platform (no "enlace_" prefix)
      if (socialLinks.has(name.toLowerCase())) {
        return socialLinks.get(name.toLowerCase())!;
      }
      // Leave as-is if not found
      return `{${name}}`;
    });
}

export default {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member: GuildMember) {
    try {
      const guildId = member.guild.id;
      const config = await getGuildConfig(guildId);

      if (!config || !config.welcomeChannelId) return;

      const channelId = config.welcomeChannelId;
      const messageTemplate = config.welcomeMessage;

      const channel = member.guild.channels.cache.get(channelId);

      if (!channel) {
        logger.warn(
          {
            guildId,
            channelId,
          },
          "Canal de bienvenida no encontrado en caché"
        );
        return;
      }

      if (!(channel instanceof TextChannel) && !channel.isThread()) {
        logger.warn(
          {
            guildId,
            channelId,
          },
          "El canal de bienvenida no es un canal de texto"
        );
        return;
      }

      // Si hay mensaje personalizado, usarlo
      if (messageTemplate) {
        // Always fetch both maps when a custom message exists
        const [customVars, socialLinks] = await Promise.all([
          listWelcomeCustomVars(guildId),
          listSocialLinks(guildId),
        ]);

        logger.debug(
          {
            guildId,
            customVarsKeys: [...customVars.keys()],
            socialLinksKeys: [...socialLinks.keys()],
            template: messageTemplate,
          },
          "formatWelcomeMessage inputs"
        );

        const finalMessage = formatWelcomeMessage(
          messageTemplate,
          member,
          customVars,
          socialLinks
        );
        await (channel as TextChannel).send({ content: finalMessage });
      } else {
        // Si no hay mensaje personalizado, usar embed por defecto
        const userAvatar = member.user.displayAvatarURL({ size: 256 });
        const accountCreated = Math.floor(member.user.createdTimestamp / 1000);

        const embed = new EmbedBuilder()
          .setColor(0x2ecc71) // Verde para indicar bienvenida
          .setAuthor({
            name: "¡Nuevo miembro!",
            iconURL: member.guild.iconURL() || undefined,
          })
          .setThumbnail(userAvatar)
          .setDescription(
            `🎉 ¡Bienvenido/a **${member.user.tag}** a **${member.guild.name}**!`
          )
          .addFields(
            {
              name: "👤 Usuario",
              value: `${member}`,
              inline: true,
            },
            {
              name: "🆔 ID",
              value: `\`${member.id}\``,
              inline: true,
            },
            {
              name: "📊 Miembro número",
              value: `#${member.guild.memberCount}`,
              inline: true,
            },
            {
              name: "📅 Cuenta creada",
              value: `<t:${accountCreated}:R>`,
              inline: false,
            }
          )
          .setFooter({
            text: `¡Esperamos que disfrutes tu estancia!`,
            iconURL: member.guild.iconURL() || undefined,
          })
          .setTimestamp();

        await (channel as TextChannel).send({ embeds: [embed] });
      }

      logger.info(
        {
          guildId,
          channelId,
          userId: member.id,
          userTag: member.user.tag,
          hasCustomMessage: !!messageTemplate,
        },
        "Mensaje de bienvenida enviado correctamente"
      );
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          guildId: member.guild?.id,
        },
        "Error al enviar mensaje de bienvenida"
      );
    }
  },
};
