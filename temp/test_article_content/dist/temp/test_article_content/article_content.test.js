"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const articleContent_1 = require("../../lib/articleContent");
const html = `
<!doctype html>
<html>
  <head>
    <title>Ignored shell title</title>
    <meta name="description" content="A short metadata summary.">
  </head>
  <body>
    <nav>Home Markets Login Subscribe</nav>
    <article>
      <h1>Chipmaker revenue rises sharply</h1>
      <p>Chipmaker revenue rose 12% to $3.2bn in 2026 as demand for AI accelerators increased.</p>
      <p>The company said data-centre sales reached 48 million units, compared with 31 million a year earlier.</p>
      <p>Analysts warned that gross margin fell by 2 percentage points because memory costs increased.</p>
    </article>
    <script>window.__tracker = true;</script>
  </body>
</html>
`;
const content = (0, articleContent_1.extractArticleContent)(html, "https://example.com/article");
strict_1.default.equal(content.status, "ok");
strict_1.default.equal(content.title, "Chipmaker revenue rises sharply");
strict_1.default.ok(content.text.includes("Chipmaker revenue rose 12% to $3.2bn"));
strict_1.default.ok(!content.text.includes("Login Subscribe"));
strict_1.default.ok(content.excerpt.length > 80);
const metrics = (0, articleContent_1.extractMetricCandidates)(content.text);
strict_1.default.ok(metrics.some((m) => m.rawText.includes("12%")), "percentage metrics should be extracted");
strict_1.default.ok(metrics.some((m) => m.rawText.includes("$3.2bn")), "money metrics should be extracted");
strict_1.default.ok(metrics.some((m) => m.rawText.includes("48 million units")), "unit metrics should be extracted");
console.log(JSON.stringify({
    status: content.status,
    title: content.title,
    excerpt: content.excerpt,
    metrics: metrics.map((m) => m.rawText),
}, null, 2));
