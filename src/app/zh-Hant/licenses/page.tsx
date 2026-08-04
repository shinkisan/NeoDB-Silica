import {
  LicensesPage,
  getLicensesMetadata,
} from "../../licenses/licenses-page";

export const metadata = getLicensesMetadata("zh-Hant");

export default async function TraditionalChineseLicensesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { from } = await searchParams;

  return <LicensesPage fromProfile={from === "profile"} locale="zh-Hant" />;
}
