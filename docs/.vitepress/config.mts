import { defineConfig } from "vitepress";

export default defineConfig({
  title: "socket-store",
  description: "WebSocket-first topic state store",
  srcDir: "./guide",
  themeConfig: {
    nav: [{ text: "Guide", link: "/" }],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Overview", link: "/" },
          { text: "API Contract", link: "/api" },
          { text: "Runnable Example", link: "/example" },
        ],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/nerdchanii/socket-store" },
    ],
  },
});
