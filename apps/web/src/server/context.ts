import type { Config } from "./config.ts";
import type { Database, Sql } from "./db.ts";
import type { Chain } from "./chain.ts";
import type { ObjectStorage } from "./storage.ts";
import type { Session } from "./auth.ts";
export interface App {
  config: Config;
  db: Database;
  chain: Chain;
  storage: ObjectStorage;
  now: () => number;
}
export interface Context {
  app: App;
  sql: Sql;
  session: Session;
  requestId: string;
  now: number;
}
