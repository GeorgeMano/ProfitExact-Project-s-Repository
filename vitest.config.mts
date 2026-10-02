import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Aceeași alias-are ca în tsconfig.json, ca testele să poată importa
    // module care folosesc „@/…” pentru valori, nu doar pentru tipuri.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
