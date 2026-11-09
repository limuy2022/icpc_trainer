declare namespace Cloudflare {
  interface Env {
    GLM_API_KEY?: string;
    GLM_MODEL?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
