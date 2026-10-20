import { placeLinks } from "@mongmong/shared";

export function PlaceLinks({ areaName, placeName }: { areaName: string; placeName: string }) {
  const links = placeLinks(areaName, placeName);
  const [primary, ...rest] = links;
  return (
    <div className="grid gap-2">
      <a href={primary.href} target="_blank" rel="noopener noreferrer" className="tap flex min-h-[50px] items-center justify-center rounded-2xl bg-accent px-5 font-bold text-accent-fg">
        {primary.label}에서 열기 ↗
      </a>
      <div className="flex flex-wrap gap-2">
        {rest.map((l) => (
          <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="tap flex min-h-[42px] items-center rounded-2xl bg-surface2 px-4 text-sm font-bold">
            {l.label} ↗
          </a>
        ))}
      </div>
    </div>
  );
}
