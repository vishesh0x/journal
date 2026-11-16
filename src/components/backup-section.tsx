import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Download, Loader, ShieldAlert, Upload } from "lucide-react";
import { Field, Icon, Toggle } from "@/components/dash";
import { backupName, buildBackup, download, parseBackup, restoreBackup, type ParsedBackup } from "@/lib/backup";

export function BackupSection() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [exportPassword, setExportPassword] = useState("");
  const [restorePassword, setRestorePassword] = useState("");
  const [parsed, setParsed] = useState<ParsedBackup | null>(null);
  const [fileName, setFileName] = useState("");
  const [safety, setSafety] = useState(true);
  const [understand, setUnderstand] = useState(false);
  const [busy, setBusy] = useState<"export" | "restore" | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function runExport() {
    setBusy("export");
    setError(null);
    setDone(null);
    try {
      const bytes = await buildBackup(exportPassword, setProgress);
      download(bytes, backupName());
      setExportPassword("");
      setDone("Your backup has been downloaded. Keep it somewhere private: it contains your subscribers’ email addresses.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The backup failed.");
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  async function pickFile(file: File | undefined) {
    setError(null);
    setDone(null);
    setParsed(null);
    setUnderstand(false);
    if (!file) return;
    setFileName(file.name);
    try {
      setParsed(await parseBackup(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "That file could not be read.");
    }
  }

  async function runRestore() {
    if (!parsed) return;
    setBusy("restore");
    setError(null);
    setDone(null);
    try {
      if (safety) {
        const current = await buildBackup(restorePassword, (m) => setProgress(`Safety copy: ${m}`));
        download(current, backupName("journal-before-restore"));
      }
      const result = await restoreBackup(parsed, restorePassword, setProgress);
      await queryClient.invalidateQueries();
      const r = result.restored;
      setDone(`Restored ${r.posts} posts, ${r.pages} pages, ${r.tags} topics and ${r.subscribers} subscribers, plus ${parsed.media.length} images.`);
      setParsed(null);
      setFileName("");
      setRestorePassword("");
      setUnderstand(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The restore failed.");
    } finally {
      setBusy(null);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const c = parsed?.manifest.counts ?? {};

  return (
    <section className="section-card">
      <h2 className="flex items-center gap-3">
        <Icon as={Archive} size={26} /> Backup and restore
      </h2>
      <p className="muted">
        One zip holds your posts, pages, topics, subscribers, settings and every uploaded image. Admin accounts and passwords are not included.
      </p>

      <div className="form-grid two">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (exportPassword && busy === null) void runExport();
          }}
        >
          <h3 className="h-title">Export</h3>
          <Field
            id="backup-pass"
            label="Your password"
            type="password"
            autoComplete="current-password"
            value={exportPassword}
            onChange={(e) => setExportPassword(e.target.value)}
            hint="Asked again because the file contains subscriber emails."
          />
          <button type="submit" className="btn self-start" disabled={!exportPassword || busy !== null}>
            <Icon as={busy === "export" ? Loader : Download} /> {busy === "export" ? "Working…" : "Download backup"}
          </button>
        </form>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (parsed && understand && restorePassword && busy === null) void runRestore();
          }}
        >
          <h3 className="h-title">Restore</h3>
          <div>
            <label htmlFor="backup-file" className="form-label">
              Backup file
            </label>
            <input
              id="backup-file"
              ref={fileRef}
              type="file"
              accept=".zip,application/zip"
              className="field"
              onChange={(e) => void pickFile(e.target.files?.[0])}
            />
          </div>

          {parsed ? (
            <div className="panel" style={{ padding: "var(--space-md)" }}>
              <p className="font-bold" style={{ overflowWrap: "anywhere" }}>
                {fileName}
              </p>
              <p className="small mt-1">Made {new Date(parsed.manifest.created).toLocaleString()}</p>
              <p className="mt-3">
                {c.posts ?? 0} posts, {c.pages ?? 0} pages, {c.tags ?? 0} topics, {c.subscribers ?? 0} subscribers and {parsed.media.length} images.
              </p>
            </div>
          ) : null}

          {parsed ? (
            <>
              <div className="flex items-start gap-3" role="note">
                <Icon as={ShieldAlert} size={22} />
                <p>
                  Restoring replaces every post, page, topic, subscriber and setting on this site with the ones in the file. Images already in your library are kept.
                </p>
              </div>
              <Toggle id="backup-safety" label="Download a copy of the current site first" checked={safety} onChange={setSafety} />
              <Toggle id="backup-understand" label="I understand this replaces my current content" checked={understand} onChange={setUnderstand} />
              <Field
                id="restore-pass"
                label="Your password"
                type="password"
                autoComplete="current-password"
                value={restorePassword}
                onChange={(e) => setRestorePassword(e.target.value)}
              />
              <button type="submit" className="btn self-start" disabled={!understand || !restorePassword || busy !== null}>
                <Icon as={busy === "restore" ? Loader : parsed ? ArchiveRestore : Upload} /> {busy === "restore" ? "Restoring…" : "Restore this backup"}
              </button>
            </>
          ) : null}
        </form>
      </div>

      {progress ? (
        <p role="status" className="font-bold">
          {progress}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="font-bold" style={{ color: "var(--color-success)" }}>
          {done}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="notice">
          {error}
        </p>
      ) : null}
    </section>
  );
}
