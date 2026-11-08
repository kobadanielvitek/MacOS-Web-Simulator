import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// GitHub Pages serves project sites from https://<user>.github.io/<repo>/.
// The deploy workflow sets PUBLIC_BASE_PATH so every asset URL gets that prefix.
const base = process.env.PUBLIC_BASE_PATH || "/";

// Most static assets live in /public and are referenced with absolute paths
// (e.g. "/Wallpaper/GoldenGate_6k.png"). Absolute paths ignore the Vite base,
// so rewrite them when the site is built for a sub-path.
function rebasePublicAssets() {
  return {
    name: "rebase-public-assets",
    enforce: "pre",
    transform(code, id) {
      if (base === "/" || !/\/src\/.*\.jsx?$/.test(id)) return null;
      const next = code.replace(
        /(["'`])\/(Wallpaper|icons|images)\//g,
        `$1${base}$2/`
      );
      return next === code ? null : { code: next, map: null };
    },
  };
}

export default defineConfig({
  base,
  plugins: [rebasePublicAssets(), tailwindcss(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
