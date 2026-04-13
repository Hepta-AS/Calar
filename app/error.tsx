"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-neutral-50 p-8 font-sans text-neutral-900">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-red-600">{error.message}</p>
      <button
        type="button"
        className="mt-6 rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}
