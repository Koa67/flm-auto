import Link from "next/link";

interface RelatedLink {
  label: string;
  href: string;
}

export function RelatedLinks({
  links,
  title = "Voir aussi",
}: {
  links: RelatedLink[];
  title?: string;
}) {
  if (links.length === 0) return null;

  return (
    <nav
      aria-label={title}
      className="mt-8 border-t border-[var(--border-subtle)] pt-6"
    >
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <ul className="flex flex-wrap gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm text-primary hover:underline"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
