type MediaLoadingIndicatorProps = {
  label: string;
};

export function MediaLoadingIndicator({
  label,
}: MediaLoadingIndicatorProps) {
  return (
    <div
      aria-label={label}
      className="absolute inset-0 z-10 grid place-items-center"
      role="status"
    >
      <svg
        aria-hidden="true"
        className="size-8 animate-spin text-white motion-reduce:animate-none"
        viewBox="0 0 48 48"
      >
        <circle
          className="opacity-25"
          cx="24"
          cy="24"
          fill="none"
          r="18"
          stroke="currentColor"
          strokeWidth="5"
        />
        <path
          d="M42 24a18 18 0 0 0-18-18"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="5"
        />
      </svg>
    </div>
  );
}
