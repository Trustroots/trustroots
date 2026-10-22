import { DatabaseSync } from 'node:sqlite';
import type { Catalogue, Entry } from '../shared.ts';

interface Draft {
  sourceHash: string;
  original: string | null;
  suggestion: string;
  model: string;
  revision: string;
}

export class Store {
  readonly db: DatabaseSync;
  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS drafts (locale TEXT, id TEXT, data TEXT NOT NULL, PRIMARY KEY(locale,id));
      CREATE TABLE IF NOT EXISTS batches (id TEXT PRIMARY KEY, author TEXT NOT NULL, created INTEGER NOT NULL, url TEXT);
      CREATE TABLE IF NOT EXISTS signatures (id TEXT PRIMARY KEY, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sources (locale TEXT, id TEXT, hash TEXT NOT NULL, PRIMARY KEY(locale,id));
    `);
  }

  saveDraft(
    locale: string,
    entry: Entry,
    suggestion: string,
    model: string,
    revision: string,
  ) {
    const draft: Draft = {
      sourceHash: entry.sourceHash,
      original: entry.original,
      suggestion,
      model,
      revision,
    };
    this.db
      .prepare('INSERT OR REPLACE INTO drafts VALUES (?, ?, ?)')
      .run(locale, entry.id, JSON.stringify(draft));
  }

  withDrafts(catalogue: Catalogue): Catalogue {
    return {
      ...catalogue,
      entries: catalogue.entries.map(current => {
        this.db
          .prepare(
            `INSERT INTO sources VALUES (?, ?, ?)
          ON CONFLICT(locale,id) DO UPDATE SET hash=excluded.hash WHERE ? AND sources.hash <> excluded.hash`,
          )
          .run(
            catalogue.locale,
            current.id,
            current.sourceHash,
            Number(current.reviewed === true),
          );
        const baseline = this.db
          .prepare('SELECT hash FROM sources WHERE locale=? AND id=?')
          .get(catalogue.locale, current.id)!;
        const entry = {
          ...current,
          needsReview:
            current.needsReview || baseline.hash !== current.sourceHash,
        };
        const row = this.db
          .prepare('SELECT data FROM drafts WHERE locale=? AND id=?')
          .get(catalogue.locale, entry.id);
        if (!row) return entry;
        const draft = JSON.parse(String(row.data)) as Draft;
        return draft.sourceHash === entry.sourceHash &&
          draft.original === entry.original
          ? { ...entry, suggestion: draft.suggestion, model: draft.model }
          : entry;
      }),
    };
  }

  consumeSignature(id: string, now: number) {
    this.db.prepare('DELETE FROM signatures WHERE expires < ?').run(now);
    return (
      this.db
        .prepare('INSERT OR IGNORE INTO signatures VALUES (?, ?)')
        .run(id, now + 120).changes === 1
    );
  }

  batch(id: string) {
    return this.db.prepare('SELECT url FROM batches WHERE id=?').get(id);
  }

  reserve(id: string, author: string, now: number) {
    if (this.batch(id)) return true;
    const count = this.db
      .prepare(
        'SELECT count(*) AS total FROM batches WHERE author=? AND created>?',
      )
      .get(author, now - 3600)!;
    if (Number(count.total) >= 5) return false;
    this.db
      .prepare('INSERT INTO batches VALUES (?, ?, ?, NULL)')
      .run(id, author, now);
    return true;
  }

  complete(id: string, url: string) {
    this.db.prepare('UPDATE batches SET url=? WHERE id=?').run(url, id);
  }

  close() {
    this.db.close();
  }
}
