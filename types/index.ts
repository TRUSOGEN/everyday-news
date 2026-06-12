export interface NewsSource {
  id: string;
  name: string;
  category: string;
  rssUrl: string;
  enabled: boolean;
}

export type ModelId = "claude-haiku-4-5" | "claude-sonnet-4-6" | "claude-opus-4-8";
export type SummaryLength = "brief" | "standard" | "detailed";
export type ReportFormat = "bullets" | "paragraphs" | "executive";
export type ReportLanguage = "zh" | "en" | "bilingual";

export interface AiConfig {
  model: ModelId;
  summaryLength: SummaryLength;
  format: ReportFormat;
  language: ReportLanguage;
  maxBulletsPerCategory: number;
  showPerspective: boolean;
  customSystemPrompt?: string;
}

export interface ScheduleConfig {
  hour: number; // 0–23, Beijing time
}

export interface AppConfig {
  sources: NewsSource[];
  ai: AiConfig;
  schedule: ScheduleConfig;
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
  perspective?: string;
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
