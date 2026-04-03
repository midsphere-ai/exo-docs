export interface BreadcrumbItem {
  name: string;
  href: string;
}

export function generateOrganizationJsonLd(siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Exo",
    url: siteUrl,
    logo: `${siteUrl}/favicon.svg`,
    description:
      "A modern, modular multi-agent framework for Python.",
  };
}

export function generateTechArticleJsonLd(options: {
  title: string;
  description: string;
  url: string;
  dateModified?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: options.title,
    description: options.description,
    url: options.url,
    ...(options.dateModified && { dateModified: options.dateModified }),
    author: {
      "@type": "Organization",
      name: "Exo",
    },
  };
}

export function generateBreadcrumbJsonLd(
  items: BreadcrumbItem[],
  siteUrl: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.href.startsWith("http")
        ? item.href
        : `${siteUrl}${item.href}`,
    })),
  };
}
