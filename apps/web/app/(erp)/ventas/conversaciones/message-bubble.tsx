"use client";

import { Bot, Download, ExternalLink, FileText, Link2, Mail, Smartphone } from "lucide-react";
import { attachmentsOf, formatBytes, parseMailBody, type ConversationMessage } from "@viavinilo/contracts";
import { downloadFile } from "../../../lib/api";
import { authorLabel, bubbleKind, errorText } from "./inbox";

/** Cuerpo de un mensaje (D-057): el mail tal cual, pero con los links aparte y lo citado plegado. */
function MessageBody({ m }: { m: ConversationMessage }) {
  if (m.channel !== "MAIL") return <div className="bubble-body">{m.body}</div>;
  const p = parseMailBody(m.body);
  return (
    <>
      {p.text && <div className="bubble-body">{p.text}</div>}
      {p.links.length > 0 && (
        <div className="mail-links">
          {p.links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="file-att" title={l.url}>
              <Link2 size={15} aria-hidden />
              <span>{l.label}</span>
              <ExternalLink size={13} aria-hidden className="muted" />
            </a>
          ))}
        </div>
      )}
      {p.quoted && (
        <details className="mail-quoted">
          <summary>
            {p.quotedFrom?.endsWith("@viavinilo.com") ? "Ver la respuesta automática de Via Vinilo" : "Ver el mensaje anterior"}
          </summary>
          <div className="bubble-body">{p.quoted}</div>
        </details>
      )}
    </>
  );
}

/** Adjuntos del mensaje: los guardados se descargan; los que quedaron en un pedido solo se nombran. */
function Attachments({ m, threadId, onError }: { m: ConversationMessage; threadId: string; onError: (message: string) => void }) {
  return attachmentsOf(m.attachments).map((a, i) =>
    a.key ? (
      <button
        key={`${m.id}-${i}`}
        type="button"
        className="file-att file-att-btn"
        onClick={() => void downloadFile(`/conversations/${threadId}/files/${m.id}/${i}`, a.name).catch((e: unknown) => onError(errorText(e)))}
      >
        <Download size={15} aria-hidden /> {a.name}
        {a.size ? <small className="muted">{formatBytes(a.size)}</small> : null}
      </button>
    ) : (
      <div key={`${m.id}-${i}`} className="file-att" title="El archivo está en el pedido (tablero del sector)">
        <FileText size={15} aria-hidden /> {a.name}
      </div>
    ),
  );
}

export function MessageBubble({ m, threadId, onError }: { m: ConversationMessage; threadId: string; onError: (message: string) => void }) {
  return (
    <div className={`bubble ${bubbleKind(m)}`}>
      <span className="by">
        {m.channel === "MAIL" ? <Mail size={12} /> : <Smartphone size={12} />}
        {m.fromBot && <Bot size={12} aria-hidden />}
        {authorLabel(m)}
        {m.channel === "MAIL" && m.sector && ` · ${m.sector.name}`}
      </span>
      {m.subject && <strong className="bubble-subject">{m.subject}</strong>}
      <MessageBody m={m} />
      <Attachments m={m} threadId={threadId} onError={onError} />
      {m.jobId && <span className="bubble-job">Pedido creado</span>}
      <time dateTime={m.createdAt}>
        {new Date(m.createdAt).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
      </time>
    </div>
  );
}
