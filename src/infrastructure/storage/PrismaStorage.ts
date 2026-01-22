import { PrismaClient } from "../../generated/prisma/client";
import logger from "../../utils/logger";
export interface PrismaStorageOptions {
  prismaClient: PrismaClient;
  modelName: string;
  enableLogs?: boolean;
  enableCache?: boolean;
  cacheTTL?: number;
}

export interface QueryFilter {
  where?: any;
  orderBy?: any;
  skip?: number;
  take?: number;
  include?: any;
  select?: any;
}

export class PrismaStorage<T extends { id?: string | number }> {
  private prisma: PrismaClient;
  private modelName: string;
  private enableLogs: boolean;
  private cache: Map<string | number, { data: T; timestamp: number }> | null =
    null;
  private cacheTTL: number;

  constructor(options: PrismaStorageOptions) {
    this.prisma = options.prismaClient;
    this.modelName = options.modelName;
    this.enableLogs = options.enableLogs ?? false;
    this.cacheTTL = options.cacheTTL ?? 60000;

    if (options.enableCache) {
      this.cache = new Map();
    }

    if (options.enableLogs) {
      logger.info(`PrismaStorage initialized for model ${this.modelName}`);
    }
  }

  private getModel() {
    return (this.prisma as any)[this.modelName];
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.cacheTTL;
  }

  async create(data: Omit<T, "id">): Promise<T> {
    try {
      const result = await this.getModel().create({ data });
      if (this.enableLogs) {
        logger.info(`Created ${this.modelName} with id ${result.id}`);
      }
      if (this.cache && result.id) {
        this.cache.set(result.id, { data: result, timestamp: Date.now() });
      }
      return result as T;
    } catch (error) {
      if (this.enableLogs) {
        logger.error(`Error creating ${this.modelName}:`, error);
      }
      throw error;
    }
  }

  async findById(guildId: string | number): Promise<T | null> {
    if (this.cache) {
      const cached = this.cache.get(guildId);
      if (cached && this.isCacheValid(cached.timestamp)) {
        if (this.enableLogs) {
          logger.info(`Found ${this.modelName} with id ${guildId} in cache`);
        }
        return cached.data;
      }
    }
    try {
      const result = await this.getModel().findUnique({ where: { guildId } });
      if (result && this.cache) {
        this.cache.set(guildId, { data: result, timestamp: Date.now() });
      }
      return result as T | null;
    } catch (error) {
      if (this.enableLogs) {
        logger.error(
          `Error finding ${this.modelName} with id ${guildId}:`,
          error,
        );
      }
      throw error;
    }
  }

  async update(guildId: string | number, data: Partial<T>): Promise<T> {
    try {
      const result = await this.getModel().update({
        where: { guildId },
        data,
      });
      if (this.cache) {
        this.cache.set(guildId, { data: result, timestamp: Date.now() });
      }
      if (this.enableLogs) {
        logger.info(`Updated ${this.modelName} with id ${guildId}`);
      }
      return result as T;
    } catch (error) {
      if (this.enableLogs) {
        logger.error(
          `Error updating ${this.modelName} with id ${guildId}:`,
          error,
        );
      }
      throw error;
    }
  }

  async delete(guildId: string | number): Promise<void> {
    try {
      await this.getModel().delete({ where: { guildId } });
      if (this.cache) {
        this.cache.delete(guildId);
      }
      if (this.enableLogs) {
        logger.info(`Deleted ${this.modelName} with id ${guildId}`);
      }
    } catch (error) {
      if (this.enableLogs) {
        logger.error(
          `Error deleting ${this.modelName} with id ${guildId}:`,
          error,
        );
      }
      throw error;
    }
  }

  async upsert(guildId: string | number, data: Partial<T>): Promise<T> {
    try {
      const result = await this.getModel().upsert({
        where: { guildId },
        create: { guildId, ...data },
        update: data,
      });
      if (this.cache) {
        this.cache.set(guildId, { data: result, timestamp: Date.now() });
      }
      if (this.enableLogs) {
        logger.info(`Upserted ${this.modelName} with id ${guildId}`);
      }
      return result as T;
    } catch (error) {
      if (this.enableLogs) {
        logger.error(
          `Error upserting ${this.modelName} with id ${guildId}:`,
          error,
        );
      }
      throw error;
    }
  }

  async findMany(): Promise<T[]> {
    try {
      const result = await this.getModel().findMany();
      if (this.cache) {
        this.cache.set("all", { data: result, timestamp: Date.now() });
      }
      if (this.enableLogs) {
        logger.info(`Fetched all ${this.modelName}s`);
      }
      return result as T[];
    } catch (error) {
      if (this.enableLogs) {
        logger.error(`Error fetching all ${this.modelName}s:`, error);
      }
      throw error;
    }
  }
}
