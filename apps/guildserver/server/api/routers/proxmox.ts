import {
	getProxmoxHealth,
	getProxmoxNodeTemplates,
	getProxmoxNodeVMs,
	getProxmoxNodes,
	getProxmoxNodeStatus,
	getProxmoxStorages,
	isProxmoxConfigured,
} from "@guildserver/server/services/proxmox";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const proxmoxRouter = createTRPCRouter({
	status: protectedProcedure.query(async () => {
		if (!isProxmoxConfigured()) {
			return {
				configured: false,
				message:
					"Proxmox integration is disabled. Set PROXMOX_BACKEND_URL to enable it.",
			};
		}

		const health = await getProxmoxHealth();

		return {
			configured: true,
			health,
		};
	}),
	nodes: protectedProcedure.query(async () => {
		return getProxmoxNodes();
	}),
	nodeStatus: protectedProcedure
		.input(
			z.object({
				node: z.string().min(1),
			}),
		)
		.query(async ({ input }) => {
			return getProxmoxNodeStatus(input.node);
		}),
	vms: protectedProcedure
		.input(
			z.object({
				node: z.string().min(1),
			}),
		)
		.query(async ({ input }) => {
			return getProxmoxNodeVMs(input.node);
		}),
	templates: protectedProcedure
		.input(
			z.object({
				node: z.string().min(1),
				storage: z.string().min(1),
			}),
		)
		.query(async ({ input }) => {
			return getProxmoxNodeTemplates(input.node, input.storage);
		}),
	storages: protectedProcedure.query(async () => {
		return getProxmoxStorages();
	}),
});
