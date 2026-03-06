import "dotenv/config";
import { defineConfig } from "prisma/config";

const isSQLite = process.env.DB_PROVIDER === "sqlite";

export default defineConfig({
  schema: isSQLite
    ? "prisma/schema.sqlite.prisma"
    : "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: isSQLite
      ? process.env["DATABASE_URL"] || "file:./dev.db"
      : process.env["DATABASE_URL"],
  },
});
