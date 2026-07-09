import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ReviewEditor } from "../review/review-editor";
import {
  getItemApiPath,
  getNeodbBaseUrl,
  type NeodbItem,
} from "@/lib/neodb";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";

type NoteSchema = {
  content?: string;
  progress_type?: NoteProgressType | null;
  progress_value?: string | null;
  title?: string | null;
  uuid?: string;
  visibility?: number;
};

type PagedNotes = {
  data?: NoteSchema[];
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

type NotePageProps = {
  params: Promise<{
    category: string;
    uuid: string;
  }>;
  searchParams: Promise<{
    noteUuid?: string;
  }>;
};

export default async function NotePage({ params, searchParams }: NotePageProps) {
  const { category, uuid } = await params;
  const { noteUuid } = await searchParams;
  const item = await fetchItem(category, uuid);

  if (!item) {
    notFound();
  }

  const note = noteUuid ? await fetchNote(item.uuid, noteUuid) : null;

  if (noteUuid && !note) {
    notFound();
  }

  const noteProgressType = normalizeNoteProgressType(note?.progress_type);

  return (
    <ReviewEditor
      category={item.category}
      editorType="note"
      initialBody={note?.content || ""}
      initialProgressType={noteProgressType}
      initialProgressValue={noteProgressType ? note?.progress_value || "" : null}
      initialTitle={noteProgressType ? note?.progress_value || "" : note?.title || ""}
      initialVisibility={note?.visibility === 0 ? 0 : 2}
      itemUuid={item.uuid}
      noteUuid={note?.uuid || null}
    />
  );
}

async function fetchItem(category: string, uuid: string) {
  configureServerFetchProxy();

  const baseUrl = getNeodbBaseUrl();

  try {
    const response = await fetch(`${baseUrl}${getItemApiPath(category, uuid)}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 * 30 },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as NeodbItem;
  } catch {
    return null;
  }
}

async function fetchNote(itemUuid: string, noteUuid: string) {
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  if (!session?.accessToken) {
    return null;
  }

  configureServerFetchProxy();

  try {
    const url = new URL(
      `${session.instance}/api/me/note/item/${encodeURIComponent(itemUuid)}/`,
    );
    url.searchParams.set("page_size", "50");

    const response = await fetchWithTimeout(
      url,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
        },
      },
      8_000,
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as PagedNotes;
    return (Array.isArray(payload.data) ? payload.data : []).find(
      (note) => note.uuid === noteUuid,
    ) || null;
  } catch {
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
