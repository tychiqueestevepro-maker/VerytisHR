import { TopLine } from "@/components/layout/top-line";
import { PageHeader } from "@/components/hr/application-components";
import { ListSelector } from "@/components/hr/list-selector";

export default function Page() {
  return (
    <>
      <TopLine />
      <PageHeader
        eyebrow="Talent Intelligence"
        title="Qualification Results"
        meta={<ListSelector />}
      />
      <div className="py-12 text-center border-y border-border/50">
        <p className="text-foreground/50 text-sm italic">Showing results for selected list.</p>
      </div>
    </>
  );
}
