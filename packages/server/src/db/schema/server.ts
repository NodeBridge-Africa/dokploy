import { relations } from "drizzle-orm";
import {
	boolean,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { nanoid } from "nanoid";
import { z } from "zod";
import { organization } from "./account";
import { applications } from "./application";
import { certificates } from "./certificate";
import { compose } from "./compose";
import { deployments } from "./deployment";
import { mariadb } from "./mariadb";
import { mongo } from "./mongo";
import { mysql } from "./mysql";
import { postgres } from "./postgres";
import { redis } from "./redis";
import { schedules } from "./schedule";
import { sshKeys } from "./ssh-key";
import { generateAppName } from "./utils";
export const serverStatus = pgEnum("serverStatus", ["active", "inactive"]);

export const serverProvisioner = pgEnum("serverProvisioner", ["manual", "proxmox"]);

export const serverProvisioningStatus = pgEnum(
	"serverProvisioningStatus",
	["idle", "provisioning", "ready", "error"],
);

export type ServerProvisioningMetadata = {
	templateId?: number;
	templateName?: string;
	storageId?: string;
	storageType?: string;
	diskSizeGb?: number;
	networkBridge?: string;
	cloudInit?: Record<string, unknown>;
	lastTaskId?: string;
	ipAddress?: string;
	notes?: string;
	proxmoxNode?: string;
	proxmoxVmId?: number;
	linkedAt?: string;
	fullClone?: boolean;
	targetHostname?: string;
	lastTaskStatus?: string;
};

export const server = pgTable("server", {
	serverId: text("serverId")
		.notNull()
		.primaryKey()
		.$defaultFn(() => nanoid()),
	name: text("name").notNull(),
	description: text("description"),
	ipAddress: text("ipAddress").notNull(),
	port: integer("port").notNull(),
	username: text("username").notNull().default("root"),
	appName: text("appName")
		.notNull()
		.$defaultFn(() => generateAppName("server")),
	enableDockerCleanup: boolean("enableDockerCleanup").notNull().default(false),
	createdAt: text("createdAt").notNull(),
	organizationId: text("organizationId")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	serverStatus: serverStatus("serverStatus").notNull().default("active"),
	command: text("command").notNull().default(""),
	sshKeyId: text("sshKeyId").references(() => sshKeys.sshKeyId, {
		onDelete: "set null",
	}),
	metricsConfig: jsonb("metricsConfig")
		.$type<{
			server: {
				type: "GuildServer" | "Remote";
				refreshRate: number;
				port: number;
				token: string;
				urlCallback: string;
				retentionDays: number;
				cronJob: string;
				thresholds: {
					cpu: number;
					memory: number;
				};
			};
			containers: {
				refreshRate: number;
				services: {
					include: string[];
					exclude: string[];
				};
			};
		}>()
		.notNull()
		.default({
			server: {
				type: "Remote",
				refreshRate: 60,
				port: 4500,
				token: "",
				urlCallback: "",
				cronJob: "",
				retentionDays: 2,
				thresholds: {
					cpu: 0,
					memory: 0,
				},
			},
			containers: {
				refreshRate: 60,
				services: {
					include: [],
					exclude: [],
				},
			},
		}),
	provisioner: serverProvisioner("provisioner")
		.notNull()
		.default("manual"),
	provisioningStatus: serverProvisioningStatus("provisioningStatus")
		.notNull()
		.default("idle"),
	provisioningMetadata: jsonb("provisioningMetadata")
		.$type<ServerProvisioningMetadata>()
		.notNull()
		.default({}),
	proxmoxNode: text("proxmoxNode"),
	proxmoxVmId: integer("proxmoxVmId"),
});

export const serverRelations = relations(server, ({ one, many }) => ({
	deployments: many(deployments),
	sshKey: one(sshKeys, {
		fields: [server.sshKeyId],
		references: [sshKeys.sshKeyId],
	}),
	applications: many(applications),
	compose: many(compose),
	redis: many(redis),
	mariadb: many(mariadb),
	mongo: many(mongo),
	mysql: many(mysql),
	postgres: many(postgres),
	certificates: many(certificates),
	organization: one(organization, {
		fields: [server.organizationId],
		references: [organization.id],
	}),
	schedules: many(schedules),
}));

export const serverProvisionerSchema = z.enum(["manual", "proxmox"] as const);

export const serverProvisioningStatusSchema = z.enum(
	["idle", "provisioning", "ready", "error"] as const,
);

export const provisioningMetadataSchema = z
	.object({
		templateId: z.number().optional(),
		templateName: z.string().optional(),
		storageId: z.string().optional(),
		storageType: z.string().optional(),
		diskSizeGb: z.number().optional(),
		networkBridge: z.string().optional(),
		cloudInit: z.record(z.any()).optional(),
		lastTaskId: z.string().optional(),
		ipAddress: z.string().optional(),
		notes: z.string().optional(),
		proxmoxNode: z.string().optional(),
		proxmoxVmId: z.number().optional(),
		linkedAt: z.string().optional(),
		fullClone: z.boolean().optional(),
		targetHostname: z.string().optional(),
		lastTaskStatus: z.string().optional(),
	})
	.partial();

const createSchema = createInsertSchema(server, {
	serverId: z.string().min(1),
	name: z.string().min(1),
	description: z.string().optional(),
	provisioner: serverProvisionerSchema.optional(),
	provisioningStatus: serverProvisioningStatusSchema.optional(),
	provisioningMetadata: provisioningMetadataSchema.optional(),
	proxmoxNode: z.string().optional(),
	proxmoxVmId: z.number().optional(),
});

export const apiCreateServer = createSchema
	.pick({
		name: true,
		description: true,
		ipAddress: true,
		port: true,
		username: true,
		sshKeyId: true,
		provisioner: true,
		proxmoxNode: true,
		proxmoxVmId: true,
		provisioningMetadata: true,
	})
	.required()
	.extend({
		sshKeyId: z.string().optional(),
		provisioner: serverProvisionerSchema.optional().default("manual"),
		proxmoxNode: z.string().optional(),
		proxmoxVmId: z.number().optional(),
		provisioningMetadata: provisioningMetadataSchema
			.optional()
			.default({}),
	});

export const apiFindOneServer = createSchema
	.pick({
		serverId: true,
	})
	.required();

export const apiRemoveServer = createSchema
	.pick({
		serverId: true,
	})
	.required();

export const apiUpdateServer = createSchema
	.pick({
		name: true,
		description: true,
		serverId: true,
		ipAddress: true,
		port: true,
		username: true,
		sshKeyId: true,
		provisioner: true,
		proxmoxNode: true,
		proxmoxVmId: true,
		provisioningMetadata: true,
	})
	.required()
	.extend({
		sshKeyId: z.string().optional(),
		command: z.string().optional(),
		provisioner: serverProvisionerSchema.optional(),
		proxmoxNode: z.string().optional(),
		proxmoxVmId: z.number().optional(),
		provisioningMetadata: provisioningMetadataSchema.optional(),
	});

export const apiUpdateServerMonitoring = createSchema
	.pick({
		serverId: true,
	})
	.required()
	.extend({
		metricsConfig: z
			.object({
				server: z.object({
					refreshRate: z.number().min(2),
					port: z.number().min(1),
					token: z.string(),
					urlCallback: z.string().url(),
					retentionDays: z.number().min(1),
					cronJob: z.string().min(1),
					thresholds: z.object({
						cpu: z.number().min(0),
						memory: z.number().min(0),
					}),
				}),
				containers: z.object({
					refreshRate: z.number().min(2),
					services: z.object({
						include: z.array(z.string()).optional(),
						exclude: z.array(z.string()).optional(),
					}),
				}),
			})
			.required(),
	});
