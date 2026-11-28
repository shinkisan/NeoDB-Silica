import {
  LicensesPage,
  getLicensesMetadata,
} from "../../licenses/licenses-page";

export const metadata = getLicensesMetadata("fr");

export default async function FrenchLicensesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { from } = await searchParams;

  return <LicensesPage fromProfile={from === "profile"} locale="fr" />;
}
