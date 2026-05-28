import { defineConfig } from "vitepress";

export default defineConfig({
  title: "socket-store",
  description: "WebSocket-first topic state store",
  base: "/socket-store/",
  themeConfig: {
    nav: [{ text: "Guide", link: "/" }],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Overview", link: "/" },
          { text: "API Contract", link: "/api" },
          { text: "Connection Status", link: "/connection-status" },
          { text: "Runnable Example", link: "/example" },
          { text: "Agent-Readable Docs", link: "/agents" },
        ],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/nerdchanii/socket-store" },
    ],
  },
});
