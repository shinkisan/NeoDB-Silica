import { AboutPage, getAboutMetadata } from "../../about/about-page";

export const metadata = getAboutMetadata("en");

export default async function EnglishAboutPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { from } = await searchParams;

  return <AboutPage fromProfile={from === "profile"} locale="en" />;
}
