// vite.config.ts
import { defineConfig } from "file:///D:/Mon%20Cours/Le%C3%A7on%20L2/S2/Stage/GoldenKey/GoldenKey_front/node_modules/vite/dist/node/index.js";
import react from "file:///D:/Mon%20Cours/Le%C3%A7on%20L2/S2/Stage/GoldenKey/GoldenKey_front/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { componentTagger } from "file:///D:/Mon%20Cours/Le%C3%A7on%20L2/S2/Stage/GoldenKey/GoldenKey_front/node_modules/lovable-tagger/dist/index.js";
var __vite_injected_original_dirname = "D:\\Mon Cours\\Le\xE7on L2\\S2\\Stage\\GoldenKey\\GoldenKey_front";
var vite_config_default = defineConfig(({ mode }) => ({
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
      "/inventory": { target: "http://localhost:4000", changeOrigin: true }
    } : void 0
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxNb24gQ291cnNcXFxcTGVcdTAwRTdvbiBMMlxcXFxTMlxcXFxTdGFnZVxcXFxHb2xkZW5LZXlcXFxcR29sZGVuS2V5X2Zyb250XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxNb24gQ291cnNcXFxcTGVcdTAwRTdvbiBMMlxcXFxTMlxcXFxTdGFnZVxcXFxHb2xkZW5LZXlcXFxcR29sZGVuS2V5X2Zyb250XFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9Nb24lMjBDb3Vycy9MZSVDMyVBN29uJTIwTDIvUzIvU3RhZ2UvR29sZGVuS2V5L0dvbGRlbktleV9mcm9udC92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XHJcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XHJcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCB7IGNvbXBvbmVudFRhZ2dlciB9IGZyb20gXCJsb3ZhYmxlLXRhZ2dlclwiO1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4gKHtcclxuICBzZXJ2ZXI6IHtcclxuICAgIGhvc3Q6IFwiOjpcIixcclxuICAgIHBvcnQ6IDgwODAsXHJcbiAgICBwcm94eTogbW9kZSA9PT0gXCJkZXZlbG9wbWVudFwiID8ge1xyXG4gICAgICBcIi9hdXRoXCI6IHsgdGFyZ2V0OiBcImh0dHA6Ly9sb2NhbGhvc3Q6NDAwMFwiLCBjaGFuZ2VPcmlnaW46IHRydWUgfSxcclxuICAgICAgXCIvaG90ZWxcIjogeyB0YXJnZXQ6IFwiaHR0cDovL2xvY2FsaG9zdDo0MDAwXCIsIGNoYW5nZU9yaWdpbjogdHJ1ZSB9LFxyXG4gICAgICBcIi9yZXN0YXVyYW50XCI6IHsgdGFyZ2V0OiBcImh0dHA6Ly9sb2NhbGhvc3Q6NDAwMFwiLCBjaGFuZ2VPcmlnaW46IHRydWUgfSxcclxuICAgICAgXCIvYmFyXCI6IHsgdGFyZ2V0OiBcImh0dHA6Ly9sb2NhbGhvc3Q6NDAwMFwiLCBjaGFuZ2VPcmlnaW46IHRydWUgfSxcclxuICAgICAgXCIvc3BhXCI6IHsgdGFyZ2V0OiBcImh0dHA6Ly9sb2NhbGhvc3Q6NDAwMFwiLCBjaGFuZ2VPcmlnaW46IHRydWUgfSxcclxuICAgICAgXCIvY2FzaFwiOiB7IHRhcmdldDogXCJodHRwOi8vbG9jYWxob3N0OjQwMDBcIiwgY2hhbmdlT3JpZ2luOiB0cnVlIH0sXHJcbiAgICAgIFwiL2ludm9pY2VzXCI6IHsgdGFyZ2V0OiBcImh0dHA6Ly9sb2NhbGhvc3Q6NDAwMFwiLCBjaGFuZ2VPcmlnaW46IHRydWUgfSxcclxuICAgICAgXCIvcmVwb3J0c1wiOiB7IHRhcmdldDogXCJodHRwOi8vbG9jYWxob3N0OjQwMDBcIiwgY2hhbmdlT3JpZ2luOiB0cnVlIH0sXHJcbiAgICAgIFwiL2ludmVudG9yeVwiOiB7IHRhcmdldDogXCJodHRwOi8vbG9jYWxob3N0OjQwMDBcIiwgY2hhbmdlT3JpZ2luOiB0cnVlIH0sXHJcbiAgICB9IDogdW5kZWZpbmVkLFxyXG4gIH0sXHJcbiAgcGx1Z2luczogW3JlYWN0KCksIG1vZGUgPT09IFwiZGV2ZWxvcG1lbnRcIiAmJiBjb21wb25lbnRUYWdnZXIoKV0uZmlsdGVyKEJvb2xlYW4pLFxyXG4gIHJlc29sdmU6IHtcclxuICAgIGFsaWFzOiB7XHJcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxyXG4gICAgfSxcclxuICB9LFxyXG59KSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBaVgsU0FBUyxvQkFBb0I7QUFDOVksT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUNqQixTQUFTLHVCQUF1QjtBQUhoQyxJQUFNLG1DQUFtQztBQU16QyxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssT0FBTztBQUFBLEVBQ3pDLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE9BQU8sU0FBUyxnQkFBZ0I7QUFBQSxNQUM5QixTQUFTLEVBQUUsUUFBUSx5QkFBeUIsY0FBYyxLQUFLO0FBQUEsTUFDL0QsVUFBVSxFQUFFLFFBQVEseUJBQXlCLGNBQWMsS0FBSztBQUFBLE1BQ2hFLGVBQWUsRUFBRSxRQUFRLHlCQUF5QixjQUFjLEtBQUs7QUFBQSxNQUNyRSxRQUFRLEVBQUUsUUFBUSx5QkFBeUIsY0FBYyxLQUFLO0FBQUEsTUFDOUQsUUFBUSxFQUFFLFFBQVEseUJBQXlCLGNBQWMsS0FBSztBQUFBLE1BQzlELFNBQVMsRUFBRSxRQUFRLHlCQUF5QixjQUFjLEtBQUs7QUFBQSxNQUMvRCxhQUFhLEVBQUUsUUFBUSx5QkFBeUIsY0FBYyxLQUFLO0FBQUEsTUFDbkUsWUFBWSxFQUFFLFFBQVEseUJBQXlCLGNBQWMsS0FBSztBQUFBLE1BQ2xFLGNBQWMsRUFBRSxRQUFRLHlCQUF5QixjQUFjLEtBQUs7QUFBQSxJQUN0RSxJQUFJO0FBQUEsRUFDTjtBQUFBLEVBQ0EsU0FBUyxDQUFDLE1BQU0sR0FBRyxTQUFTLGlCQUFpQixnQkFBZ0IsQ0FBQyxFQUFFLE9BQU8sT0FBTztBQUFBLEVBQzlFLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxJQUN0QztBQUFBLEVBQ0Y7QUFDRixFQUFFOyIsCiAgIm5hbWVzIjogW10KfQo=
