import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: mode === "development" ? {
      "/auth": { target: "http://localhost:4000", changeOrigin: true },
      "/hotel": { target: "http://localhost:4000", changeOrigin: true },
      "/restaurant": { target: "http://localhost:4000", changeOrigin: true },
      "/bar": { target: "http://localhost:4000", changeOrigin: true },
      "/spa": { target: "http://localhost:4000", changeOrigin: true },
      "/cash": { target: "http://localhost:4000", changeOrigin: true },
      "/invoices": { target: "http://localhost:4000", changeOrigin: true },
      "/reports": { target: "http://localhost:4000", changeOrigin: true },
      "/inventory": { target: "http://localhost:4000", changeOrigin: true },
    } : undefined,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
