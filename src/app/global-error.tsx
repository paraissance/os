"use client";

// Last-resort boundary for errors in the root layout itself. Plain markup:
// the root layout (fonts, CSS) may be what failed.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#fff", color: "#000", fontFamily: "Helvetica Neue, Arial, sans-serif", margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center" }}>
        <div style={{ padding: 24, maxWidth: 480 }}>
          <h1 style={{ fontSize: 40, lineHeight: 1, letterSpacing: "-0.04em", fontWeight: 800, margin: 0 }}>JodyOS hit an error.</h1>
          <p style={{ color: "#545454" }}>Reload the page to try again.</p>
          <button type="button" onClick={reset} style={{ marginTop: 12, padding: "12px 20px", border: "1px solid #000", background: "#000", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
