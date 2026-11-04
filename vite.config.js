import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base relativa: funciona en https://<usuario>.github.io/EvaEfe/ y en local
export default defineConfig({
  plugins: [react()],
  base: "./",
});
