export interface ProxmoxHealth {
	status: string;
	timestamp?: string;
	uptime?: number;
	environment?: string;
	version?: string;
}

export interface ProxmoxNodeSummary {
	node: string;
	status: string;
	uptime?: number;
	maxcpu?: number;
	maxmem?: number;
	level?: string;
	type?: string;
}

export interface ProxmoxVmSummary {
	node: string;
	vmid: number;
	name?: string;
	status?: string;
	uptime?: number;
	type?: string;
	maxcpu?: number;
	maxmem?: number;
	tags?: string;
	template?: number;
}

export interface ProxmoxStorageContentItem {
	volid: string;
	format?: string;
	size?: number;
	digest?: string;
	content?: string;
	notes?: string;
}

export interface ProxmoxTemplateListing {
	node: string;
	storage: string;
	items: ProxmoxStorageContentItem[];
}

export interface ProxmoxStorageSummary {
	storage: string;
	type?: string;
	content?: string;
	shared?: number;
	used?: number;
	avail?: number;
	total?: number;
	active?: number;
	enabled?: number;
}

export interface ProxmoxTask {
	upid: string;
	node: string;
	status?: string;
	user?: string;
	type?: string;
	starttime?: number;
	endtime?: number;
	exitstatus?: string;
}

export interface ProxmoxTaskStatus {
	status: string;
	exitstatus?: string;
	type?: string;
	starttime?: number;
	endtime?: number;
}

export interface ProxmoxTaskLogEntry {
	n: number;
	t: string;
}
