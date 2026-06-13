"use strict";
/**
 * 新闻正文证据层。
 *
 * 这里负责从公开 HTML 中提取可读正文、生成证据摘录，并用规则抽取可审计的
 * 数字指标候选。模块不绕过登录、paywall 或反爬限制；抓取失败会显式返回失败
 * 状态，由上层决定是否退回 RSS 摘要。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractMetricCandidates = extractMetricCandidates;
exports.extractArticleContent = extractArticleContent;
exports.fetchArticleContent = fetchArticleContent;
exports.attachContentToArticle = attachContentToArticle;
const FETCH_TIMEOUT_MS = 10000;
const MAX_HTML_CHARS = 1500000;
const MAX_TEXT_CHARS = 8000;
const MAX_EXCERPT_CHARS = 900;
function decodeHtmlEntities(text) {
    const named = {
        amp: "&",
        apos: "'",
        gt: ">",
        lt: "<",
        nbsp: " ",
        quot: '"',
    };
    return text
        .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity) => {
        var _a;
        const key = entity.toLowerCase();
        if (key.startsWith("#x"))
            return String.fromCodePoint(parseInt(key.slice(2), 16));
        if (key.startsWith("#"))
            return String.fromCodePoint(parseInt(key.slice(1), 10));
        return (_a = named[key]) !== null && _a !== void 0 ? _a : `&${entity};`;
    })
        .replace(/\u00a0/g, " ");
}
function normalizeWhitespace(text) {
    return decodeHtmlEntities(text)
        .replace(/\r/g, "\n")
        .replace(/[ \t\f\v]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
function extractFirst(pattern, html) {
    const match = html.match(pattern);
    return (match === null || match === void 0 ? void 0 : match[1]) ? normalizeWhitespace(stripTags(match[1])) : "";
}
function stripTags(html) {
    return html.replace(/<[^>]+>/g, " ");
}
function removeNonContent(html) {
    return html
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
        .replace(/<nav\b[\s\S]*?<\/nav>/gi, " ")
        .replace(/<header\b[\s\S]*?<\/header>/gi, " ")
        .replace(/<footer\b[\s\S]*?<\/footer>/gi, " ")
        .replace(/<aside\b[\s\S]*?<\/aside>/gi, " ")
        .replace(/<form\b[\s\S]*?<\/form>/gi, " ");
}
function pickContentRegion(html) {
    var _a, _b, _c, _d;
    const article = (_a = html.match(/<article\b[\s\S]*?<\/article>/i)) === null || _a === void 0 ? void 0 : _a[0];
    if (article)
        return article;
    const main = (_b = html.match(/<main\b[\s\S]*?<\/main>/i)) === null || _b === void 0 ? void 0 : _b[0];
    if (main)
        return main;
    return (_d = (_c = html.match(/<body\b[\s\S]*?<\/body>/i)) === null || _c === void 0 ? void 0 : _c[0]) !== null && _d !== void 0 ? _d : html;
}
function htmlToText(html) {
    const blockSeparated = html
        .replace(/<\/(h[1-6]|p|li|blockquote|div|section|article)>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n");
    const lines = normalizeWhitespace(stripTags(blockSeparated))
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => {
        const lower = line.toLowerCase();
        if (lower.includes("cookie") && lower.includes("privacy"))
            return false;
        if (lower.includes("subscribe") && line.length < 120)
            return false;
        if (lower.includes("sign in") && line.length < 120)
            return false;
        return line.length >= 25 || /[。.!?]$/.test(line);
    });
    return lines.join("\n\n").slice(0, MAX_TEXT_CHARS);
}
function excerptFromText(text) {
    if (text.length <= MAX_EXCERPT_CHARS)
        return text;
    const clipped = text.slice(0, MAX_EXCERPT_CHARS);
    const sentenceEnd = Math.max(clipped.lastIndexOf("。"), clipped.lastIndexOf("."), clipped.lastIndexOf("!"), clipped.lastIndexOf("?"));
    return `${clipped.slice(0, sentenceEnd > 300 ? sentenceEnd + 1 : MAX_EXCERPT_CHARS).trim()}…`;
}
function metricContext(text, index, length) {
    const start = Math.max(0, index - 90);
    const end = Math.min(text.length, index + length + 90);
    return text.slice(start, end).replace(/\s+/g, " ").trim();
}
function parseNumber(raw) {
    const match = raw.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : undefined;
}
function extractMetricCandidates(text) {
    var _a;
    const patterns = [
        { kind: "money", pattern: /(?:[$€£¥]\s?\d[\d,]*(?:\.\d+)?\s?(?:tn|trillion|bn|billion|m|million|万|亿)?)/gi },
        { kind: "percent", pattern: /\b\d[\d,]*(?:\.\d+)?\s?(?:%|percentage points?\b)/gi },
        { kind: "number", pattern: /\b\d[\d,]*(?:\.\d+)?\s?(?:(?:million|billion|trillion)\s+)?(?:units|users|customers|people|shares|jobs|vehicles)\b|\b\d[\d,]*(?:\.\d+)?\s?(?:million|billion|trillion)\b/gi },
    ];
    const seen = new Set();
    const metrics = [];
    for (const { kind, pattern } of patterns) {
        for (const match of text.matchAll(pattern)) {
            const rawText = match[0].trim();
            const key = `${kind}:${rawText.toLowerCase()}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            metrics.push({
                kind,
                rawText,
                value: parseNumber(rawText),
                unit: rawText.replace(/[\d,.\s$€£¥]/g, "").trim() || undefined,
                context: metricContext(text, (_a = match.index) !== null && _a !== void 0 ? _a : 0, rawText.length),
            });
            if (metrics.length >= 12)
                return metrics;
        }
    }
    return metrics;
}
function extractArticleContent(html, url, articleId = "") {
    const boundedHtml = html.slice(0, MAX_HTML_CHARS);
    const cleanHtml = removeNonContent(boundedHtml);
    const region = pickContentRegion(cleanHtml);
    const text = htmlToText(region);
    const title = extractFirst(/<article\b[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i, cleanHtml) ||
        extractFirst(/<h1[^>]*>([\s\S]*?)<\/h1>/i, cleanHtml) ||
        extractFirst(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i, cleanHtml) ||
        extractFirst(/<title[^>]*>([\s\S]*?)<\/title>/i, cleanHtml);
    const status = text.length >= 80 ? "ok" : "empty";
    const metrics = status === "ok" ? extractMetricCandidates(text) : [];
    return {
        articleId,
        url,
        title,
        text,
        excerpt: status === "ok" ? excerptFromText(text) : "",
        status,
        metrics,
        fetchedAt: new Date().toISOString(),
    };
}
async function fetchArticleContent(article) {
    var _a;
    if (!article.link) {
        return {
            articleId: article.id,
            url: article.link,
            title: article.title,
            text: "",
            excerpt: "",
            status: "failed",
            metrics: [],
            fetchedAt: new Date().toISOString(),
            error: "文章缺少链接",
        };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(article.link, {
            signal: controller.signal,
            headers: { "User-Agent": "EverydayNews/1.0" },
        });
        const contentType = (_a = response.headers.get("content-type")) !== null && _a !== void 0 ? _a : "";
        if (!response.ok)
            throw new Error(`HTTP ${response.status}`);
        if (contentType && !contentType.includes("text/html") && !contentType.includes("text/plain")) {
            return {
                articleId: article.id,
                url: article.link,
                title: article.title,
                text: "",
                excerpt: "",
                status: "unsupported",
                metrics: [],
                fetchedAt: new Date().toISOString(),
                error: `不支持的 content-type: ${contentType}`,
            };
        }
        const html = (await response.text()).slice(0, MAX_HTML_CHARS);
        const content = extractArticleContent(html, article.link, article.id);
        return Object.assign(Object.assign({}, content), { title: content.title || article.title });
    }
    catch (error) {
        return {
            articleId: article.id,
            url: article.link,
            title: article.title,
            text: "",
            excerpt: "",
            status: "failed",
            metrics: [],
            fetchedAt: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
        };
    }
    finally {
        clearTimeout(timeout);
    }
}
function attachContentToArticle(article, content) {
    if (content.status !== "ok") {
        return Object.assign(Object.assign({}, article), { contentStatus: content.status, metrics: [] });
    }
    return Object.assign(Object.assign({}, article), { description: article.description || content.excerpt, contentText: content.text, contentExcerpt: content.excerpt, contentStatus: content.status, metrics: content.metrics });
}
