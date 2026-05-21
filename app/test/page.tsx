export default function TestPage() {
  console.log("[TEST PAGE] Rendering test page on server");

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>Test Page</h1>
      <p>If you can see this, the app is working.</p>
      <p>Timestamp: {new Date().toISOString()}</p>
      <p>Node env: {process.env.NODE_ENV}</p>
      <p>Vercel: {process.env.VERCEL === "1" ? "Yes" : "No"}</p>
      <p>
        <a href="/api/health">Check /api/health</a>
      </p>
      <p>
        <a href="/login">Go to /login</a>
      </p>
      <p>
        <a href="/tracker.js">Check /tracker.js</a>
      </p>
    </div>
  );
}
