import { notFound } from "next/navigation";
import { MyNotesPage } from "../detail-notes-dialog";
import {
  getItemApiPath,
  getNeodbBaseUrl,
  type NeodbItem,
} from "@/lib/neodb";
import { configureServerFetchProxy } from "@/lib/server-fetch";

type NotesPageProps = {
  params: Promise<{
    category: string;
    uuid: string;
  }>;
};

export default async function NotesPage({ params }: NotesPageProps) {
  const { category, uuid } = await params;
  const item = await fetchItem(category, uuid);

  if (!item) {
    notFound();
  }

  return (
    <main className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <MyNotesPage
        category={item.category}
        itemTitle={item.display_title || item.title || "NeoDB"}
        itemUuid={item.uuid}
      />
    </main>
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
