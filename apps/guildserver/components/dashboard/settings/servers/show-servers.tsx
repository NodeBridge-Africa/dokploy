import { format } from "date-fns";
import { Loader2, MoreHorizontal, ServerIcon } from "lucide-react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { toast } from "sonner";
import { AlertBlock } from "@/components/shared/alert-block";
import { DialogAction } from "@/components/shared/dialog-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { api } from "@/utils/api";
import { ShowNodesModal } from "../cluster/nodes/show-nodes-modal";
import { TerminalModal } from "../web-server/terminal-modal";
import { ShowServerActions } from "./actions/show-server-actions";
import { HandleServers } from "./handle-servers";
import { SetupServer } from "./setup-server";
import { ShowDockerContainersModal } from "./show-docker-containers-modal";
import { ShowMonitoringModal } from "./show-monitoring-modal";
import { ShowSchedulesModal } from "./show-schedules-modal";
import { ShowSwarmOverviewModal } from "./show-swarm-overview-modal";
import { ShowTraefikFileSystemModal } from "./show-traefik-file-system-modal";
import { WelcomeSuscription } from "./welcome-stripe/welcome-suscription";

export const ShowServers = () => {
	const { t } = useTranslation("settings");
	const router = useRouter();
	const query = router.query;
	const { data, refetch, isLoading } = api.server.all.useQuery();
	const { mutateAsync } = api.server.remove.useMutation();
	const { data: sshKeys } = api.sshKey.all.useQuery();
	const { data: isCloud } = api.settings.isCloud.useQuery();
	const { data: canCreateMoreServers } =
		api.stripe.canCreateMoreServers.useQuery();

	return (
		<div className="w-full">
			{query?.success && isCloud && <WelcomeSuscription />}
			<Card className="h-full bg-sidebar  p-2.5 rounded-xl  max-w-5xl mx-auto">
				<div className="rounded-xl bg-background shadow-md ">
					<CardHeader className="">
						<CardTitle className="text-xl flex flex-row gap-2">
							<ServerIcon className="size-6 text-muted-foreground self-center" />
							Servers
						</CardTitle>
						<CardDescription>
							Add servers to deploy your applications remotely.
						</CardDescription>

						{isCloud && (
							<span
								className="bg-gradient-to-r cursor-pointer from-blue-600 via-green-500 to-indigo-400 inline-block text-transparent bg-clip-text text-sm"
								onClick={() => {
									router.push("/dashboard/settings/servers?success=true");
								}}
							>
								Reset Onboarding
							</span>
						)}
					</CardHeader>
					<CardContent className="space-y-2 py-8 border-t">
						{isLoading ? (
							<div className="flex flex-row gap-2 items-center justify-center text-sm text-muted-foreground min-h-[25vh]">
								<span>Loading...</span>
								<Loader2 className="animate-spin size-4" />
							</div>
						) : (
							<>
								{sshKeys?.length === 0 && data?.length === 0 ? (
									<div className="flex flex-col items-center gap-3 min-h-[25vh] justify-center text-center">
										<ServerIcon className="size-8 text-muted-foreground" />
										<p className="text-base text-muted-foreground max-w-md">
											Create your first server to start deploying applications. We'll automatically generate a dedicated SSH key for you during provisioning.
										</p>
										<HandleServers />
									</div>
								) : (
									<>
										{data?.length === 0 ? (
											<div className="flex flex-col items-center gap-3  min-h-[25vh] justify-center">
												<ServerIcon className="size-8 self-center text-muted-foreground" />
												<span className="text-base text-muted-foreground">
													Start adding servers to deploy your applications
													remotely.
												</span>
												<HandleServers />
												{(sshKeys?.length ?? 0) === 0 && (
													<p className="text-sm text-muted-foreground">
														No SSH keys required—GuildServer will generate one automatically for each new server.
													</p>
												)}
											</div>
										) : (
											<div className="flex flex-col gap-4  min-h-[25vh]">
												<Table>
													<TableCaption>
														<div className="flex flex-col  gap-4">
															See all servers
														</div>
													</TableCaption>
													<TableHeader>
														<TableRow>
															<TableHead className="text-left">Name</TableHead>
															{isCloud && (
																<TableHead className="text-center">
																	Status
																</TableHead>
															)}
															<TableHead className="text-center">
																Provisioner
															</TableHead>
															<TableHead className="text-center">
																IP Address
															</TableHead>
															<TableHead className="text-center">
																Port
															</TableHead>
															<TableHead className="text-center">
																Username
															</TableHead>
															<TableHead className="text-center">
																SSH Key
															</TableHead>
															<TableHead className="text-center">
																Created
															</TableHead>
															<TableHead className="text-right">
																Actions
															</TableHead>
														</TableRow>
													</TableHeader>
[... remainder of file identical to original ...]
