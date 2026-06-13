import assert from "node:assert/strict";
import {
  extractArticleContent,
  extractMetricCandidates,
} from "../../lib/articleContent";

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

const content = extractArticleContent(html, "https://example.com/article");

assert.equal(content.status, "ok");
assert.equal(content.title, "Chipmaker revenue rises sharply");
assert.ok(content.text.includes("Chipmaker revenue rose 12% to $3.2bn"));
assert.ok(!content.text.includes("Login Subscribe"));
assert.ok(content.excerpt.length > 80);

const metrics = extractMetricCandidates(content.text);
assert.ok(metrics.some((m) => m.rawText.includes("12%")), "percentage metrics should be extracted");
assert.ok(metrics.some((m) => m.rawText.includes("$3.2bn")), "money metrics should be extracted");
assert.ok(metrics.some((m) => m.rawText.includes("48 million units")), "unit metrics should be extracted");

console.log(JSON.stringify({
  status: content.status,
  title: content.title,
  excerpt: content.excerpt,
  metrics: metrics.map((m) => m.rawText),
}, null, 2));
