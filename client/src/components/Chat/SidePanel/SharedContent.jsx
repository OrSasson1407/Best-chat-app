import React, { useState, useMemo } from "react";
import { FaSearch, FaSpinner, FaLink, FaFileDownload } from "react-icons/fa";

export default function SharedContent({ activeSideTab, isFetchingMedia, chatMedia, setLightboxImage }) {
  const [mediaSearch, setMediaSearch] = useState("");

  const filteredLinks = useMemo(() =>
    chatMedia.links?.filter((m) => (m.linkMetadata?.title || m.message).toLowerCase().includes(mediaSearch.toLowerCase())) || [],
    [chatMedia.links, mediaSearch]
  );
  
  const filteredFiles = useMemo(() =>
    chatMedia.files?.filter((m) => (m.fileMetadata?.fileName || "").toLowerCase().includes(mediaSearch.toLowerCase())) || [],
    [chatMedia.files, mediaSearch]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ position: "relative", marginBottom: 20 }}>
        <FaSearch style={{ position: "absolute", left: 12, top: 12, color: "var(--text-dim)" }} />
        <input placeholder={`Search ${activeSideTab}...`} value={mediaSearch} onChange={(e) => setMediaSearch(e.target.value)}
          style={{ width: "100%", padding: "10px 10px 10px 36px", borderRadius: 8, background: "var(--input-bg)", border: "1px solid var(--glass-border)", color: "var(--text-main)", outline: "none" }} />
      </div>

      {isFetchingMedia ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-dim)" }}><FaSpinner className="fa-spin" size={24} /></div>
      ) : (
        <>
          {activeSideTab === "media" && (
            chatMedia.media.length === 0
              ? <p style={{ textAlign: "center", color: "var(--text-dim)", fontStyle: "italic", marginTop: 20 }}>No media shared yet.</p>
              : <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {chatMedia.media.map((m) => (
                  <div key={m.id} style={{ aspectRatio: "1", borderRadius: 8, overflow: "hidden", cursor: "pointer", background: "var(--input-bg)" }}>
                    {m.type === "image"
                      ? <img src={m.message} alt="shared" style={{ width: "100%", height: "100%", objectFit: "cover" }} onClick={() => setLightboxImage(m.message)} />
                      : <video src={m.message} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    }
                  </div>
                ))}
              </div>
          )}

          {activeSideTab === "links" && (
            filteredLinks.length === 0
              ? <p style={{ textAlign: "center", color: "var(--text-dim)", fontStyle: "italic", marginTop: 20 }}>No matching links found.</p>
              : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredLinks.map((m) => (
                  <a key={m.id} href={m.linkMetadata?.url || m.message} target="_blank" rel="noreferrer"
                    style={{ display: "flex", gap: 12, padding: 12, background: "var(--input-bg)", borderRadius: 12, border: "1px solid var(--glass-border)", textDecoration: "none" }}>
                    <div style={{ width: 40, height: 40, background: "rgba(52,183,241,0.1)", color: "#34B7F1", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><FaLink /></div>
                    <div style={{ overflow: "hidden" }}>
                      <h4 style={{ color: "var(--text-main)", fontSize: "0.9rem", margin: "0 0 4px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.linkMetadata?.title || m.message}</h4>
                      <p style={{ color: "var(--text-dim)", fontSize: "0.75rem", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.linkMetadata?.url || m.message}</p>
                    </div>
                  </a>
                ))}
              </div>
          )}

          {activeSideTab === "files" && (
            filteredFiles.length === 0
              ? <p style={{ textAlign: "center", color: "var(--text-dim)", fontStyle: "italic", marginTop: 20 }}>No matching files found.</p>
              : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredFiles.map((m) => (
                  <a key={m.id} href={m.message} target="_blank" rel="noreferrer"
                    style={{ display: "flex", gap: 12, padding: 12, background: "var(--input-bg)", borderRadius: 12, border: "1px solid var(--glass-border)", textDecoration: "none" }}>
                    <div style={{ width: 40, height: 40, background: "rgba(16,185,129,0.1)", color: "#10b981", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><FaFileDownload /></div>
                    <div style={{ overflow: "hidden" }}>
                      <h4 style={{ color: "var(--text-main)", fontSize: "0.9rem", margin: "0 0 4px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.fileMetadata?.fileName || "Attachment"}</h4>
                      <p style={{ color: "var(--text-dim)", fontSize: "0.75rem", margin: 0 }}>{m.fileMetadata?.fileSize || "Unknown Size"}</p>
                    </div>
                  </a>
                ))}
              </div>
          )}
        </>
      )}
    </div>
  );
}