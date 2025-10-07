import { TRPCError } from "@trpc/server";
import {
	IS_PROXMOX_ENABLED,
	PROXMOX_BACKEND_TIMEOUT,
	PROXMOX_BACKEND_TOKEN,
	PROXMOX_BACKEND_URL,
} from "@guildserver/server/constants/proxmox";
import type {
	ProxmoxHealth,
	ProxmoxNodeSummary,
	ProxmoxVmSummary,
	ProxmoxTemplateListing,
	ProxmoxStorageContentItem,
	ProxmoxStorageSummary,
	ProxmoxTask,
	ProxmoxTaskLogEntry,
	ProxmoxTaskStatus,
} from "@guildserver/server/types/proxmox";

const DEFAULT_HEADERS = {
	"content-type": "application/json",
	accept: "application/json",
} as const;

type BackendSuccessResponse<T> = {
	success: true;
	data: T;
	count?: number;
};

type BackendErrorResponse = {
	success: false;
	error?: unknown;
	message?: string;
};

type BackendResponse<T> = BackendSuccessResponse<T> | BackendErrorResponse;

export interface ProxmoxCloneOptions {
	newid?: number;
	name?: string;
	target?: string;
	pool?: string;
	full?: boolean;
	storage?: string;
	description?: string;
}

const resolveBaseUrl = () => {
	if (!IS_PROXMOX_ENABLED || !PROXMOX_BACKEND_URL) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message:
				"Proxmox integration is not configured. Set PROXMOX_BACKEND_URL to enable it.",
		});
	}

	try {
		return new URL(PROXMOX_BACKEND_URL);
	} catch (error) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "Invalid PROXMOX_BACKEND_URL provided.",
			cause: error,
		});
	}
};

const createAbortController = () => {
	const controller = new AbortController();
	let timeoutId: NodeJS.Timeout | undefined;

	if (Number.isFinite(PROXMOX_BACKEND_TIMEOUT) && PROXMOX_BACKEND_TIMEOUT > 0) {
		timeoutId = setTimeout(() => {
			controller.abort();
		}, PROXMOX_BACKEND_TIMEOUT);
	}

	return {
		controller,
		clear: () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = undefined;
			}
		},
	};
};

const buildHeaders = (initHeaders?: HeadersInit): HeadersInit => {
	const headers = new Headers({ ...DEFAULT_HEADERS, ...initHeaders });
	if (PROXMOX_BACKEND_TOKEN) {
		headers.set("authorization", `Bearer ${PROXMOX_BACKEND_TOKEN}`);
	}
	return headers;
};

const normalizeResponse = async <T>(response: Response): Promise<T> => {
	const contentType = response.headers.get("content-type") || "";
	const isJson = contentType.includes("application/json");
	const payload = isJson ? await response.json() : await response.text();

	if (!response.ok) {
		const message = isJson
			? (payload?.message as string | undefined) ??
			  (payload?.error as string | undefined) ??
			  response.statusText
			: response.statusText;

		throw new TRPCError({
			code: response.status >= 500 ? "INTERNAL_SERVER_ERROR" : "BAD_REQUEST",
			message: `Proxmox backend responded with status ${response.status}: ${message}`,
		});
	}

	if (typeof payload === "object" && payload !== null && "success" in payload) {
		const typed = payload as BackendResponse<T>;
		if (!typed.success) {
			const detail =
				typed.message ??
					(typeof typed.error === "string" ? typed.error : "Unknown error");
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: `Proxmox backend error: ${detail}`,
			});
		}
		return typed.data;
	}

	return payload as T;
};

const proxmoxRequest = async <T>(
	path: string,
	init: RequestInit = {},
): Promise<T> => {
	const baseUrl = resolveBaseUrl();
	const { controller, clear } = createAbortController();
	const url = new URL(path, baseUrl);

	try {
		const response = await fetch(url, {
			...init,
			headers: buildHeaders(init.headers),
			signal: controller.signal,
		});
		return await normalizeResponse<T>(response);
	} catch (error) {
		if (error instanceof TRPCError) {
			throw error;
		}
		if (error instanceof DOMException && error.name === "AbortError") {
			throw new TRPCError({
				code: "TIMEOUT",
				message: "Proxmox backend request timed out.",
			});
		}

		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Unable to reach Proxmox backend.",
			cause: error,
		});
	} finally {
		clear();
	}
};

export const getProxmoxHealth = async (): Promise<ProxmoxHealth> => {
	const baseUrl = resolveBaseUrl();
	const { controller, clear } = createAbortController();

	try {
		const response = await fetch(new URL("/health", baseUrl), {
			headers: buildHeaders(),
			signal: controller.signal,
		});
		return await normalizeResponse<ProxmoxHealth>(response);
	} catch (error) {
		if (error instanceof TRPCError) {
			throw error;
		}
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Unable to reach Proxmox backend health endpoint.",
			cause: error,
		});
	} finally {
		clear();
	}
};

export const getProxmoxNodes = async (): Promise<ProxmoxNodeSummary[]> => {
	return proxmoxRequest<ProxmoxNodeSummary[]>("/api/nodes");
};

export const getProxmoxNodeStatus = async (
	node: string,
): Promise<Record<string, unknown>> => {
	return proxmoxRequest(`/api/nodes/${encodeURIComponent(node)}/status`);
};

export const getProxmoxNodeVMs = async (
	node: string,
): Promise<ProxmoxVmSummary[]> => {
	if (!node) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Node parameter is required to list VMs.",
		});
	}
	return proxmoxRequest<ProxmoxVmSummary[]>(
		`/api/nodes/${encodeURIComponent(node)}/vms`,
	);
};

export const getProxmoxNodeTemplates = async (
	node: string,
	storage: string,
): Promise<ProxmoxTemplateListing> => {
	if (!node || !storage) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Both node and storage are required to list templates.",
		});
	}

	const items = await proxmoxRequest<ProxmoxStorageContentItem[]>(
		`/api/templates/nodes/${encodeURIComponent(node)}/storage/${encodeURIComponent(storage)}`,
	);

	return {
		node,
		storage,
		items,
	};
};

export const isProxmoxConfigured = () => IS_PROXMOX_ENABLED;

export const getProxmoxStorages = async (): Promise<ProxmoxStorageSummary[]> => {
	return proxmoxRequest<ProxmoxStorageSummary[]>("/api/storage");
};

export const cloneProxmoxVm = async (
	node: string,
	templateId: number,
	options: ProxmoxCloneOptions,
): Promise<ProxmoxTask> => {
	const payload = {
		...options,
		...(options.full !== undefined ? { full: options.full ? 1 : 0 } : {}),
	};

	return proxmoxRequest<ProxmoxTask>(
		`/api/templates/nodes/${encodeURIComponent(node)}/vms/${templateId}/clone`,
		{
			method: "POST",
			body: JSON.stringify(payload),
		},
	);
};

export const getProxmoxTaskStatus = async (
	node: string,
	upid: string,
): Promise<ProxmoxTaskStatus> => {
	return proxmoxRequest<ProxmoxTaskStatus>(
		`/api/tasks/nodes/${encodeURIComponent(node)}/${encodeURIComponent(upid)}/status`,
	);
};

export const getProxmoxTaskLog = async (
	node: string,
	upid: string,
	params: { start?: number; limit?: number } = {},
): Promise<ProxmoxTaskLogEntry[]> => {
	const searchParams = new URLSearchParams();
	if (params.start !== undefined) {
		searchParams.set("start", String(params.start));
	}
	if (params.limit !== undefined) {
		searchParams.set("limit", String(params.limit));
	}

	const query = searchParams.toString();

	return proxmoxRequest<ProxmoxTaskLogEntry[]>(
		`/api/tasks/nodes/${encodeURIComponent(node)}/${encodeURIComponent(upid)}/log${
			query ? `?${query}` : ""
		}`,
	);
};

export const startProxmoxVm = async (
	node: string,
	vmid: number,
): Promise<void> => {
	await proxmoxRequest(
		`/api/nodes/${encodeURIComponent(node)}/vms/${vmid}/start`,
		{ method: "POST" },
	);
};
