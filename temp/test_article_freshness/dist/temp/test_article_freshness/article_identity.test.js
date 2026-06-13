"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const articleIdentity_1 = require("../../lib/articleIdentity");
function article(partial) {
    var _a;
    const value = Object.assign({ title: "Market update", link: "https://example.com/news?id=42&utm_source=rss", description: "Summary", pubDate: "2026-06-13T02:00:00.000Z", source: "Example", category: "科技" }, partial);
    return Object.assign(Object.assign({}, value), { id: (_a = value.id) !== null && _a !== void 0 ? _a : (0, articleIdentity_1.createArticleIdentity)(value) });
}
const sameByUrlA = article({ title: "First title" });
const sameByUrlB = article({
    title: "Second title",
    link: "https://example.com/news?id=42&utm_campaign=ignored",
});
strict_1.default.equal((0, articleIdentity_1.createArticleIdentity)(sameByUrlA), (0, articleIdentity_1.createArticleIdentity)(sameByUrlB), "URL tracking params should not create a new article identity");
const duplicateItems = [
    article({ id: (0, articleIdentity_1.createArticleIdentity)(article({ title: "A" })), title: "A" }),
    article({ id: (0, articleIdentity_1.createArticleIdentity)(article({ title: "B" })), title: "B" }),
    article({ id: (0, articleIdentity_1.createArticleIdentity)(article({ title: "A copy" })), title: "A copy" }),
];
strict_1.default.equal((0, articleIdentity_1.dedupeArticles)(duplicateItems).length, 1, "duplicate feed entries should collapse");
const seen = new Set([(0, articleIdentity_1.createArticleIdentity)(article({ title: "Already seen" }))]);
const fresh = (0, articleIdentity_1.filterFreshArticles)([
    article({ title: "Already seen" }),
    article({ title: "New", link: "https://example.com/new" }),
], seen);
strict_1.default.deepEqual(fresh.map((a) => a.title), ["New"], "only unseen articles should be summarized");
console.log(JSON.stringify({
    identity: (0, articleIdentity_1.createArticleIdentity)(sameByUrlA),
    dedupedCount: (0, articleIdentity_1.dedupeArticles)(duplicateItems).length,
    freshTitles: fresh.map((a) => a.title),
}, null, 2));
