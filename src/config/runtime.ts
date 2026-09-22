const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim().replace(/\/$/, "") || "";
const resolvedSiteUrl = configuredSiteUrl || "http://localhost:3000";

export function withBasePath(pathname: string) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;

  if (
    !configuredBasePath ||
    normalizedPath === configuredBasePath ||
    normalizedPath.startsWith(`${configuredBasePath}/`)
  ) {
    return normalizedPath;
  }

  return `${configuredBasePath}${normalizedPath}`;
}

export const runtimeConfig = {
  siteUrl: resolvedSiteUrl,
  basePath: configuredBasePath,
  hasConfiguredSiteUrl: Boolean(configuredSiteUrl),
  assetBaseUrl: `${new URL(resolvedSiteUrl).origin}${configuredBasePath}`,
} as const;
