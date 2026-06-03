export {};

declare module "hono" {
  interface ContextVariableMap {
    jwt: import("../auth/jwt.types").JwtPayload;
    logger: import("@charlybot/shared").CompatLogger;
  }
}
