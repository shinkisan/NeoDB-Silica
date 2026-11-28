import { AboutPage, getAboutMetadata } from "../../about/about-page";

export const metadata = getAboutMetadata("fr");

export default async function FrenchAboutPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { from } = await searchParams;

  return <AboutPage fromProfile={from === "profile"} locale="fr" />;
}
