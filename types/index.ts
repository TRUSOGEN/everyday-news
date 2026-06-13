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
  id: string;
  guid?: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
  category: string;
  contentText?: string;
  contentExcerpt?: string;
  contentStatus?: ArticleContentStatus;
  metrics?: ArticleMetric[];
}

export type ArticleContentStatus = "ok" | "empty" | "unsupported" | "failed";

export interface ArticleMetric {
  kind: "percent" | "money" | "number";
  rawText: string;
  value?: number;
  unit?: string;
  context: string;
}

export interface ArticleContent {
  articleId: string;
  url: string;
  title: string;
  text: string;
  excerpt: string;
  status: ArticleContentStatus;
  metrics: ArticleMetric[];
  fetchedAt: string;
  error?: string;
}

export interface BulletPoint {
  text: string;
  source: string;
  link: string;
  perspective?: string;
  articleId?: string;
  evidenceExcerpt?: string;
  metrics?: ArticleMetric[];
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
