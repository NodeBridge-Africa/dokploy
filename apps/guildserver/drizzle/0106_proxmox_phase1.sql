CREATE TYPE "serverProvisioner" AS ENUM ('manual', 'proxmox');
CREATE TYPE "serverProvisioningStatus" AS ENUM ('idle', 'provisioning', 'ready', 'error');

ALTER TABLE "server"
  ADD COLUMN "provisioner" "serverProvisioner" NOT NULL DEFAULT 'manual',
  ADD COLUMN "provisioningStatus" "serverProvisioningStatus" NOT NULL DEFAULT 'idle',
  ADD COLUMN "provisioningMetadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "proxmoxNode" text,
  ADD COLUMN "proxmoxVmId" integer;
