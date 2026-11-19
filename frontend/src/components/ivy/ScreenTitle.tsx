import { HeraldicDivider } from './HeraldicDivider';

export function ScreenTitle({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="mb-6 min-w-0">
      <p className="label-caps truncate">{eyebrow}</p>
      <h1 className="editorial-title mt-1.5 break-words text-[1.75rem] text-[#1E2430] sm:text-[1.875rem]">
        {title}
      </h1>
      <HeraldicDivider className="mt-3.5 max-w-[8.5rem]" />
    </div>
  );
}
