import { AboutPage, getAboutMetadata } from "../../about/about-page";

export const metadata = getAboutMetadata("zh-Hant");

export default async function TraditionalChineseAboutPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { from } = await searchParams;

  return <AboutPage fromProfile={from === "profile"} locale="zh-Hant" />;
}
