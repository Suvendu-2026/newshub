import { useEffect, useState } from "react";

const api = (url, opts) =>
  fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });

export default function App() {
  const [tab, setTab] = useState("news");
  const [sources, setSources] = useState([]);
  const [source, setSource] = useState("");
  const [q, setQ] = useState("");
  const [news, setNews] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null); // note being edited

  const loadNews = async () => {
    setLoading(true);
    const p = new URLSearchParams({
      ...(source && { source }),
      ...(q && { q }),
    });
    setNews(await (await api(`/api/news?${p}`)).json());
    setLoading(false);
  };
  const loadNotes = async () =>
    setNotes(await (await api("/api/notes")).json());

  useEffect(() => {
    api("/api/sources")
      .then((r) => r.json())
      .then(setSources);
    loadNotes();
  }, []);
  useEffect(() => {
    loadNews();
  }, [source]);

  const saveNote = async (n, content) => {
    // CREATE
    await api("/api/notes", {
      method: "POST",
      body: JSON.stringify({
        title: n.title,
        link: n.link,
        source: n.source,
        highlights: n.highlights,
        content,
      }),
    });
    loadNotes();
    setTab("notes");
  };
  const updateNote = async (id, content) => {
    // UPDATE
    await api(`/api/notes/${id}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
    setEditing(null);
    loadNotes();
  };
  const deleteNote = async (id) => {
    // DELETE
    await api(`/api/notes/${id}`, { method: "DELETE" });
    loadNotes();
  };

  return (
    <div className="wrap">
      <header>
        <h1>NewsHub</h1>
        <nav>
          <button
            className={tab === "news" ? "on" : ""}
            onClick={() => setTab("news")}
          >
            Latest News
          </button>
          <button
            className={tab === "notes" ? "on" : ""}
            onClick={() => setTab("notes")}
          >
            My Notes ({notes.length})
          </button>
        </nav>
      </header>

      {tab === "news" && (
        <>
          <div className="bar">
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">All newspapers</option>
              {sources.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <input
              placeholder="Search headlines…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadNews()}
            />
            <button onClick={loadNews}>Search</button>
          </div>
          {loading && <p>Loading…</p>}
          {news.map((n) => (
            <NewsCard key={n.id} n={n} onSave={saveNote} />
          ))}
        </>
      )}

      {tab === "notes" && (
        <>
          {!notes.length && <p>No notes yet. Save one from the news feed.</p>}
          {notes.map((n) => (
            <article key={n._id} className="card">
              <span className="src">{n.source}</span>
              <h2>
                <a href={n.link} target="_blank" rel="noreferrer">
                  {n.title} ↗
                </a>
              </h2>
              <Points list={n.highlights} />
              {editing === n._id ? (
                <NoteEditor
                  initial={n.content}
                  onSave={(c) => updateNote(n._id, c)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <>
                  <p className="note">{n.content || <i>No note text.</i>}</p>
                  <button onClick={() => setEditing(n._id)}>Edit</button>
                  <button className="danger" onClick={() => deleteNote(n._id)}>
                    Delete
                  </button>
                </>
              )}
            </article>
          ))}
        </>
      )}
    </div>
  );
}

function Points({ list = [] }) {
  return (
    <ol className="points">
      {list.map((p, i) => (
        <li key={i}>{p}</li>
      ))}
    </ol>
  );
}

function NewsCard({ n, onSave }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="card">
      <span className="src">
        {n.source} · {n.published ? new Date(n.published).toLocaleString() : ""}
      </span>
      <h2>
        <a href={n.link} target="_blank" rel="noreferrer">
          {n.title} ↗
        </a>
      </h2>
      <Points list={n.highlights} />
      {open ? (
        <NoteEditor
          initial=""
          onSave={(c) => onSave(n, c)}
          onCancel={() => setOpen(false)}
        />
      ) : (
        <button onClick={() => setOpen(true)}>+ Add note</button>
      )}
    </article>
  );
}

function NoteEditor({ initial, onSave, onCancel }) {
  const [text, setText] = useState(initial);
  return (
    <div>
      <textarea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write your note…"
      />
      <button onClick={() => onSave(text)}>Save</button>
      <button className="ghost" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
