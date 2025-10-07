const normalize = (value?: string | null) =>
	value && value.trim().length > 0 ? value.trim() : undefined;

export const PROXMOX_BACKEND_URL = normalize(process.env.PROXMOX_BACKEND_URL);

export const PROXMOX_BACKEND_TOKEN = normalize(
	process.env.PROXMOX_BACKEND_TOKEN,
);

export const PROXMOX_BACKEND_TIMEOUT = Number.parseInt(
	process.env.PROXMOX_BACKEND_TIMEOUT ?? "15000",
	10,
);

export const IS_PROXMOX_ENABLED = Boolean(PROXMOX_BACKEND_URL);
