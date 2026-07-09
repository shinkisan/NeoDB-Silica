"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { showToast } from "@/components/app-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Dropdown } from "@/components/dropdown";
import { PublishSwitch } from "@/components/publish-switch";
import { useT } from "@/components/use-t";
import {
  normalizeNeodbVisibility,
  type NeodbVisibility,
} from "@/lib/neodb-visibility";
import {
  defaultPublishPreferences,
  PUBLISH_PREFERENCES_EVENT,
  readPublishPreferences,
  type PublishPreferences,
  writePublishPreferences,
} from "@/lib/publish-preferences";

export function DefaultVisibilityButton({ disabled }: { disabled?: boolean }) {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        aria-disabled={disabled}
        className="inline-flex h-9 items-center rounded-full border border-white/70 bg-white/50 px-3 text-xs font-bold text-[#1a1c1e] shadow-sm transition hover:bg-white/75 active:scale-95 aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
        onClick={() => {
          if (disabled) { showToast(t("profile.publishPreferences.loginRequired")); return; }
          setIsOpen(true);
        }}
        type="button"
      >
        {t("profile.publishPreferences.configure")}
      </button>
      {isOpen ? (
        <VisibilityDialog onClose={() => setIsOpen(false)} />
      ) : null}
    </>
  );
}

export function AutoForwardButton({ disabled }: { disabled?: boolean }) {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        aria-disabled={disabled}
        className="inline-flex h-9 items-center rounded-full border border-white/70 bg-white/50 px-3 text-xs font-bold text-[#1a1c1e] shadow-sm transition hover:bg-white/75 active:scale-95 aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
        onClick={() => {
          if (disabled) { showToast(t("profile.publishPreferences.loginRequired")); return; }
          setIsOpen(true);
        }}
        type="button"
      >
        {t("profile.publishPreferences.configure")}
      </button>
      {isOpen ? <FediverseDialog onClose={() => setIsOpen(false)} /> : null}
    </>
  );
}

function VisibilityDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [preferences, setPreferences] = useState<PublishPreferences>(
    defaultPublishPreferences,
  );

  useEffect(() => {
    setPreferences(readPublishPreferences());
  }, []);

  function updateVisibility(target: "mark" | "review", value: string) {
    setPreferences((current) => ({
      ...current,
      visibility: {
        ...current.visibility,
        [target]: normalizeNeodbVisibility(value),
      },
    }));
  }

  function save() {
    writePublishPreferences(preferences);
    onClose();
  }

  return (
    <ConfirmDialog
      confirmLabel={t("confirmDialog.defaultConfirm")}
      description={
          <PublishSettingsList>
            <PublishSettingRow label={t("profile.publishPreferences.markComment")}>
              <VisibilityDropdown
                onChange={(value) => updateVisibility("mark", value)}
                value={preferences.visibility.mark}
            />
          </PublishSettingRow>
          <PublishSettingRow label={t("profile.publishPreferences.review")}>
            <VisibilityDropdown
              onChange={(value) => updateVisibility("review", value)}
              value={preferences.visibility.review}
            />
          </PublishSettingRow>
        </PublishSettingsList>
      }
      onCancel={onClose}
      onConfirm={save}
      title={t("profile.publishPreferences.visibilityTitle")}
    />
  );
}

function FediverseDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [preferences, setPreferences] = useState<PublishPreferences>(
    defaultPublishPreferences,
  );

  useEffect(() => {
    setPreferences(readPublishPreferences());
  }, []);

  function updateFediverse(target: "comment" | "review", value: boolean) {
    setPreferences((current) => ({
      ...current,
      fediverse: {
        ...current.fediverse,
        [target]: value,
      },
    }));
  }

  function save() {
    writePublishPreferences(preferences);
    onClose();
  }

  return (
    <ConfirmDialog
      confirmLabel={t("confirmDialog.defaultConfirm")}
      description={
        <div>
          <p className="mb-3 text-sm font-semibold leading-6 text-[#75777d]">
            {t("profile.publishPreferences.fediverseDescription")}
          </p>
          <PublishSettingsList>
            <PublishSettingRow label={t("profile.publishPreferences.comment")}>
              <PublishSwitch
                checked={preferences.fediverse.comment}
                label={t("profile.publishPreferences.comment")}
                onChange={(value) => updateFediverse("comment", value)}
              />
            </PublishSettingRow>
            <PublishSettingRow label={t("profile.publishPreferences.review")}>
              <PublishSwitch
                checked={preferences.fediverse.review}
                label={t("profile.publishPreferences.review")}
                onChange={(value) => updateFediverse("review", value)}
              />
            </PublishSettingRow>
          </PublishSettingsList>
        </div>
      }
      onCancel={onClose}
      onConfirm={save}
      title={t("profile.publishPreferences.fediverseTitle")}
    />
  );
}

export function VisibilityDropdown({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: NeodbVisibility;
}) {
  const t = useT();

  return (
    <Dropdown
      menuClassName="!z-[140]"
      onChange={onChange}
      options={[
        { id: "0", label: t("profile.publishPreferences.public") },
        { id: "1", label: t("profile.publishPreferences.followers") },
        { id: "2", label: t("profile.publishPreferences.private") },
      ]}
      overlayClassName="!z-[139]"
      value={String(value)}
    />
  );
}

export function PublishSettingsList({ children }: { children: ReactNode }) {
  return <div className="publish-settings-list mt-1">{children}</div>;
}

export function PublishSettingRow({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="publish-settings-row flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-sm font-bold text-[var(--foreground)]">{label}</span>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function usePublishPreferences() {
  const [preferences, setPreferences] = useState(defaultPublishPreferences);

  useEffect(() => {
    function sync() {
      setPreferences(readPublishPreferences());
    }

    window.queueMicrotask(sync);
    window.addEventListener(PUBLISH_PREFERENCES_EVENT, sync);

    return () => {
      window.removeEventListener(PUBLISH_PREFERENCES_EVENT, sync);
    };
  }, []);

  return preferences;
}
