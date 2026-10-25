import { notFound, permanentRedirect } from "next/navigation";
import { businessSections, businessHref } from "@/lib/business-sections";

// Keep saved industry links working without an intermediate landing page.
export default async function SolutionPage({
  params,
}: {
  params: Promise<{ sector: string }>;
}) {
  const { sector } = await params;
  const item = businessSections
    .flatMap((section) => section.items)
    .find((item) => item.id === sector);
  if (!item) notFound();
  permanentRedirect(businessHref(item));
}
