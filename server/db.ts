import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Allow running without a database for this specific static app requirement
// In a real backend app, we would strictly require DATABASE_URL
const connectionString = process.env.DATABASE_URL;

export const pool = new Pool({ 
  connectionString: connectionString || "postgres://dummy:dummy@localhost:5432/dummy" 
});

// We verify connection only if we actually intend to use it. 
// For this app, we might mock it or just export it.
export const db = drizzle(pool, { schema });
