"use client";

export function PublishSwitch({
  checked,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={`relative h-8 w-[3.25rem] rounded-full p-1 transition disabled:cursor-not-allowed disabled:opacity-55 ${
        checked ? "bg-[var(--theme-primary)]" : "bg-[#c5c6cd]"
      }`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span
        className={`block size-6 rounded-full shadow-md shadow-slate-900/20 transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
        style={{ backgroundColor: "#fff" }}
      />
    </button>
  );
}
