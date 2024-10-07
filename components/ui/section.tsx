export function Section({
  title,
  cta,
  children,
}: {
  title: string;
  cta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="flex flex-row justify-between align-middle items-center mb-6">
        <h1 className="text-lg lg:text-2xl font-medium">{title}</h1>
        {cta}
      </div>
      {children}
    </section>
  );
}
