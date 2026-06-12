export interface NewsSource {
  id: string;
  name: string;
  category: string;
  rssUrl: string;
  enabled: boolean;
}

export interface AppConfig {
  sources: NewsSource[];
}

export interface NewsArticle {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
  category: string;
}

export interface BulletPoint {
  text: string;
  source: string;
  link: string;
}

export interface CategoryDigest {
  category: string;
  bullets: BulletPoint[];
}

export interface DailyDigest {
  date: string;
  generatedAt: string;
  overview: string;
  categories: CategoryDigest[];
  totalArticles: number;
  sources: string[];
}
