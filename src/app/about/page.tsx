import { AboutPage, getAboutMetadata } from "./about-page";

export const metadata = getAboutMetadata("zh-Hans");

export default async function SimplifiedChineseAboutPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { from } = await searchParams;

  return <AboutPage fromProfile={from === "profile"} locale="zh-Hans" />;
}
