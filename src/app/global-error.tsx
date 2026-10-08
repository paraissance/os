"use client";

// Last-resort boundary for errors in the root layout itself. Plain markup:
// the root layout (fonts, CSS) may be what failed.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#05070d", color: "#e9edf5", fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20, margin: 0 }}>JodyOS hit an error</h1>
          <p style={{ color: "#a6b0c4" }}>Reload to try again.</p>
          <button type="button" onClick={reset} style={{ marginTop: 12, padding: "10px 18px", borderRadius: 12, border: "1px solid #263049", background: "#121929", color: "#e9edf5", cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
