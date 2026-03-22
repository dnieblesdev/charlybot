import { z } from 'zod';

export const SubclassSchema = z.object({
  name: z.string(),
  roleId: z.string(),
  guildId: z.string()
});

export const ClassConfigSchema = z.object({
  name: z.string(),
  roleId: z.string(),
  type: z.enum(["Healer", "DPS", "Tank"]),
  typeRoleId: z.string(),
  subclasses: z.array(SubclassSchema),
  guildId: z.string()
});

export const TipoClaseSchema = z.object({
  nombre: z.string(),
  rolId: z.string(),
  guildId: z.string()
});

export type ISubclass = z.infer<typeof SubclassSchema>;
export type IClassConfig = z.infer<typeof ClassConfigSchema>;
export type ITipoClase = z.infer<typeof TipoClaseSchema>;
