import { HeraldicDivider } from './HeraldicDivider';

export function ScreenTitle({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="mb-5">
      <p className="label-caps">{eyebrow}</p>
      <h1 className="mt-1 font-serif text-[28px] font-semibold leading-tight text-foreground">
        {title}
      </h1>
      <HeraldicDivider className="mt-3 max-w-[9rem]" />
    </div>
  );
}
