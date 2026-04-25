type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
  center?: boolean;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  center = false,
}: SectionHeadingProps) {
  return (
    <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <p className="lp-eyebrow">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-[#f8f4ed] md:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-8 text-[#b6c3cf] md:text-lg">
        {description}
      </p>
    </div>
  );
}
