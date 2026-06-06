import tailwindcss from "@tailwindcss/vite";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

const serverOnlyDependencies = [
  "@better-auth/drizzle-adapter",
  "@better-auth/kysely-adapter",
  "@neondatabase/serverless",
  "better-auth",
  "drizzle-orm",
  "kysely",
];

export default defineConfig({
  optimizeDeps: {
    exclude: serverOnlyDependencies,
  },
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
});
