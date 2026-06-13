import assert from "node:assert/strict";
import {
  createArticleIdentity,
  dedupeArticles,
  filterFreshArticles,
} from "../../lib/articleIdentity";
import type { NewsArticle } from "../../types";

function article(partial: Partial<NewsArticle>): NewsArticle {
  const value = {
    title: "Market update",
    link: "https://example.com/news?id=42&utm_source=rss",
    description: "Summary",
    pubDate: "2026-06-13T02:00:00.000Z",
    source: "Example",
    category: "科技",
    ...partial,
  };
  return {
    ...value,
    id: value.id ?? createArticleIdentity(value),
  };
}

const sameByUrlA = article({ title: "First title" });
const sameByUrlB = article({
  title: "Second title",
  link: "https://example.com/news?id=42&utm_campaign=ignored",
});
assert.equal(
  createArticleIdentity(sameByUrlA),
  createArticleIdentity(sameByUrlB),
  "URL tracking params should not create a new article identity",
);

const duplicateItems = [
  article({ id: createArticleIdentity(article({ title: "A" })), title: "A" }),
  article({ id: createArticleIdentity(article({ title: "B" })), title: "B" }),
  article({ id: createArticleIdentity(article({ title: "A copy" })), title: "A copy" }),
];
assert.equal(dedupeArticles(duplicateItems).length, 1, "duplicate feed entries should collapse");

const seen = new Set([createArticleIdentity(article({ title: "Already seen" }))]);
const fresh = filterFreshArticles([
  article({ title: "Already seen" }),
  article({ title: "New", link: "https://example.com/new" }),
], seen);
assert.deepEqual(fresh.map((a) => a.title), ["New"], "only unseen articles should be summarized");

console.log(JSON.stringify({
  identity: createArticleIdentity(sameByUrlA),
  dedupedCount: dedupeArticles(duplicateItems).length,
  freshTitles: fresh.map((a) => a.title),
}, null, 2));
