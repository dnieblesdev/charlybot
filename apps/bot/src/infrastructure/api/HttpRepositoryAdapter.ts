import { apiClient } from "./ApiClient";

export abstract class HttpRepositoryAdapter {
  protected client = apiClient.api;

  protected handleError(error: any, context: string): never {
    // Already logged in ApiClient hook, but we can add more context here if needed
    throw error;
  }
}
