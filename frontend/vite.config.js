import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // expose on LAN so a phone can open http://<your-ip>:5173
    port: 5173,
  },
});
