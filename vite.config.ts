import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { minimal2023Preset as preset } from "@vite-pwa/assets-generator/config";
import { VitePWA } from "vite-plugin-pwa";

const APP_BACKGROUND = "#1e1f22";

export default defineConfig(({ mode }) => {
  // Read the root .env (Vite's root is ./web) so the proxy targets the dev API port.
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = `http://localhost:${env.PORT ?? 3000}`;
  return {
    root: "web",
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        // Icons (PNG, maskable, apple-touch) are generated from the favicon at build time.
        pwaAssets: {
          image: "public/favicon.svg",
          preset: {
            ...preset,
            maskable: { ...preset.maskable, resizeOptions: { background: APP_BACKGROUND } },
            apple: { ...preset.apple, padding: 0, resizeOptions: { background: APP_BACKGROUND } },
          },
        },
        manifest: {
          name: "Silva's Tab",
          short_name: "Silva's Tab",
          description: "Minimalist kanban board",
          theme_color: "#2b2d30",
          background_color: APP_BACKGROUND,
          display: "standalone",
        },
        // Only the app shell is cached: data always comes live from the API.
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
          navigateFallbackDenylist: [/^\/api/, /^\/mcp/, /^\/healthz/, /^\/\.well-known/],
        },
      }),
    ],
    build: { outDir: "../dist/web", emptyOutDir: true, chunkSizeWarningLimit: 1000 },
    server: { proxy: { "/api": apiTarget, "/mcp": apiTarget } },
  };
});
