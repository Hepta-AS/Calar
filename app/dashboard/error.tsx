"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#F6F6F6] p-8 font-sans text-[#363636]">
      <h1 className="text-lg font-semibold">Dashboard error</h1>
      <p className="mt-2 text-sm text-red-600">{error.message}</p>
      <button
        type="button"
        className="mt-6 rounded-lg bg-[#363636] px-4 py-2 text-sm text-white"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}
