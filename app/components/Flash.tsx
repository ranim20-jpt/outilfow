export default function Flash({ error, ok }: { error?: string; ok?: string }) {
  return (
    <>
      {error && <p className="flash error">{error}</p>}
      {ok && <p className="flash ok">{ok}</p>}
    </>
  );
}
