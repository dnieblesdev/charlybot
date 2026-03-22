import ky from "ky";
import logger from "../../utils/logger";

export class ApiClient {
  private client: typeof ky;

  constructor(baseUrl: string, apiKey: string) {
    this.client = ky.create({
      prefixUrl: `${baseUrl}/api/v1`,
      headers: {
        "X-API-Key": apiKey,
      },
      hooks: {
        beforeError: [
          async (error) => {
            const { response } = error;
            if (response && response.body) {
              try {
                const body = await response.json();
                error.message = `${error.message} - ${JSON.stringify(body)}`;
              } catch (e) {
                // Ignore parsing errors
              }
            }
            logger.error("API Error", {
              status: response?.status,
              url: response?.url,
              message: error.message,
            });
            return error;
          },
        ],
      },
    });
  }

  get api() {
    return this.client;
  }
}

// Singleton instance
const API_URL = process.env.API_URL || "http://localhost:3000";
const API_KEY = process.env.API_KEY || "dev-key";

export const apiClient = new ApiClient(API_URL, API_KEY);
