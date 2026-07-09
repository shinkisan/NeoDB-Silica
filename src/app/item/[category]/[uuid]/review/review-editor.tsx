"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { showToast } from "@/components/app-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Dropdown } from "@/components/dropdown";
import { PublishSwitch } from "@/components/publish-switch";
import { useT } from "@/components/use-t";
import {
  normalizeNeodbVisibility,
  type NeodbVisibility,
} from "@/lib/neodb-visibility";
import { readPublishPreferences } from "@/lib/publish-preferences";
import { dispatchReviewStateChange } from "@/lib/review-state";
import { invalidateTimelineCache } from "@/lib/timeline-cache";
import {
  DETAIL_COMMENTS_REUSE_PREFIX,
  DETAIL_EDITOR_RETURN_PREFIX,
  DETAIL_RESTORE_PREFIX,
  DETAIL_REVIEW_LOCAL_PREFIX,
  type DetailReviewLocalSnapshot,
} from "../detail-state";

type ReviewEditorProps = {
  category: string;
  editorType?: "note" | "review";
  initialBody: string;
  initialProgressType?: NoteProgressType | null;
  initialProgressValue?: string | null;
  initialTitle: string;
  initialVisibility: NeodbVisibility;
  itemUuid: string;
  noteUuid?: string | null;
};

type BodySelection = {
  selectionEnd: number;
  selectionStart: number;
};

type BodyHistoryEntry = BodySelection & {
  value: string;
};

type ReviewDraft = {
  body?: string;
  progressType?: NoteProgressType | null;
  title?: string;
  visibility?: NeodbVisibility;
};

type NoteProgressType =
  | "chapter"
  | "cycle"
  | "episode"
  | "page"
  | "part"
  | "percentage"
  | "timestamp"
  | "track";

export function ReviewEditor({
  category,
  editorType = "review",
  initialBody,
  initialProgressType = null,
  initialProgressValue = null,
  initialTitle,
  initialVisibility,
  itemUuid,
  noteUuid = null,
}: ReviewEditorProps) {
  const router = useRouter();
  const t = useT();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const historyTimerRef = useRef<number | null>(null);
  const suppressDraftSaveRef = useRef(false);
  const pendingSelectionRef = useRef<BodySelection | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const draftKey = `bielu:v1:${editorType}-draft:${noteUuid || itemUuid}`;
  const isNoteEditor = editorType === "note";
  const initialProgressTypeValue = normalizeNoteProgressType(initialProgressType);
  const initialBodyValue = initialBody;
  const initialTitleValue = isNoteEditor && initialProgressTypeValue
    ? initialProgressValue || ""
    : initialTitle;
  const bodyValueRef = useRef(initialBodyValue);
  const titleValueRef = useRef(initialTitleValue);
  const visibilityValueRef = useRef<NeodbVisibility>(initialVisibility);
  const progressTypeValueRef = useRef<NoteProgressType | null>(
    isNoteEditor ? initialProgressTypeValue : null,
  );
  const historyRef = useRef({
    index: 0,
    lastPushedAt: 0,
    stack: [createBodyHistoryEntry(initialBodyValue)],
  });
  const [body, setBody] = useState(initialBodyValue);
  const [isClearOpen, setIsClearOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isHeadingOpen, setIsHeadingOpen] = useState(false);
  const [isInsertOpen, setIsInsertOpen] = useState(false);
  const [isListOpen, setIsListOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isPublishSettingsOpen, setIsPublishSettingsOpen] = useState(false);
  const [isVisibilityOpen, setIsVisibilityOpen] = useState(false);
  const [postToFediverse, setPostToFediverse] = useState(false);
  const [progressType, setProgressType] = useState<NoteProgressType | null>(
    isNoteEditor ? initialProgressTypeValue : null,
  );
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [title, setTitle] = useState(initialTitleValue);
  const [visibility, setVisibility] =
    useState<NeodbVisibility>(initialVisibility);
  const hasPublishedReview = Boolean(initialTitle.trim() || initialBody.trim());
  const shouldUseDraft = !hasPublishedReview;
  const isToolbarMenuOpen =
    isHeadingOpen || isInsertOpen || isListOpen || isMoreOpen;

  useEffect(() => {
    if (isNoteEditor) {
      return;
    }

    const preferences = readPublishPreferences();
    setPostToFediverse(
      hasPublishedReview ? false : preferences.fediverse.review,
    );

    if (!hasPublishedReview) {
      changeVisibility(preferences.visibility.review);
    }
  // Run once after mount so browser-local publish defaults can initialize new reviews.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!shouldUseDraft) {
      return;
    }

    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      const draft = readReviewDraft(draftKey);

      if (!draft) {
        return;
      }

      restoreDraft(draft);
    });

    return () => {
      cancelled = true;
    };
  }, [draftKey, shouldUseDraft]);

  useLayoutEffect(() => {
    const selection = pendingSelectionRef.current;
    const textarea = bodyRef.current;

    if (!selection || !textarea) {
      return;
    }

    pendingSelectionRef.current = null;
    textarea.focus();
    textarea.setSelectionRange(
      Math.min(selection.selectionStart, textarea.value.length),
      Math.min(selection.selectionEnd, textarea.value.length),
    );
  }, [body]);

  useEffect(() => {
    if (!isToolbarMenuOpen) {
      return;
    }

    function closeOnOutsidePointerDown(event: PointerEvent) {
      if (toolbarRef.current?.contains(event.target as Node)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      closeToolbarMenus();
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeToolbarMenus();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointerDown, true);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isToolbarMenuOpen]);

  async function publishReview() {
    const currentTitle = readCurrentTitle();
    const currentBody = readCurrentBody();
    const currentProgressType = readCurrentProgressType();
    const trimmedTitle = isNoteEditor && currentProgressType
      ? ""
      : currentTitle.trim();
    const progressValue = isNoteEditor && currentProgressType
      ? currentTitle.trim()
      : null;
    const trimmedBody = currentBody.trim();

    if (
      !trimmedBody ||
      (!isNoteEditor && !trimmedTitle) ||
      (currentProgressType && !progressValue) ||
      status === "saving"
    ) {
      setStatus("error");
      showToast(
        t(isNoteEditor ? "noteEditor.validationError" : "reviewEditor.validationError"),
        "error",
      );
      return;
    }

    setStatus("saving");

    try {
      const response = await fetch(
        isNoteEditor ? "/api/neodb/note" : "/api/neodb/review",
        {
          body: JSON.stringify({
            body: trimmedBody,
            content: trimmedBody,
            itemUuid,
            noteUuid,
            progressType: currentProgressType,
            progressValue,
            postToFediverse: isNoteEditor ? false : postToFediverse,
            title: isNoteEditor ? trimmedTitle : trimmedTitle,
            visibility: isNoteEditor ? 2 : visibility,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            t(isNoteEditor ? "noteEditor.publishError" : "reviewEditor.publishError"),
        );
      }

      suppressDraftSaveRef.current = true;
      window.localStorage.removeItem(draftKey);
      if (!isNoteEditor) {
        invalidateTimelineCache();
        writeLocalReviewSnapshot({
          body: trimmedBody,
          itemUuid,
          title: trimmedTitle,
          visibility,
        });
        dispatchReviewStateChange(itemUuid, true);
      }
      setTitle("");
      setBody("");
      requestDetailScrollRestore();
      if (!isNoteEditor) {
        requestDetailCommentsReuse();
      }
      router.replace(getDetailReturnPath());
    } catch (error) {
      setStatus("error");
      console.error("[neodb editor] publish failed", error);
      showToast(
        t(isNoteEditor ? "noteEditor.publishError" : "reviewEditor.publishError"),
        "error",
      );
    }
  }

  function cancelEditing() {
    const currentTitle = readCurrentTitle();
    const currentBody = readCurrentBody();

    if (
      !currentTitle.trim() &&
      !currentBody.trim() &&
      !initialTitleValue.trim() &&
      !initialBody.trim()
    ) {
      suppressDraftSaveRef.current = true;
      window.localStorage.removeItem(draftKey);
      closeEditor();
      return;
    }

    if (
      currentTitle !== initialTitleValue ||
      currentBody !== initialBody ||
      visibility !== initialVisibility
    ) {
      setIsCancelOpen(true);
      return;
    }

    closeEditor();
  }

  function closeEditor({
    keepEmptyDraft = false,
  }: { keepEmptyDraft?: boolean } = {}) {
    if (shouldUseDraft && !readCurrentBody().trim() && !keepEmptyDraft) {
      suppressDraftSaveRef.current = true;
      window.localStorage.removeItem(draftKey);
    }

    requestDetailScrollRestore();
    if (tryReturnWithBrowserHistory()) {
      return;
    }

    router.replace(getDetailReturnPath());
  }

  function requestDetailScrollRestore() {
    window.sessionStorage.setItem(`${DETAIL_RESTORE_PREFIX}${itemUuid}`, "1");
  }

  function requestDetailCommentsReuse() {
    window.sessionStorage.setItem(
      `${DETAIL_COMMENTS_REUSE_PREFIX}${itemUuid}`,
      "1",
    );
  }

  function getDetailReturnPath() {
    const storedPath = window.sessionStorage.getItem(
      `${DETAIL_EDITOR_RETURN_PREFIX}${itemUuid}`,
    );
    const fallbackPath = `/item/${category}/${encodeURIComponent(itemUuid)}`;

    window.sessionStorage.removeItem(`${DETAIL_EDITOR_RETURN_PREFIX}${itemUuid}`);

    if (isValidDetailReturnPath(storedPath, category, itemUuid)) {
      return storedPath || fallbackPath;
    }

    return fallbackPath;
  }

  function tryReturnWithBrowserHistory() {
    const returnKey = `${DETAIL_EDITOR_RETURN_PREFIX}${itemUuid}`;
    const storedPath = window.sessionStorage.getItem(returnKey);

    if (
      window.history.length <= 1 ||
      !isValidDetailReturnPath(storedPath, category, itemUuid)
    ) {
      return false;
    }

    window.sessionStorage.removeItem(returnKey);
    router.back();
    return true;
  }

  function restoreDraft(draft: ReviewDraft) {
    const nextTitle = draft.title || "";
    const nextBody = draft.body || "";
    const nextProgressType = normalizeNoteProgressType(draft.progressType);
    const nextVisibility = normalizeNeodbVisibility(draft.visibility);

    titleValueRef.current = nextTitle;
    bodyValueRef.current = nextBody;
    progressTypeValueRef.current = nextProgressType;
    visibilityValueRef.current = nextVisibility;
    historyRef.current = {
      index: 0,
      lastPushedAt: 0,
      stack: [createBodyHistoryEntry(nextBody)],
    };
    setTitle(nextTitle);
    setBody(nextBody);
    setProgressType(nextProgressType);
    setVisibility(nextVisibility);
  }

  function insertMarkdown(kind: MarkdownAction) {
    const textarea = bodyRef.current;

    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selection = body.slice(start, end);
    const next = formatSelection(kind, selection, t);
    const nextBody = `${body.slice(0, start)}${next}${body.slice(end)}`;

    updateBody(nextBody, true, {
      selectionEnd: start + next.length,
      selectionStart: start,
    });

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + next.length);
    });
  }

  function insertToolbarMarkdown(kind: MarkdownAction) {
    closeToolbarMenus();
    insertMarkdown(kind);
  }

  function closeToolbarMenus() {
    setIsHeadingOpen(false);
    setIsInsertOpen(false);
    setIsListOpen(false);
    setIsMoreOpen(false);
  }

  function insertHeading(level: number) {
    const textarea = bodyRef.current;

    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selection = body.slice(start, end) || t("reviewEditor.defaultHeading");
    const next = `${"#".repeat(level)} ${selection}`;
    const nextBody = `${body.slice(0, start)}${next}${body.slice(end)}`;

    updateBody(nextBody, true, {
      selectionEnd: start + next.length,
      selectionStart: start,
    });
    setIsHeadingOpen(false);
    setIsInsertOpen(false);
    setIsListOpen(false);
    setIsMoreOpen(false);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + next.length);
    });
  }

  function insertSpoiler() {
    const textarea = bodyRef.current;

    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selection = body.slice(start, end) || t("reviewEditor.spoilerDefault");
    const next = `>!${selection}!<`;
    const nextBody = `${body.slice(0, start)}${next}${body.slice(end)}`;

    updateBody(nextBody, true, {
      selectionEnd: start + next.length,
      selectionStart: start,
    });

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + next.length);
    });
  }

  function clearEditor() {
    titleValueRef.current = "";
    bodyValueRef.current = "";
    historyRef.current = {
      index: 0,
      lastPushedAt: 0,
      stack: [createBodyHistoryEntry("")],
    };
    setTitle("");
    setBody("");
    syncReviewDraft(
      "",
      "",
      readCurrentVisibility(),
      readCurrentProgressType(),
    );
    setIsClearOpen(false);
    setIsMoreOpen(false);
  }

  function updateBody(
    nextBody: string,
    pushHistory: boolean,
    selection?: { selectionEnd: number; selectionStart: number },
  ) {
    bodyValueRef.current = nextBody;
    setBody(nextBody);
    syncReviewDraft(
      readCurrentTitle(),
      nextBody,
      readCurrentVisibility(),
      readCurrentProgressType(),
    );

    if (!pushHistory) {
      return;
    }

    pushBodyHistory(nextBody, selection);
  }

  function pushBodyHistory(
    nextBody: string,
    selection?: { selectionEnd: number; selectionStart: number },
    pushedAt?: number,
  ) {
    const history = historyRef.current;
    const currentSnapshot = history.stack[history.index];
    const entry = createBodyHistoryEntry(nextBody, selection);

    if (
      currentSnapshot.value === entry.value &&
      currentSnapshot.selectionStart === entry.selectionStart &&
      currentSnapshot.selectionEnd === entry.selectionEnd
    ) {
      return;
    }

    const nextStack = history.stack.slice(0, history.index + 1);
    nextStack.push(entry);
    const trimmedStack = nextStack.slice(-80);

    historyRef.current = {
      index: trimmedStack.length - 1,
      lastPushedAt: pushedAt ?? history.lastPushedAt,
      stack: trimmedStack,
    };
  }

  function undoBodyChange() {
    const history = historyRef.current;

    if (history.stack[history.index].value !== body) {
      if (historyTimerRef.current) {
        window.clearTimeout(historyTimerRef.current);
        historyTimerRef.current = null;
      }

      restoreBodyHistoryEntry(history.stack[history.index]);
      return;
    }

    const nextIndex = history.index - 1;

    if (nextIndex < 0) {
      return;
    }

    historyRef.current = { ...history, index: nextIndex };
    restoreBodyHistoryEntry(history.stack[nextIndex]);
  }

  function redoBodyChange() {
    const history = historyRef.current;

    if (history.index >= history.stack.length - 1) {
      return;
    }

    const nextIndex = history.index + 1;
    historyRef.current = { ...history, index: nextIndex };
    restoreBodyHistoryEntry(history.stack[nextIndex]);
  }

  function handleBodyChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const nextBody = event.target.value;
    bodyValueRef.current = nextBody;
    const selection = {
      selectionEnd: event.target.selectionEnd,
      selectionStart: event.target.selectionStart,
    };
    const inputEvent = event.nativeEvent as InputEvent;
    const previousSelection = getSelectionBeforeBodyChange({
      inputData: inputEvent.data,
      inputType: inputEvent.inputType,
      nextBody,
      previousBody: body,
      selectionAfter: selection,
    });
    const eventTime = event.timeStamp;
    const history = historyRef.current;

    if (eventTime - history.lastPushedAt > 900) {
      pushBodyHistory(body, previousSelection, eventTime);
    } else {
      rememberBodyHistorySelection(previousSelection);
    }

    setBody(nextBody);
    syncReviewDraft(
      readCurrentTitle(),
      nextBody,
      readCurrentVisibility(),
      readCurrentProgressType(),
    );
    scheduleBodyHistory(nextBody, selection, eventTime);
  }

  function handleBodyBlur() {
    commitPendingBodyHistory();
  }

  function handleBodyKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const isModifierPressed = event.metaKey || event.ctrlKey;

    if (!isModifierPressed) {
      return;
    }

    const key = event.key.toLowerCase();

    if (key === "z" && !event.shiftKey) {
      event.preventDefault();
      undoBodyChange();
      return;
    }

    if (key === "y" || (key === "z" && event.shiftKey)) {
      event.preventDefault();
      redoBodyChange();
    }
  }

  function scheduleBodyHistory(
    nextBody: string,
    selection: { selectionEnd: number; selectionStart: number },
    eventTime: number,
  ) {
    if (historyTimerRef.current) {
      window.clearTimeout(historyTimerRef.current);
    }

    historyTimerRef.current = window.setTimeout(() => {
      pushBodyHistory(nextBody, selection, eventTime);
      historyTimerRef.current = null;
    }, 700);
  }

  function commitPendingBodyHistory() {
    if (historyTimerRef.current) {
      window.clearTimeout(historyTimerRef.current);
      historyTimerRef.current = null;
    }

    pushBodyHistory(body, readBodySelection(body));
  }

  function readBodySelection(value: string): BodySelection {
    const textarea = bodyRef.current;

    if (!textarea) {
      return {
        selectionEnd: value.length,
        selectionStart: value.length,
      };
    }

    return {
      selectionEnd: textarea.selectionEnd,
      selectionStart: textarea.selectionStart,
    };
  }

  function restoreBodyHistoryEntry(entry: BodyHistoryEntry) {
    pendingSelectionRef.current = {
      selectionEnd: entry.selectionEnd,
      selectionStart: entry.selectionStart,
    };

    if (entry.value === body) {
      requestAnimationFrame(() => {
        const selection = pendingSelectionRef.current;
        const textarea = bodyRef.current;

        if (!selection || !textarea) {
          return;
        }

        pendingSelectionRef.current = null;
        textarea.focus();
        textarea.setSelectionRange(
          Math.min(selection.selectionStart, textarea.value.length),
          Math.min(selection.selectionEnd, textarea.value.length),
        );
      });
    }

    bodyValueRef.current = entry.value;
    setBody(entry.value);
    syncReviewDraft(
      readCurrentTitle(),
      entry.value,
      readCurrentVisibility(),
      readCurrentProgressType(),
    );
  }

  function handleTitleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextTitle = event.target.value;
    titleValueRef.current = nextTitle;
    setTitle(nextTitle);
    syncReviewDraft(
      nextTitle,
      readCurrentBody(),
      readCurrentVisibility(),
      readCurrentProgressType(),
    );
  }

  function changeVisibility(nextVisibility: NeodbVisibility) {
    visibilityValueRef.current = nextVisibility;
    setVisibility(nextVisibility);
    syncReviewDraft(
      readCurrentTitle(),
      readCurrentBody(),
      nextVisibility,
      readCurrentProgressType(),
    );
  }

  function changeProgressType(nextProgressType: NoteProgressType | null) {
    progressTypeValueRef.current = nextProgressType;
    setProgressType(nextProgressType);
    syncReviewDraft(
      readCurrentTitle(),
      readCurrentBody(),
      readCurrentVisibility(),
      nextProgressType,
    );
  }

  function syncReviewDraft(
    nextTitle: string,
    nextBody: string,
    nextVisibility: NeodbVisibility,
    nextProgressType: NoteProgressType | null,
  ) {
    if (!shouldUseDraft || suppressDraftSaveRef.current) {
      return;
    }

    if (!nextBody.trim()) {
      window.localStorage.removeItem(draftKey);
      return;
    }

    window.localStorage.setItem(
      draftKey,
      JSON.stringify({
        body: nextBody,
        progressType: isNoteEditor ? nextProgressType : null,
        title: nextTitle,
        visibility: nextVisibility,
      }),
    );
  }

  function readCurrentTitle() {
    return titleInputRef.current?.value ?? titleValueRef.current;
  }

  function readCurrentBody() {
    return bodyRef.current?.value ?? bodyValueRef.current;
  }

  function readCurrentVisibility() {
    return visibilityValueRef.current;
  }

  function readCurrentProgressType() {
    return progressTypeValueRef.current;
  }

  function handleBodySelectionChange() {
    const textarea = bodyRef.current;

    if (!textarea) {
      return;
    }

    rememberBodyHistorySelection({
      selectionEnd: textarea.selectionEnd,
      selectionStart: textarea.selectionStart,
    });
  }

  function rememberBodyHistorySelection(selection: BodySelection) {
    const history = historyRef.current;
    const currentSnapshot = history.stack[history.index];

    if (!currentSnapshot || currentSnapshot.value !== body) {
      return;
    }

    const nextStack = [...history.stack];
    nextStack[history.index] = {
      ...currentSnapshot,
      selectionEnd: selection.selectionEnd,
      selectionStart: selection.selectionStart,
    };
    historyRef.current = {
      ...history,
      stack: nextStack,
    };
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none fixed inset-0 opacity-[0.03] [background-image:url('data:image/svg+xml,%3Csvg_viewBox=%220_0_200_200%22_xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter_id=%22n%22%3E%3CfeTurbulence_type=%22fractalNoise%22_baseFrequency=%220.85%22_numOctaves=%223%22/%3E%3C/filter%3E%3Crect_width=%22100%25%22_height=%22100%25%22_filter=%22url(%23n)%22/%3E%3C/svg%3E')]" />
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/30 bg-white/60 px-5 shadow-sm shadow-slate-900/5 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between">
          <div className="flex shrink-0 items-center gap-1">
            <button
              aria-label={t("reviewEditor.exit")}
              className="grid size-10 place-items-center rounded-full text-[#75777d] transition hover:bg-white/60 hover:text-[#333e50] active:scale-95"
              onClick={cancelEditing}
              type="button"
            >
              <EditorCloseIcon />
            </button>
          </div>
          <div className="min-w-0 flex-1" />
          <div className="flex shrink-0 items-center gap-2">
            {!isNoteEditor ? (
              <button
                className="inline-flex h-9 items-center rounded-full border border-white/70 bg-white/50 px-3 text-sm font-bold text-[#333e50] shadow-sm transition hover:bg-white/75 active:scale-95"
                onClick={() => setIsPublishSettingsOpen(true)}
                type="button"
              >
                {t("reviewEditor.publishSettings")}
              </button>
            ) : null}
            <button
              className="rounded-full bg-[var(--theme-primary)] px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--theme-primary-hover)] active:scale-95 disabled:cursor-wait disabled:bg-[#c1c7cf]"
              disabled={status === "saving"}
              onClick={() => {
                void publishReview();
              }}
              type="button"
            >
              {status === "saving"
                ? hasPublishedReview
                  ? t(isNoteEditor ? "noteEditor.updating" : "reviewEditor.updating")
                  : t(isNoteEditor ? "noteEditor.publishing" : "reviewEditor.publishing")
                : hasPublishedReview
                  ? t(isNoteEditor ? "noteEditor.update" : "reviewEditor.update")
                  : t(isNoteEditor ? "noteEditor.publish" : "reviewEditor.publish")}
            </button>
          </div>
        </div>
      </header>

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-4xl flex-col px-5 pb-28 pt-20">
        <div className="relative flex min-w-0 items-start gap-3">
          <input
            className={`min-w-0 flex-1 bg-transparent text-[2rem] font-bold leading-tight text-[var(--foreground)] outline-none placeholder:text-[#c5c6cd] sm:text-[2.35rem] ${
              isNoteEditor ? "pr-1" : ""
            }`}
            onChange={handleTitleChange}
            placeholder={getTitlePlaceholder({
              isNoteEditor,
              progressType,
              t,
            })}
            ref={titleInputRef}
            type="text"
            value={title}
          />
          {isNoteEditor ? (
            <div className="mt-1 shrink-0">
              <Dropdown
                onChange={(value) =>
                  changeProgressType(
                    value === "none" ? null : (value as NoteProgressType),
                  )
                }
                options={getProgressOptions(category, t)}
                value={progressType || "none"}
              />
            </div>
          ) : null}
        </div>
        <textarea
          className="mt-6 min-h-[52vh] flex-1 resize-none bg-transparent text-lg leading-relaxed text-[#44474c] outline-none placeholder:text-[#c5c6cd]"
          onBlur={handleBodyBlur}
          onChange={handleBodyChange}
          onClick={handleBodySelectionChange}
          onKeyDown={handleBodyKeyDown}
          onKeyUp={handleBodySelectionChange}
          onSelect={handleBodySelectionChange}
          placeholder={t(isNoteEditor ? "noteEditor.bodyPlaceholder" : "reviewEditor.bodyPlaceholder")}
          ref={bodyRef}
          value={body}
        />
      </section>

      <div
        className="fixed inset-x-0 bottom-6 z-50 px-5"
        onPointerDown={() => bodyRef.current?.blur()}
        ref={toolbarRef}
      >
        <div className="mx-auto flex max-w-md items-center justify-between rounded-full border border-white/40 bg-white/55 p-1 shadow-2xl shadow-slate-900/10 backdrop-blur-2xl">
          <ToolbarButton label={t("reviewEditor.toolbar.bold")} onClick={() => insertMarkdown("bold")}>
            <BoldIcon />
          </ToolbarButton>
          <ToolbarButton label={t("reviewEditor.toolbar.italic")} onClick={() => insertMarkdown("italic")}>
            <ItalicIcon />
          </ToolbarButton>
          <div className="relative">
            <ToolbarButton
              label={t("reviewEditor.toolbar.list")}
              onClick={() => {
                setIsInsertOpen(false);
                setIsHeadingOpen(false);
                setIsMoreOpen(false);
                setIsListOpen((value) => !value);
              }}
            >
              <ListIcon />
            </ToolbarButton>
            {isListOpen ? (
              <ToolbarMenu>
                <ToolbarMenuButton
                  icon={<ListIcon />}
                  label={t("reviewEditor.toolbar.unorderedList")}
                  onClick={() => insertToolbarMarkdown("list")}
                />
                <ToolbarMenuButton
                  icon={<OrderedListIcon />}
                  label={t("reviewEditor.toolbar.orderedList")}
                  onClick={() => insertToolbarMarkdown("ordered-list")}
                />
              </ToolbarMenu>
            ) : null}
          </div>
          <div className="relative">
            <ToolbarButton
              label={t("reviewEditor.toolbar.insert")}
              onClick={() => {
                setIsHeadingOpen(false);
                setIsListOpen(false);
                setIsMoreOpen(false);
                setIsInsertOpen((value) => !value);
              }}
            >
              <PlusIcon />
            </ToolbarButton>
            {isInsertOpen ? (
              <ToolbarMenu>
                <ToolbarMenuButton
                  icon={<LinkIcon />}
                  label={t("reviewEditor.toolbar.link")}
                  onClick={() => insertToolbarMarkdown("link")}
                />
                <ToolbarMenuButton
                  icon={<ImageIcon />}
                  label={t("reviewEditor.toolbar.image")}
                  onClick={() => insertToolbarMarkdown("image")}
                />
              </ToolbarMenu>
            ) : null}
          </div>
          <ToolbarButton label={t("reviewEditor.toolbar.spoiler")} onClick={insertSpoiler}>
            <SpoilerIcon />
          </ToolbarButton>
          <div className="relative">
            <ToolbarButton
              label={t("reviewEditor.toolbar.heading")}
              onClick={() => {
                setIsInsertOpen(false);
                setIsListOpen(false);
                setIsMoreOpen(false);
                setIsHeadingOpen((value) => !value);
              }}
            >
              <HeadingIcon />
            </ToolbarButton>
            {isHeadingOpen ? (
              <div className="absolute bottom-14 right-0 z-[90] grid w-36 gap-1 overflow-hidden rounded-2xl border border-[#e2e2e5] bg-white p-1.5 shadow-xl shadow-slate-900/10">
                {[1, 2, 3, 4, 5, 6].map((level) => {
                  const sizeClass = [
                    "text-xl",
                    "text-lg",
                    "text-base",
                    "text-sm",
                    "text-xs",
                    "text-[10px]",
                  ][level - 1];

                  return (
                    <button
                      className={`h-9 cursor-pointer rounded-xl px-3 text-left font-bold text-[#44474c] transition hover:bg-[#e2e2e5]/70 ${sizeClass}`}
                      key={level}
                      onClick={() => insertHeading(level)}
                      onMouseDown={(event) => event.preventDefault()}
                      type="button"
                    >
                      {t("reviewEditor.toolbar.headingLevel").replace(
                        "{level}",
                        String(level),
                      )}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          <div className="relative">
            <ToolbarButton
              label={t("reviewEditor.toolbar.more")}
              onClick={() => {
                setIsHeadingOpen(false);
                setIsInsertOpen(false);
                setIsListOpen(false);
                setIsMoreOpen((value) => !value);
              }}
            >
              <MoreIcon />
            </ToolbarButton>
            {isMoreOpen ? (
              <ToolbarMenu align="right">
                <ToolbarMenuButton
                  icon={<UndoIcon />}
                  label={t("reviewEditor.toolbar.undo")}
                  onClick={() => {
                    setIsMoreOpen(false);
                    undoBodyChange();
                  }}
                />
                <ToolbarMenuButton
                  icon={<RedoIcon />}
                  label={t("reviewEditor.toolbar.redo")}
                  onClick={() => {
                    setIsMoreOpen(false);
                    redoBodyChange();
                  }}
                />
                <ToolbarMenuButton
                  icon={<TrashIcon />}
                  label={t("reviewEditor.toolbar.clear")}
                  onClick={() => {
                    setIsMoreOpen(false);
                    setIsClearOpen(true);
                  }}
                  tone="danger"
                />
              </ToolbarMenu>
            ) : null}
          </div>
        </div>
      </div>

      {isCancelOpen ? (
        <ConfirmDialog
          cancelLabel={t("reviewEditor.cancelDialog.cancelLabel")}
          confirmLabel={t(
            shouldUseDraft
              ? "reviewEditor.cancelDialog.saveDraftLabel"
              : "reviewEditor.cancelDialog.confirmLabel",
          )}
          description={t(
            shouldUseDraft
              ? isNoteEditor
                ? "noteEditor.cancelDialog.description"
                : "reviewEditor.cancelDialog.description"
              : "reviewEditor.cancelDialog.discardDescription",
          )}
          onCancel={() => setIsCancelOpen(false)}
          onConfirm={() => closeEditor()}
          title={t("reviewEditor.cancelDialog.title")}
        />
      ) : null}
      {isPublishSettingsOpen ? (
        <ConfirmDialog
          cancelLabel={t("confirmDialog.defaultCancel")}
          confirmLabel={t("confirmDialog.defaultConfirm")}
          description={
            <div className="publish-settings-list mt-1">
              <div className="publish-settings-row flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm font-bold text-[var(--foreground)]">
                  {t("reviewEditor.visibility.label")}
                </span>
                <Dropdown
                  menuClassName="!z-[140]"
                  onChange={(value) =>
                    changeVisibility(normalizeNeodbVisibility(value))
                  }
                  onOpenChange={setIsVisibilityOpen}
                  open={isVisibilityOpen}
                  options={[
                    { id: "0", label: t("reviewEditor.visibility.public") },
                    { id: "1", label: t("reviewEditor.visibility.followers") },
                    { id: "2", label: t("reviewEditor.visibility.private") },
                  ]}
                  overlayClassName="!z-[139]"
                  value={String(visibility)}
                />
              </div>
              <div className="publish-settings-row flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm font-bold text-[var(--foreground)]">
                  {t("reviewEditor.postToFediverse")}
                </span>
                <PublishSwitch
                  checked={postToFediverse}
                  label={t("reviewEditor.postToFediverse")}
                  onChange={setPostToFediverse}
                />
              </div>
            </div>
          }
          onCancel={() => setIsPublishSettingsOpen(false)}
          onConfirm={() => setIsPublishSettingsOpen(false)}
          title={t("reviewEditor.publishSettings")}
        />
      ) : null}
      {isClearOpen ? (
        <ConfirmDialog
          cancelLabel={t("reviewEditor.clearDialog.cancelLabel")}
          confirmLabel={t("reviewEditor.clearDialog.confirmLabel")}
          description={t("reviewEditor.clearDialog.description")}
          onCancel={() => setIsClearOpen(false)}
          onConfirm={clearEditor}
          title={t("reviewEditor.clearDialog.title")}
        />
      ) : null}
    </main>
  );
}

type MarkdownAction =
  | "bold"
  | "heading"
  | "image"
  | "italic"
  | "link"
  | "list"
  | "ordered-list";

function formatSelection(action: MarkdownAction, selection: string, t: (key: string) => string) {
  const fallback = selection || t("reviewEditor.defaultText");

  if (action === "bold") {
    return `**${fallback}**`;
  }

  if (action === "italic") {
    return `*${fallback}*`;
  }

  if (action === "list") {
    return selection
      ? selection
          .split("\n")
          .map((line) => `- ${line}`)
          .join("\n")
      : "- ";
  }

  if (action === "ordered-list") {
    return selection
      ? selection
          .split("\n")
          .map((line, index) => `${index + 1}. ${line}`)
          .join("\n")
      : "1. ";
  }

  if (action === "link") {
    return `[${fallback}](https://)`;
  }

  if (action === "image") {
    return `![${selection || t("reviewEditor.defaultImage")}](https://)`;
  }

  return `## ${selection || t("reviewEditor.defaultHeading")}`;
}

function createBodyHistoryEntry(
  value: string,
  selection?: BodySelection,
): BodyHistoryEntry {
  return {
    selectionEnd: selection?.selectionEnd ?? value.length,
    selectionStart: selection?.selectionStart ?? value.length,
    value,
  };
}

function getSelectionBeforeBodyChange({
  inputData,
  inputType,
  nextBody,
  previousBody,
  selectionAfter,
}: {
  inputData: string | null;
  inputType: string;
  nextBody: string;
  previousBody: string;
  selectionAfter: BodySelection;
}): BodySelection {
  const removedLength = previousBody.length - nextBody.length;

  if (inputType === "deleteContentBackward" && removedLength > 0) {
    return clampBodySelection(
      {
        selectionEnd: selectionAfter.selectionEnd + removedLength,
        selectionStart: selectionAfter.selectionStart + removedLength,
      },
      previousBody.length,
    );
  }

  if (inputType.startsWith("insert")) {
    const insertedLength =
      inputData?.length ?? Math.max(0, nextBody.length - previousBody.length);

    if (insertedLength > 0) {
      return clampBodySelection(
        {
          selectionEnd: selectionAfter.selectionEnd - insertedLength,
          selectionStart: selectionAfter.selectionStart - insertedLength,
        },
        previousBody.length,
      );
    }
  }

  return clampBodySelection(selectionAfter, previousBody.length);
}

function clampBodySelection(
  selection: BodySelection,
  maxLength: number,
): BodySelection {
  return {
    selectionEnd: Math.min(Math.max(selection.selectionEnd, 0), maxLength),
    selectionStart: Math.min(Math.max(selection.selectionStart, 0), maxLength),
  };
}

function readReviewDraft(key: string): ReviewDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawDraft = window.localStorage.getItem(key);

  if (!rawDraft) {
    return null;
  }

  try {
    const draft = JSON.parse(rawDraft) as ReviewDraft;

    if (!draft.body?.trim()) {
      window.localStorage.removeItem(key);
      return null;
    }

    return {
      body: draft.body,
      progressType: normalizeNoteProgressType(draft.progressType),
      title: draft.title || "",
      visibility: normalizeNeodbVisibility(draft.visibility),
    };
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

function normalizeNoteProgressType(value: unknown): NoteProgressType | null {
  return typeof value === "string" && isNoteProgressType(value) ? value : null;
}

function isNoteProgressType(value: string): value is NoteProgressType {
  return [
    "chapter",
    "cycle",
    "episode",
    "page",
    "part",
    "percentage",
    "timestamp",
    "track",
  ].includes(value);
}

function getProgressOptions(category: string, t: (key: string) => string) {
  const types = getProgressTypesForCategory(category);

  return [
    { id: "none", label: t("noteEditor.progress.none") },
    ...types.map((type) => ({
      id: type,
      label: t(`noteEditor.progress.${type}`),
    })),
  ];
}

function getProgressTypesForCategory(category: string): NoteProgressType[] {
  if (category === "book") {
    return ["page", "chapter", "percentage"];
  }

  if (category === "movie") {
    return ["timestamp", "percentage", "part"];
  }

  if (category === "tv") {
    return ["part", "episode", "percentage"];
  }

  if (category === "music") {
    return ["track", "timestamp", "percentage"];
  }

  if (category === "podcast") {
    return ["episode"];
  }

  if (category === "game") {
    return ["cycle"];
  }

  return ["part", "percentage"];
}

function getTitlePlaceholder({
  isNoteEditor,
  progressType,
  t,
}: {
  isNoteEditor: boolean;
  progressType: NoteProgressType | null;
  t: (key: string) => string;
}) {
  if (!isNoteEditor) {
    return t("reviewEditor.titlePlaceholder");
  }

  if (!progressType) {
    return t("noteEditor.titlePlaceholder");
  }

  return t(`noteEditor.progressPlaceholder.${progressType}`);
}

function writeLocalReviewSnapshot(snapshot: DetailReviewLocalSnapshot) {
  try {
    window.sessionStorage.setItem(
      `${DETAIL_REVIEW_LOCAL_PREFIX}${snapshot.itemUuid}`,
      JSON.stringify(snapshot),
    );
  } catch {
    // If session storage is unavailable, the server refresh will still update comments.
  }
}

function isValidDetailReturnPath(
  path: string | null,
  category: string,
  itemUuid: string,
) {
  if (!path) {
    return false;
  }

  try {
    const url = new URL(path, window.location.origin);
    const expectedPath = `/item/${category}/${encodeURIComponent(itemUuid)}`;
    const notesPath = `${expectedPath}/notes`;

    return (
      url.origin === window.location.origin &&
      (url.pathname === expectedPath ||
        url.pathname === notesPath ||
        url.pathname === "/profile/reviews")
    );
  } catch {
    return false;
  }
}

function ToolbarButton({
  children,
  hasBadge = false,
  label,
  onClick,
}: {
  children: React.ReactNode;
  hasBadge?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="relative grid size-10 place-items-center rounded-full text-[#44474c] transition hover:bg-white/60 hover:text-[var(--foreground)] active:scale-95 sm:size-12"
      onClick={onClick}
      onMouseDown={(event) => event.preventDefault()}
      title={label}
      type="button"
    >
      {children}
      {hasBadge ? (
        <span
          aria-hidden="true"
          className="absolute right-2 top-2 size-2 rounded-full bg-[#e5484d] shadow-sm shadow-red-900/20"
        />
      ) : null}
    </button>
  );
}

function ToolbarMenu({
  align = "center",
  children,
}: {
  align?: "center" | "right";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`absolute bottom-14 z-[90] grid min-w-40 gap-1 overflow-hidden rounded-2xl border border-[#e2e2e5] bg-white p-1.5 shadow-xl shadow-slate-900/10 ${
        align === "right" ? "right-0" : "left-1/2 -translate-x-1/2"
      }`}
    >
      {children}
    </div>
  );
}

function ToolbarMenuButton({
  icon,
  label,
  onClick,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "danger" | "default";
}) {
  return (
    <button
      className={`flex h-9 cursor-pointer items-center gap-2 rounded-xl px-3 text-left text-xs font-bold transition ${
        tone === "danger"
          ? "text-[#b42318] hover:bg-[#fee4e2]"
          : "text-[#44474c] hover:bg-[#e2e2e5]/70"
      }`}
      onClick={onClick}
      onMouseDown={(event) => event.preventDefault()}
      type="button"
    >
      {icon}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

function BoldIcon() {
  return <IconPath path="M7 5h6a4 4 0 0 1 0 8H7zM7 13h7a4 4 0 0 1 0 8H7z" />;
}

function ItalicIcon() {
  return <IconPath path="M10 5h8M6 19h8M14 5l-4 14" />;
}

function SpoilerIcon() {
  return <span aria-hidden="true" className="text-sm leading-none">🙈</span>;
}

function ListIcon() {
  return <IconPath path="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />;
}

function OrderedListIcon() {
  return <IconPath path="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M4 14h2l-2 4h2" />;
}

function LinkIcon() {
  return <IconPath path="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" />;
}

function ImageIcon() {
  return <IconPath path="M4 5h16v14H4zM8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM20 15l-4-4-5 5-2-2-5 5" />;
}

function HeadingIcon() {
  return <IconPath path="M4 5v14M14 5v14M4 12h10M18 19h2M19 19V9l-2 1" />;
}

function PlusIcon() {
  return <IconPath path="M12 5v14M5 12h14" />;
}

function MoreIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  );
}

function EditorCloseIcon() {
  return <IconPath path="M18 6 6 18M6 6l12 12" />;
}

function UndoIcon() {
  return <IconPath path="M9 14 4 9l5-5M5 9h9a6 6 0 0 1 0 12h-2" sizeClassName="size-4" />;
}

function RedoIcon() {
  return <IconPath path="m15 14 5-5-5-5M19 9h-9a6 6 0 0 0 0 12h2" sizeClassName="size-4" />;
}

function TrashIcon() {
  return (
    <IconPath
      path="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"
      sizeClassName="size-4"
    />
  );
}

function IconPath({
  path,
  sizeClassName = "size-5",
}: {
  path: string;
  sizeClassName?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={sizeClassName}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d={path} />
    </svg>
  );
}
