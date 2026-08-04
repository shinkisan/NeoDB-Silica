import {
  LicensesPage,
  getLicensesMetadata,
} from "../../licenses/licenses-page";

export const metadata = getLicensesMetadata("en");

export default async function EnglishLicensesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { from } = await searchParams;

  return <LicensesPage fromProfile={from === "profile"} locale="en" />;
}
