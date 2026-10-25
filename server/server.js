import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import Parser from "rss-parser";

const app = express();
app.use(cors());
app.use(express.json());

await mongoose.connect(
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/newshub",
);

// ---------- Notes model ----------
const Note = mongoose.model(
  "Note",
  new mongoose.Schema(
    {
      title: { type: String, required: true },
      link: String,
      source: String,
      highlights: [String],
      content: { type: String, default: "" },
    },
    { timestamps: true },
  ),
);

// ---------- News sources (RSS) ----------
const FEEDS = {
  "The Hindu": "https://www.thehindu.com/news/national/feeder/default.rss",
  "Times of India":
    "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",
  NDTV: "https://feeds.feedburner.com/ndtvnews-top-stories",
  "Indian Express": "https://indianexpress.com/section/india/feed/",
  BBC: "http://feeds.bbci.co.uk/news/world/rss.xml",
};
const parser = new Parser({ timeout: 8000 });
const STOP = new Set(
  "the a an and or of to in on for with is are was were be by at as it its this that from has have had will not but".split(
    " ",
  ),
);

const clean = (s = "") =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

// Extractive "4 key points": score sentences by word frequency, keep top 4 in original order.
function fourPoints(title, text) {
  const body = clean(text);
  let parts = body.split(/(?<=[.!?])\s+/).filter((s) => s.length > 20);
  if (parts.length < 4)
    parts = [
      ...parts,
      ...body
        .split(/[,;:–-]\s+/)
        .filter((s) => s.length > 20 && !parts.includes(s)),
    ];
  if (!parts.length) return [title];
  const freq = {};
  (title + " " + body)
    .toLowerCase()
    .match(/[a-z]{3,}/g)
    ?.forEach((w) => {
      if (!STOP.has(w)) freq[w] = (freq[w] || 0) + 1;
    });
  const score = (s) =>
    (s.toLowerCase().match(/[a-z]{3,}/g) || []).reduce(
      (a, w) => a + (freq[w] || 0),
      0,
    ) / Math.sqrt(s.length);
  return parts
    .map((s, i) => ({ s, i, sc: score(s) }))
    .sort((a, b) => b.sc - a.sc)
    .slice(0, 4)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);
}

let cache = { at: 0, items: [] };
async function loadNews() {
  if (Date.now() - cache.at < 10 * 60 * 1000) return cache.items;
  const results = await Promise.allSettled(
    Object.entries(FEEDS).map(async ([source, url]) => {
      const feed = await parser.parseURL(url);
      return feed.items.slice(0, 15).map((it) => ({
        id: it.guid || it.link,
        title: clean(it.title),
        link: it.link,
        source,
        published: it.isoDate || it.pubDate,
        highlights: fourPoints(
          clean(it.title),
          it.contentSnippet || it.content || it.summary || "",
        ),
      }));
    }),
  );
  const items = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .sort((a, b) => new Date(b.published) - new Date(a.published));
  cache = { at: Date.now(), items };
  return items;
}

app.get("/api/sources", (_, res) => res.json(Object.keys(FEEDS)));
app.get("/api/news", async (req, res) => {
  const { source, q } = req.query;
  let items = await loadNews();
  if (source) items = items.filter((i) => i.source === source);
  if (q)
    items = items.filter((i) =>
      i.title.toLowerCase().includes(q.toLowerCase()),
    );
  res.json(items);
});

// ---------- Notes CRUD ----------
app.get("/api/notes", async (_, res) =>
  res.json(await Note.find().sort({ updatedAt: -1 })),
);
app.post("/api/notes", async (req, res) =>
  res.status(201).json(await Note.create(req.body)),
);
app.put("/api/notes/:id", async (req, res) =>
  res.json(
    await Note.findByIdAndUpdate(req.params.id, req.body, { new: true }),
  ),
);
app.delete("/api/notes/:id", async (req, res) => {
  await Note.findByIdAndDelete(req.params.id);
  res.sendStatus(204);
});

app.listen(5000, () => console.log("API on http://localhost:5000"));
