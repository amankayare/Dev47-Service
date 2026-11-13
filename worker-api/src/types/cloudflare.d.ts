export {};

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    HYPERDRIVE?: Hyperdrive;
    UPLOADS?: R2Bucket;
  }
}
