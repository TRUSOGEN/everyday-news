import type { AppConfig } from "@/types";

export const DEFAULT_CONFIG: AppConfig = {
  sources: [
    {
      id: "bbc-business",
      name: "BBC Business",
      category: "商业财经",
      rssUrl: "https://feeds.bbci.co.uk/news/business/rss.xml",
      enabled: true,
    },
    {
      id: "bbc-technology",
      name: "BBC Technology",
      category: "科技",
      rssUrl: "https://feeds.bbci.co.uk/news/technology/rss.xml",
      enabled: true,
    },
  ],
  ai: {
    model: "claude-haiku-4-5",
    summaryLength: "standard",
    format: "bullets",
    language: "zh",
    maxBulletsPerCategory: 5,
    showPerspective: true,
  },
  schedule: {
    hour: 12,
  },
};
