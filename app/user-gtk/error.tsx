"use client";

export default function Error({ error }: { error: Error & { digest?: string } }) {
  return (
    <div style={{ padding: 16 }}>
      <h2>Terjadi error di User GTK</h2>
      <pre>{error.message}</pre>
      {error.digest ? <pre>digest: {error.digest}</pre> : null}
    </div>
  );
}
