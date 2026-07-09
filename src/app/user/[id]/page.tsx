import { UserProfilePage } from "./user-profile-page";

export const dynamic = "force-dynamic";

export default async function UserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <UserProfilePage id={id} />;
}
