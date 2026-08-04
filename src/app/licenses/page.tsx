import { LicensesPage, getLicensesMetadata } from "./licenses-page";

export const metadata = getLicensesMetadata("zh-Hans");

export default async function SimplifiedChineseLicensesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { from } = await searchParams;

  return <LicensesPage fromProfile={from === "profile"} locale="zh-Hans" />;
}
