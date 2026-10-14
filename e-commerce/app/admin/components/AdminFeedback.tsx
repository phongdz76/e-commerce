export default function AdminFeedback({
  title, description, isError = false, onRetry,
}: {
  title: string;
  description?: string;
  isError?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div
      role={isError ? "alert" : "status"}
      className={"space-y-2 rounded-md border p-8 text-center text-sm " + (isError ? "border-rose-200 bg-rose-50 text-rose-800" : "border-slate-200 bg-white text-slate-500")}
    >
      <p className="font-semibold">{title}</p>
      {description ? <p>{description}</p> : null}
      {onRetry ? (
        <button type="button" onClick={onRetry} className="min-h-10 px-3 font-semibold underline">
          Try again
        </button>
      ) : null}
    </div>
  );
}
