import path from "path";

const normalize = (value?: string | null) =>
	value && value.trim().length > 0 ? value.trim() : undefined;

const rawBrandName = normalize(process.env.BRAND_NAME);
const fallbackBrandName = "GuildServer";
const brandName = rawBrandName ?? fallbackBrandName;
const rawBrandSlug = normalize(process.env.BRAND_SLUG);
const inferredBrandSlug = brandName
	.toLowerCase()
	.replace(/[^a-z0-9]+/g, "-")
	.replace(/(^-|-$)/g, "");

export const BRAND_NAME = brandName;
export const BRAND_SLUG = rawBrandSlug && rawBrandSlug.length > 0 ? rawBrandSlug : inferredBrandSlug;

const defaultWebsiteUrl = "https://guildserver.com";
const defaultGithubUrl = "https://github.com/GuildServer/guildserver";
const defaultDocsUrl = "https://docs.guildserver.com";

const resolveEnv = (...values: Array<string | undefined>) => {
	for (const value of values) {
		const normalized = normalize(value);
		if (normalized) {
			return normalized;
		}
	}
	return undefined;
};

const parseBooleanEnv = (
	value: string | undefined,
	defaultValue: boolean,
) => {
	if (value === undefined) {
		return defaultValue;
	}
	const normalized = value.trim().toLowerCase();
	if (["false", "0", "no", "off", ""].includes(normalized)) {
		return false;
	}
	if (["true", "1", "yes", "on"].includes(normalized)) {
		return true;
	}
	return defaultValue;
};

export const BRAND_WEBSITE_URL =
	resolveEnv(process.env.BRAND_WEBSITE_URL, process.env.NEXT_PUBLIC_BRAND_WEBSITE_URL) ??
	defaultWebsiteUrl;

export const BRAND_GITHUB_URL =
	resolveEnv(process.env.BRAND_GITHUB_URL, process.env.NEXT_PUBLIC_BRAND_GITHUB_URL) ??
	defaultGithubUrl;

export const BRAND_DOCS_URL =
	resolveEnv(process.env.BRAND_DOCS_URL, process.env.NEXT_PUBLIC_BRAND_DOCS_URL) ??
	defaultDocsUrl;

export const IS_CLOUD = parseBooleanEnv(process.env.IS_CLOUD, false);

const hasStripeSecretKey = normalize(process.env.STRIPE_SECRET_KEY) !== undefined;
const hasStripeWebhookSecret = normalize(process.env.STRIPE_WEBHOOK_SECRET) !== undefined;
const hasStripePublishableKey =
	normalize(
		process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
		process.env.STRIPE_PUBLISHABLE_KEY,
	) !== undefined;

const rawStripeEnabled = parseBooleanEnv(process.env.STRIPE_ENABLED, true);

export const STRIPE_ENABLED =
	rawStripeEnabled &&
	hasStripeSecretKey &&
	hasStripePublishableKey &&
	hasStripeWebhookSecret;

export const paths = (isServer = false) => {
  const forceLocalPaths = parseBooleanEnv(
    process.env.DOKPLOY_FORCE_LOCAL_PATHS,
    false,
  );

  const localRoot = normalize(process.env.DOKPLOY_BASE_PATH) ?? process.cwd();
  const localBasePath = path.join(localRoot, ".docker");

  const configuredRemoteBase = normalize(process.env.DOKPLOY_REMOTE_BASE_PATH);
  const remoteBasePath = configuredRemoteBase && !configuredRemoteBase.startsWith("/tmp/")
    ? configuredRemoteBase
    : `/etc/${BRAND_SLUG}`;

  const shouldUseRemotePaths =
    !forceLocalPaths &&
    (isServer || process.env.NODE_ENV === "production" || IS_CLOUD);

  const BASE_PATH = shouldUseRemotePaths ? remoteBasePath : localBasePath;
  const MAIN_TRAEFIK_PATH = `${BASE_PATH}/traefik`;
  const DYNAMIC_TRAEFIK_PATH = `${MAIN_TRAEFIK_PATH}/dynamic`;

  return {
    BASE_PATH,
    MAIN_TRAEFIK_PATH,
    DYNAMIC_TRAEFIK_PATH,
    LOGS_PATH: `${BASE_PATH}/logs`,
    APPLICATIONS_PATH: `${BASE_PATH}/applications`,
    COMPOSE_PATH: `${BASE_PATH}/compose`,
    SSH_PATH: `${BASE_PATH}/ssh`,
    CERTIFICATES_PATH: `${DYNAMIC_TRAEFIK_PATH}/certificates`,
    MONITORING_PATH: `${BASE_PATH}/monitoring`,
    REGISTRY_PATH: `${BASE_PATH}/registry`,
    SCHEDULES_PATH: `${BASE_PATH}/schedules`,
    VOLUME_BACKUPS_PATH: `${BASE_PATH}/volume-backups`,
  };
};
