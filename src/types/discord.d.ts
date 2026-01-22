import { Collection } from "discord.js";

declare module "discord.js" {
  export interface Client {
    commands: Collection<string, any>;
  }
}

export interface Command {
  data: {
    name: string;
    description: string;
  };
  execute: (interaction: any) => Promise<void>;
}
