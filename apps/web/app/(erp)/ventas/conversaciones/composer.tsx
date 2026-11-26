"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { FileText, Mail, Paperclip, Send, Smartphone, X } from "lucide-react";
import { ACCEPT_ATTRIBUTE, formatBytes, type ConversationThread, type MessageChannel } from "@viavinilo/contracts";
import { api, upload } from "../../../lib/api";
import { addFiles, canAnswerByApp, channelHint, defaultChannel, errorText, lastMailIn, mailTooBig } from "./inbox";

/** Manda la respuesta: con archivos va por subida con progreso (D-062), sin archivos como mensaje común. */
function sendReply(threadId: string, channel: MessageChannel, text: string, files: File[], onProgress: (f: number) => void) {
  if (!files.length) return api(`/conversations/${threadId}/messages`, { method: "POST", body: JSON.stringify({ text, channel }) });
  const form = new FormData();
  form.append("channel", channel);
  if (text.trim()) form.append("text", text);
  files.forEach((f) => form.append("files", f));
  onProgress(0);
  return upload(`/conversations/${threadId}/files`, form, onProgress);
}

function ChannelPicker({ thread, channel, onChange }: { thread: ConversationThread; channel: MessageChannel; onChange: (c: MessageChannel) => void }) {
  return (
    <div className="composer-channels">
      <div className="seg">
        <button type="button" aria-pressed={channel === "APP"} disabled={!canAnswerByApp(thread)} onClick={() => onChange("APP")}>
          <Smartphone size={14} /> Por la app
        </button>
        <button type="button" aria-pressed={channel === "MAIL"} onClick={() => onChange("MAIL")}>
          <Mail size={14} /> Por mail
        </button>
      </div>
      <span className="muted composer-hint">{channelHint(channel, lastMailIn(thread))}</span>
    </div>
  );
}

function PickedFiles({ files, tooBig, progress, onRemove }: { files: File[]; tooBig: boolean; progress: number | null; onRemove: (i: number) => void }) {
  if (!files.length) return null;
  return (
    <div className="composer-files">
      {files.map((f, i) => (
        <span key={`${f.name}-${i}`} className="file-pill">
          <FileText size={13} aria-hidden /> {f.name} <small>{formatBytes(f.size)}</small>
          <button type="button" aria-label={`Quitar ${f.name}`} onClick={() => onRemove(i)}>
            <X size={13} />
          </button>
        </span>
      ))}
      {tooBig && <span className="error">Por mail entran hasta 20 MB: mandalo por la app.</span>}
      {progress !== null && <span className="muted">Subiendo… {Math.round(progress * 100)}%</span>}
    </div>
  );
}

/** Enter envía y Shift+Enter baja de línea. */
function submitOnEnter(e: KeyboardEvent<HTMLTextAreaElement>, submit: (e: FormEvent) => void) {
  if (e.key !== "Enter" || e.shiftKey) return;
  e.preventDefault();
  submit(e);
}

export function Composer({ thread, onSent }: { thread: ConversationThread; onSent: () => void }) {
  const [channel, setChannel] = useState<MessageChannel>(() => defaultChannel(thread));
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  /** Archivos para mandar con la respuesta (D-062). */
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const tooBigForMail = mailTooBig(channel, files);
  const empty = !text.trim() && !files.length;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (empty) return;
    if (tooBigForMail) return setError("Por mail entran hasta 20 MB de adjuntos. Mandalo por la app o en partes.");
    setBusy(true);
    setError("");
    try {
      await sendReply(thread.id, channel, text, files, setProgress);
      setFiles([]);
      setText("");
      onSent();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setProgress(null);
      setBusy(false);
    }
  }

  return (
    <form className="composer" onSubmit={submit}>
      <ChannelPicker thread={thread} channel={channel} onChange={setChannel} />
      <PickedFiles files={files} tooBig={tooBigForMail} progress={progress} onRemove={(i) => setFiles((all) => all.filter((_, j) => j !== i))} />
      <div className="composer-row">
        <label className="btn btn-ghost attach-btn" title="Adjuntar archivos (hasta 5)">
          <Paperclip size={16} aria-hidden />
          <span className="sr-only">Adjuntar archivos</span>
          <input
            type="file"
            hidden
            multiple
            accept={ACCEPT_ATTRIBUTE}
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              setFiles((all) => addFiles(all, picked));
              e.target.value = "";
            }}
          />
        </label>
        <textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => submitOnEnter(e, (ev) => void submit(ev))}
          placeholder="Escribí una respuesta… (Enter envía, Shift+Enter baja de línea)"
          aria-label="Respuesta"
        />
        <button className="btn btn-primary" disabled={busy || empty || tooBigForMail}>
          <Send size={16} /> Enviar
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
