import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/utils/api";
import type { RouterOutputs } from "@/utils/api";

const Schema = z
	.object({
		name: z.string().min(1, {
			message: "Name is required",
		}),
		description: z.string().optional(),
		ipAddress: z.string().optional(),
		port: z.number().optional(),
		username: z.string().optional(),
		sshKeyId: z.string().optional(),
		provisioner: z.enum(["manual", "proxmox"] as const).default("manual"),
		proxmoxNode: z.string().optional(),
		proxmoxVmId: z.string().optional(),
		templateVmId: z.string().optional(),
		targetHostname: z.string().optional(),
		storageId: z.string().optional(),
	})
	.superRefine((values, ctx) => {
		if (values.provisioner !== "proxmox") {
			if (!values.ipAddress || values.ipAddress.trim() === "") {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["ipAddress"],
					message: "IP Address is required to connect to the server",
				});
			}
		}

		if (values.provisioner === "proxmox") {
			if (!values.proxmoxNode || values.proxmoxNode.trim() === "") {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["proxmoxNode"],
					message: "Select a Proxmox node",
				});
			}
			if (!values.templateVmId || values.templateVmId.trim() === "") {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["templateVmId"],
					message: "Select a template to clone",
				});
			}
			if (!values.proxmoxVmId || values.proxmoxVmId.trim() === "") {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["proxmoxVmId"],
					message: "Provide a target VM ID",
				});
			}
		}
	});

type Schema = z.infer<typeof Schema>;

type ServerDetails = RouterOutputs["server"]["one"] & {
	provisioner?: Schema["provisioner"];
	proxmoxNode?: string | null;
	proxmoxVmId?: number | null;
	provisioningMetadata?: Record<string, unknown> | null;
};

interface Props {
	serverId?: string;
}

export const HandleServers = ({ serverId }: Props) => {
	const { t } = useTranslation("settings");

	const utils = api.useUtils();
	const AUTO_GENERATE_SSH_KEY = "__auto__";
	const [isOpen, setIsOpen] = useState(false);
	const { data: canCreateMoreServers, refetch } =
		api.stripe.canCreateMoreServers.useQuery();

	const { data, refetch: refetchServer } = api.server.one.useQuery(
		{
			serverId: serverId || "",
		},
		{
			enabled: !!serverId,
		},
	);

	const serverDetails = (data ?? null) as ServerDetails | null;

	const { data: sshKeys } = api.sshKey.all.useQuery();
	const createServerMutation = api.server.create.useMutation();
	const updateServerMutation = api.server.update.useMutation();
	const isEditing = Boolean(serverId);
	const mutationError = isEditing
		? updateServerMutation.error
		: createServerMutation.error;
	const mutationIsLoading = isEditing
		? updateServerMutation.isLoading
		: createServerMutation.isLoading;
	const mutationIsError = isEditing
		? updateServerMutation.isError
		: createServerMutation.isError;
	const form = useForm<Schema>({
		defaultValues: {
			description: "",
			name: "",
			ipAddress: "",
			port: 22,
			username: "root",
			sshKeyId: undefined,
			provisioner: "manual",
			proxmoxNode: "",
			proxmoxVmId: "",
			templateVmId: "",
			targetHostname: "",
			storageId: "",
		},
		resolver: zodResolver(Schema),
	});

	const provisionerValue = form.watch("provisioner");
	const proxmoxNodeValue = form.watch("proxmoxNode");

	const proxmoxStatusQuery = api.proxmox.status.useQuery(undefined, {
		enabled: isOpen,
		staleTime: 1000 * 60,
	});

	const proxmoxEnabled = proxmoxStatusQuery.data?.configured ?? false;
	const shouldLoadProxmoxData =
		isOpen && provisionerValue === "proxmox" && proxmoxEnabled;

	const proxmoxNodesQuery = api.proxmox.nodes.useQuery(undefined, {
		enabled: shouldLoadProxmoxData,
	});

	const proxmoxVmsQuery = api.proxmox.vms.useQuery(
		{ node: proxmoxNodeValue || "" },
		{
			enabled: shouldLoadProxmoxData && Boolean(proxmoxNodeValue),
		},
	);

	const proxmoxStoragesQuery = api.proxmox.storages.useQuery(undefined, {
		enabled: shouldLoadProxmoxData,
		staleTime: 60_000,
	});

	const proxmoxNodes = proxmoxNodesQuery.data ?? [];
	const proxmoxVms = proxmoxVmsQuery.data ?? [];
	const proxmoxStorages = proxmoxStoragesQuery.data ?? [];
	const availableTemplates = proxmoxVms.filter((vm) => vm.template === 1);

	const previousProxmoxNodeRef = useRef<string | null>(null);

	useEffect(() => {
		const metadata = (serverDetails?.provisioningMetadata ?? {}) as Record<
			string,
			unknown
		>;
		form.reset({
			description: serverDetails?.description || "",
			name: serverDetails?.name || "",
			ipAddress: serverDetails?.ipAddress || "",
			port: serverDetails?.port || 22,
			username: serverDetails?.username || "root",
			sshKeyId: serverDetails?.sshKeyId ?? undefined,
			provisioner:
				(serverDetails?.provisioner as Schema["provisioner"]) || "manual",
			proxmoxNode:
				(typeof metadata.proxmoxNode === "string" && metadata.proxmoxNode) ||
				serverDetails?.proxmoxNode ||
				"",
			proxmoxVmId:
				serverDetails?.proxmoxVmId !== undefined &&
				serverDetails?.proxmoxVmId !== null
					? String(serverDetails.proxmoxVmId)
					: typeof metadata.proxmoxVmId === "number"
						? String(metadata.proxmoxVmId)
						: "",
			templateVmId:
				typeof metadata.templateId === "number"
					? String(metadata.templateId)
					: "",
			targetHostname:
				typeof metadata.targetHostname === "string"
					? metadata.targetHostname
					: "",
			storageId:
				typeof metadata.storageId === "string" ? metadata.storageId : "",
		});
	}, [form, form.reset, form.formState.isSubmitSuccessful, serverDetails]);

	useEffect(() => {
		if (provisionerValue !== "proxmox") {
			form.setValue("proxmoxNode", "");
			form.setValue("proxmoxVmId", "");
			form.setValue("templateVmId", "");
			form.setValue("targetHostname", "");
			form.setValue("storageId", "");
		}
	}, [form, provisionerValue]);

	useEffect(() => {
		const previousNode = previousProxmoxNodeRef.current;
		if (
			provisionerValue === "proxmox" &&
			previousNode !== null &&
			previousNode !== undefined &&
			previousNode !== (proxmoxNodeValue || "")
		) {
			form.setValue("proxmoxVmId", "");
			form.setValue("templateVmId", "");
		}
		previousProxmoxNodeRef.current = proxmoxNodeValue || "";
	}, [form, proxmoxNodeValue, provisionerValue]);

	useEffect(() => {
		if ((sshKeys?.length ?? 0) === 0) {
			form.setValue("sshKeyId", AUTO_GENERATE_SSH_KEY);
		}
	}, [form, sshKeys, AUTO_GENERATE_SSH_KEY]);

	useEffect(() => {
		refetch();
	}, [isOpen]);

	const onSubmit = async (data: Schema) => {
		const proxmoxVmNumeric =
			data.provisioner === "proxmox" && data.proxmoxVmId
				? Number.parseInt(data.proxmoxVmId, 10)
				: undefined;

		const templateId =
			data.provisioner === "proxmox" && data.templateVmId
				? Number.parseInt(data.templateVmId, 10)
				: undefined;

		const selectedTemplate =
			data.provisioner === "proxmox"
				? availableTemplates.find(
						(template) => String(template.vmid) === data.templateVmId,
				  )
				: undefined;

		const basePayload = {
			name: data.name,
			description: data.description || "",
			ipAddress: (data.ipAddress || "").trim(),
			port: data.port || 22,
			username: data.username || "root",
		sshKeyId:
			data.sshKeyId &&
			data.sshKeyId !== AUTO_GENERATE_SSH_KEY &&
			data.sshKeyId.length > 0
				? data.sshKeyId
				: undefined,
			provisioner: data.provisioner,
			proxmoxNode:
				data.provisioner === "proxmox" ? data.proxmoxNode || undefined : undefined,
			proxmoxVmId:
				data.provisioner === "proxmox" &&
				proxmoxVmNumeric !== undefined &&
				!Number.isNaN(proxmoxVmNumeric)
					? proxmoxVmNumeric
					: undefined,
			provisioningMetadata:
				data.provisioner === "proxmox"
					? {
						proxmoxNode: data.proxmoxNode || undefined,
						proxmoxVmId: proxmoxVmNumeric,
						linkedAt: new Date().toISOString(),
						templateId,
						templateName: selectedTemplate?.name,
						storageId: data.storageId || undefined,
						targetHostname: data.targetHostname || undefined,
					}
					: undefined,
		};

		try {
			if (isEditing) {
				await updateServerMutation.mutateAsync({
					...basePayload,
					serverId: serverId || "",
				});
			} else {
				await createServerMutation.mutateAsync(basePayload);
			}

			await utils.server.all.invalidate();
			if (isEditing) {
				refetchServer();
			}
			toast.success(isEditing ? "Server Updated" : "Server Created");
			setIsOpen(false);
		} catch (err) {
			console.error("Server mutation failed", err);
			toast.error(
				isEditing ? "Error updating a server" : "Error creating a server",
			);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				{serverId ? (
					<DropdownMenuItem
						className="w-full cursor-pointer "
						onSelect={(e) => e.preventDefault()}
					>
						Edit Server
					</DropdownMenuItem>
				) : (
					<Button className="cursor-pointer space-x-3">
						<PlusIcon className="h-4 w-4" />
						Create Server
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-3xl ">
				<DialogHeader>
					<DialogTitle>{serverId ? "Edit" : "Create"} Server</DialogTitle>
					<DialogDescription>
						{serverId ? "Edit" : "Create"} a server to deploy your applications
						remotely.
					</DialogDescription>
				</DialogHeader>
				<div>
					<p className="text-primary text-sm font-medium">
						You will need to purchase or rent a Virtual Private Server (VPS) to
						proceed, we recommend to use one of these providers since has been
						heavily tested.
					</p>
					<ul className="list-inside list-disc pl-4 text-sm text-muted-foreground mt-4">
						<li>
							<a
								href="https://www.hostinger.com/vps-hosting?REFERRALCODE=1SIUMAURICI97"
								className="text-link underline"
							>
								Hostinger - Get 20% Discount
							</a>
						</li>
						<li>
							<a
								href=" https://app.americancloud.com/register?ref=guildserver"
								className="text-link underline"
							>
								American Cloud - Get $20 Credits
							</a>
						</li>
						<li>
							<a
								href="https://m.do.co/c/db24efd43f35"
								className="text-link underline"
							>
								DigitalOcean - Get $200 Credits
							</a>
						</li>
						<li>
							<a
								href="https://hetzner.cloud/?ref=vou4fhxJ1W2D"
								className="text-link underline"
							>
								Hetzner - Get €20 Credits
							</a>
						</li>
						<li>
							<a
								href="https://www.vultr.com/?ref=9679828"
								className="text-link underline"
							>
								Vultr
							</a>
						</li>
						<li>
							<a
								href="https://www.linode.com/es/pricing/#compute-shared"
								className="text-link underline"
							>
								Linode
							</a>
						</li>
					</ul>
					<AlertBlock className="mt-4 px-4">
						You are free to use whatever provider, but we recommend to use one
						of the above, to avoid issues.
					</AlertBlock>
				</div>
				{!canCreateMoreServers && (
					<AlertBlock type="warning" className="mt-4">
						You cannot create more servers,{" "}
						<Link href="/dashboard/settings/billing" className="text-primary">
							Please upgrade your plan
						</Link>
					</AlertBlock>
				)}
		{mutationIsError && (
			<AlertBlock type="error">{mutationError?.message}</AlertBlock>
		)}
				<Form {...form}>
					<form
						id="hook-form-add-server"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-4"
					>
						<div className="flex flex-col gap-4 ">
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Name</FormLabel>
										<FormControl>
											<Input placeholder="Hostinger Server" {...field} />
										</FormControl>

										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
						<FormField
							control={form.control}
							name="description"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Description</FormLabel>
									<FormControl>
										<Textarea
											placeholder="This server is for databases..."
											className="resize-none"
											{...field}
										/>
									</FormControl>

									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="sshKeyId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>SSH Key</FormLabel>
									{sshKeys && sshKeys.length > 0 ? (
										<Select
											value={field.value ?? AUTO_GENERATE_SSH_KEY}
											onValueChange={field.onChange}
										>
											<SelectTrigger>
												<SelectValue placeholder="Choose how to authenticate" />
											</SelectTrigger>
											<SelectContent>
												<SelectGroup>
													<SelectItem value={AUTO_GENERATE_SSH_KEY}>
														Auto-generate new SSH key
													</SelectItem>
													{sshKeys.map((sshKey) => (
														<SelectItem
															key={sshKey.sshKeyId}
															value={sshKey.sshKeyId}
														>
															{sshKey.name}
														</SelectItem>
													))}
													<SelectLabel>
														Available keys ({sshKeys.length})
													</SelectLabel>
												</SelectGroup>
											</SelectContent>
										</Select>
									) : (
										<div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/40 p-3 text-sm text-muted-foreground">
											GuildServer will generate a new SSH key for this server automatically.
										</div>
									)}
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="provisioner"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Provisioner</FormLabel>
									<Select value={field.value} onValueChange={field.onChange}>
										<SelectTrigger>
											<SelectValue placeholder="Select how this server is managed" />
										</SelectTrigger>
										<SelectContent>
											<SelectGroup>
												<SelectItem value="manual">Bring your own server</SelectItem>
												<SelectItem value="proxmox">Proxmox managed</SelectItem>
											</SelectGroup>
										</SelectContent>
									</Select>
									<p className="text-xs text-muted-foreground">
										Switch to Proxmox to link a VM provisioned via the GuildServer
										control plane.
									</p>
									<FormMessage />
								</FormItem>
							)}
						/>
						{provisionerValue === "proxmox" && !proxmoxEnabled && (
							<AlertBlock type="warning" className="text-sm">
								Configure the Proxmox backend by setting
								<span className="mx-1 font-semibold">PROXMOX_BACKEND_URL</span>
								to enable automated provisioning.
							</AlertBlock>
						)}
					{provisionerValue === "proxmox" && proxmoxEnabled && (
						<>
							<p className="text-xs text-muted-foreground">
								Connected to Proxmox backend (status:{" "}
								{proxmoxStatusQuery.data?.health?.status ?? "unknown"}).
							</p>
							<div className="grid gap-4 md:grid-cols-2">
								<FormField
									control={form.control}
									name="proxmoxNode"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Proxmox Node</FormLabel>
											<Select
												value={field.value}
												onValueChange={field.onChange}
												disabled={proxmoxNodesQuery.isLoading}
											>
												<SelectTrigger>
													<SelectValue placeholder="Select a node" />
												</SelectTrigger>
												<SelectContent>
													{proxmoxNodesQuery.isLoading ? (
														<SelectItem value="__loading" disabled>
															<Loader2 className="mr-2 h-3 w-3 animate-spin" />
															Loading nodes
														</SelectItem>
													) : proxmoxNodes.length ? (
														proxmoxNodes.map((node) => (
															<SelectItem key={node.node} value={node.node}>
																{node.node}
															</SelectItem>
														))
													) : (
														<SelectItem value="__empty" disabled>
															No nodes available
														</SelectItem>
													)}
												</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="templateVmId"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Template</FormLabel>
											<Select
												value={field.value}
												onValueChange={field.onChange}
												disabled={availableTemplates.length === 0}
											>
												<SelectTrigger>
													<SelectValue placeholder="Select a template" />
												</SelectTrigger>
												<SelectContent>
													{availableTemplates.length === 0 ? (
														<SelectItem value="__empty" disabled>
															No templates available on this node
														</SelectItem>
													) : (
														availableTemplates.map((template) => (
															<SelectItem
																key={`${template.node}-${template.vmid}`}
																value={String(template.vmid)}
															>
																{template.name ? `${template.name} (${template.vmid})` : template.vmid}
															</SelectItem>
														))
													)}
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="proxmoxVmId"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Target VM ID</FormLabel>
											<Input
												type="number"
												placeholder="e.g. 150"
												value={field.value}
												onChange={(event) => field.onChange(event.target.value)}
											/>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="targetHostname"
									render={({ field }) => (
										<FormItem>
											<FormLabel>VM Hostname (optional)</FormLabel>
											<Input
												placeholder="guildserver-node"
												{...field}
											/>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="storageId"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Storage Target</FormLabel>
											<Select
												value={field.value}
												onValueChange={field.onChange}
												disabled={proxmoxStoragesQuery.isLoading}
											>
												<SelectTrigger>
													<SelectValue placeholder="Select storage" />
												</SelectTrigger>
												<SelectContent>
													{proxmoxStoragesQuery.isLoading ? (
														<SelectItem value="__loading" disabled>
															<Loader2 className="mr-2 h-3 w-3 animate-spin" />
															Loading storages
														</SelectItem>
													) : proxmoxStorages.length ? (
														proxmoxStorages.map((storage) => (
															<SelectItem key={storage.storage} value={storage.storage}>
																{storage.storage}
															</SelectItem>
														))
													) : (
														<SelectItem value="__empty" disabled>
															No storage targets found
														</SelectItem>
													)}
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>
						</>
					)}
						{provisionerValue === "proxmox" && proxmoxEnabled &&
							proxmoxNodesQuery.error && (
								<AlertBlock type="error" className="text-sm">
									Unable to load Proxmox nodes: {" "}
									{proxmoxNodesQuery.error?.message ?? "Unexpected error"}
								</AlertBlock>
							)}
					{provisionerValue === "proxmox" && proxmoxEnabled &&
						proxmoxVmsQuery.error && (
							<AlertBlock type="error" className="text-sm">
								Unable to load Proxmox VMs: {" "}
								{proxmoxVmsQuery.error?.message ?? "Unexpected error"}
							</AlertBlock>
						)}
					{provisionerValue === "proxmox" && proxmoxEnabled &&
						proxmoxStoragesQuery.error && (
							<AlertBlock type="error" className="text-sm">
								Unable to load Proxmox storages: {" "}
								{proxmoxStoragesQuery.error?.message ?? "Unexpected error"}
							</AlertBlock>
						)}
						<div className="grid grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="ipAddress"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("settings.terminal.ipAddress")}</FormLabel>
										<FormControl>
											<Input placeholder="192.168.1.100" {...field} />
										</FormControl>

										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="port"
								render={({ field }) => (
									<FormItem>
										<FormLabel>{t("settings.terminal.port")}</FormLabel>
										<FormControl>
											<Input
												placeholder="22"
												{...field}
												onChange={(e) => {
													const value = e.target.value;
													if (value === "") {
														field.onChange(0);
													} else {
														const number = Number.parseInt(value, 10);
														if (!Number.isNaN(number)) {
															field.onChange(number);
														}
													}
												}}
											/>
										</FormControl>

										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name="username"
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t("settings.terminal.username")}</FormLabel>
									<FormControl>
										<Input placeholder="root" {...field} />
									</FormControl>

									<FormMessage />
								</FormItem>
							)}
						/>
					</form>

					<DialogFooter>
						<Button
							isLoading={mutationIsLoading}
							disabled={!canCreateMoreServers && !serverId}
							form="hook-form-add-server"
							type="submit"
						>
							{serverId ? "Update" : "Create"}
						</Button>
					</DialogFooter>
				</Form>
			</DialogContent>
		</Dialog>
	);
};
