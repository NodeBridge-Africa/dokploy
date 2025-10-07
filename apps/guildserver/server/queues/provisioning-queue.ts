import {
	cloneProxmoxVm,
	getProxmoxTaskStatus,
	startProxmoxVm,
} from "@guildserver/server/services/proxmox";
import {
	findServerById,
	updateServerById,
} from "@guildserver/server/services/server";
import { Worker } from "bullmq";
import type { ProxmoxProvisioningJob } from "./queue-types";
import { redisConfig } from "./redis-connection";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const MAX_POLL_ATTEMPTS = 60;
const POLL_DELAY_MS = 5_000;

export const provisioningWorker = new Worker<ProxmoxProvisioningJob>(
	"proxmox-provisioning",
	async (job) => {
		const {
			serverId,
			node,
			templateId,
			targetVmId,
			targetName,
			storage,
			fullClone,
		} = job.data;

		const server = await findServerById(serverId);

		if (!server) {
			throw new Error(`Server ${serverId} not found for provisioning job.`);
		}

		const provisioningMetadata = {
			...(server.provisioningMetadata || {}),
			templateId,
			proxmoxNode: node,
			proxmoxVmId: targetVmId,
			targetHostname: targetName,
			storageId: storage,
			fullClone,
		};

		await updateServerById(serverId, {
			provisioningStatus: "provisioning",
			provisioningMetadata,
		});

		const task = await cloneProxmoxVm(node, templateId, {
			newid: targetVmId,
			name: targetName ?? server.name,
			target: node,
			storage,
			full: fullClone ?? true,
			pool: undefined,
		});

		await updateServerById(serverId, {
			provisioningMetadata: {
				...provisioningMetadata,
				lastTaskId: task.upid,
			},
		});

		let status;
		for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
			status = await getProxmoxTaskStatus(node, task.upid);
			await job.updateProgress(Math.round((attempt / MAX_POLL_ATTEMPTS) * 100));

			if (status.status === "stopped") {
				break;
			}

			await sleep(POLL_DELAY_MS);
		}

		if (!status || status.status !== "stopped" || status.exitstatus !== "OK") {
			await updateServerById(serverId, {
				provisioningStatus: "error",
				provisioningMetadata: {
					...provisioningMetadata,
					lastTaskStatus: status?.exitstatus ?? "unknown-error",
				},
			});
			throw new Error(
				`Proxmox provisioning failed for server ${server.name}: ${
					status?.exitstatus ?? "unknown"
				}`,
			);
		}

		await updateServerById(serverId, {
			provisioningStatus: "ready",
			provisioningMetadata: {
				...provisioningMetadata,
				lastTaskStatus: status.exitstatus,
			},
			proxmoxVmId: targetVmId,
		});

		try {
			await startProxmoxVm(node, targetVmId);
		} catch (error) {
			job.log(
				`Failed to auto-start VM ${targetVmId}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	},
	{
		autorun: false,
		connection: redisConfig,
	},
);
