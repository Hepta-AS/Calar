import Link from "next/link";

export function AuthSplitLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral-100">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-10">
        <aside className="hidden flex-col justify-between bg-neutral-100 p-10 lg:col-span-6 lg:flex">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-neutral-900"
            >
              <span className="grid size-8 place-items-center rounded-lg bg-neutral-900 text-white">
                c
              </span>
              <span>calar os</span>
            </Link>
          </div>

          <div className="max-w-md">
            <h1 className="text-4xl font-semibold tracking-tight text-neutral-900">
              {title}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-neutral-600">
              {subtitle}
            </p>
          </div>

          <p className="text-sm text-neutral-500">
            Simple capture. Clean dashboard. Fast setup.
          </p>
        </aside>

        <main className="flex items-center justify-center bg-white px-6 py-12 lg:col-span-4">
          <div className="w-full max-w-md">
            <div className="lg:hidden">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm font-medium text-neutral-900"
              >
                <span className="grid size-8 place-items-center rounded-lg bg-neutral-900 text-white">
                  c
                </span>
                <span>calar os</span>
              </Link>
            </div>

            <div className="mt-10 lg:mt-0">{children}</div>

            {footer ? (
              <div className="mt-6 text-sm text-neutral-600">{footer}</div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

