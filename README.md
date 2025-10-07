# GuildServer - Self-Hosted Platform as a Service

<div align="center">
  <img src=".github/sponsors/logo.png" alt="GuildServer - Open Source Alternative to Vercel, Heroku and Netlify." width="100%"  />
  </br>
  </br>
  <p>Self-hosted Platform as a Service (PaaS) for deploying applications and managing databases</p>
</div>

## 🚀 Quick Start

This README documents the setup and configuration of GuildServer on your local development environment.

### Prerequisites

- **Node.js**: ^20.16.0
- **pnpm**: >=9.12.0
- **Docker**: For running Redis and PostgreSQL
- **Linux/Unix**: Tested on Ubuntu/Debian systems

### Installation

1. **Clone and Install Dependencies**
   ```bash
   git clone <your-repo-url>
   cd guildserver
   pnpm install
   ```

2. **Start Required Services**
   ```bash
   # Start Redis
   docker run -d --name guildserver-redis -p 6379:6379 redis:7-alpine
   
   # Start PostgreSQL
   docker run -d --name guildserver-postgres \
     -e POSTGRES_USER=guildserver \
     -e POSTGRES_PASSWORD=amukds4wi9001583845717ad2 \
     -e POSTGRES_DB=guildserver \
     -p 5432:5432 postgres:15
   ```

3. **(Optional) Install Mailpit for Local Email Testing**
   ```bash
   brew install mailpit
   mailpit --smtp 127.0.0.1:1025 --listen 127.0.0.1:8025
   ```
   - The SMTP server listens on port `1025` and the Mailpit UI is available at `http://127.0.0.1:8025`.
   - Keep this process running while you test email verification or password reset flows.

4. **Run the Application**
   ```bash
DATABASE_URL=postgres://guildserver:amukds4wi9001583845717ad2@localhost:5432/guildserver \
NODE_ENV=development \
PORT=3000 \
HOST=0.0.0.0 \
IS_CLOUD=false \
PUBLIC_APP_URL=http://localhost:3000 \
STRIPE_ENABLED=false \
SMTP_SERVER=127.0.0.1 \
SMTP_PORT=1025 \
SMTP_USERNAME= \
SMTP_PASSWORD= \
SMTP_FROM_ADDRESS="GuildServer <no-reply@example.com>" \
```
   # Start GuildServer in development mode
pnpm run guildserver:dev

```
5. **Access the Application**
   - Open your browser and navigate to: **http://localhost:3000**
   - Login with your admin credentials

## 🔐 Authentication

### Admin Account

- **Email**: `johnsdanlami@gmail.com`
- **Role**: Owner (Full admin privileges)
- **Organization**: "My Organization"

### First-Time Setup

If you need to create a new admin account:

1. **Register the first user** through the web interface
2. **Update user status** in the database:
   ```sql
   UPDATE user_temp 
   SET "isRegistered" = true, email_verified = true 
   WHERE email = 'your-email@example.com';
   ```

## 🗄️ Database Schema

### Core Tables

| Table | Purpose | Records |
|-------|---------|---------|
| `user_temp` | User accounts and profiles | 1 |
| `organization` | Organizations/workspaces | 1 |
| `member` | User memberships and roles | 1 |
| `server` | Server configurations | 1 |
| `ssh-key` | SSH key management | 1 |

### Current Data Summary

- **Users**: 1 (admin account)
- **Organizations**: 1 ("My Organization")
- **Projects**: 0 (none created yet)
- **Applications**: 0 (none deployed yet)
- **Servers**: 1 (example server configured)

## 🖥️ Server Management

### Adding Servers

GuildServer supports multiple servers for deploying applications and databases.

#### Prerequisites

1. **SSH Key Pair**: Required for secure server access
2. **Server Access**: IP address, port, username
3. **Docker**: Must be installed on target servers

#### SSH Key Setup

1. **Generate SSH Key Pair**:
   ```bash
   ssh-keygen -t rsa -b 4096 -f ~/.ssh/guildserver_key -N ""
   ```

2. **Add Public Key to Server**:
   ```bash
   # On your target server
   echo "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDL8+DCyq0JzQmrLFr4fCjX9h2ZEKeBz8fAYh6TcS34uY1iuXM8RIgzpLfNkGvoNYtIuNwjhNn4MUODH97qV8E9dZXA5QT5zwLK3v/kfjfgUKALN62XMSSEF6EllbQxmn65SXn5I0RicanFWKt2z4+HR4kNz1hoMxag+S784g+rke7JCCfuHPR3GtYbNPH7Y9ZieYJiRy6U/O18FaUZvRb6kSVlgUP3L1KFjLZ6SeHiRk0A2/1zrAGtdHhiZgm8febnbMyNJ/knfhhBzAeTCZ0BNrC3bG42LiMx1GNGR8x2tjjruTifOeT7Si798sw8RdceoNIOkR2kjp5oWJY5PuAsuuHLhZ3AvnkB6yXcF6dx/TU9MfB16bE2feMVe2JJnwDWmuaRvhl4i74PZD1sD4L/URBFlqfJ1u5IoFAwYJvqflyZH65eSyyRgnl80uTHDXNkJw8dtLBmUixha0AkbJazMtKbwvB5M8ukQvQfJVFNUgoza2F0VwWSx06nmizq7J9ktHw0+woalEBii98pT+j14QMWIKKbIbQkQ8WThfWSLra1SEVfgpfpXAWpGylxanjMx4BCvphtJhYqV4AoIr8bnZ6bcZy+El3pXOkB0HDPmz8wB8q/fYWQ76Bda1Hff0ErJyLC9JCOGodAJCL5z3learIayZwfC4A2HDHj98epcQ== john-danlami@john-danlami-ThinkPad-X1-Carbon-7th" >> ~/.ssh/authorized_keys
   ```

#### Adding Server via Web Interface

1. **Navigate to**: Settings → Servers
2. **Click**: "Add Server"
3. **Fill in details**:
   - **Name**: Server name (e.g., "Production Server")
   - **Description**: Optional description
   - **IP Address**: Server IP address
   - **Port**: SSH port (usually 22)
   - **Username**: SSH username (usually root)
   - **SSH Key**: Select "GuildServer Server Key"

#### Adding Server via Database

```sql
INSERT INTO server (
    "serverId", 
    name, 
    description, 
    "ipAddress", 
    port, 
    username, 
    "appName", 
    "enableDockerCleanup", 
    "createdAt", 
    "sshKeyId", 
    "serverStatus", 
    command, 
    "metricsConfig", 
    "organizationId"
) VALUES (
    gen_random_uuid(),
    'Your Server Name',
    'Your server description',
    'YOUR_SERVER_IP',
    22,
    'root',
    'your-server-app',
    false,
    NOW(),
    '3650a075-85d0-4f64-808c-6fae240286bf', -- SSH Key ID
    'active',
    '',
    '{"server":{"type":"Remote","refreshRate":60,"port":4500,"token":"","urlCallback":"","cronJob":"","retentionDays":2,"thresholds":{"cpu":0,"memory":0}},"containers":{"refreshRate":60,"services":{"include":[],"exclude":[]}}}',
    'NR_EBxF1R2TbieVBCau1o' -- Organization ID
);
```

### Proxmox Automation (Beta)

GuildServer can now orchestrate dedicated Proxmox guest provisioning through the bundled Proxmox API wrapper (`paas-backend`). To enable it:

- Configure the new environment variables on the GuildServer API process:
  - `PROXMOX_BACKEND_URL` – URL where the paas-backend service is reachable.
  - `PROXMOX_BACKEND_TOKEN` – Optional bearer token if you secure the backend.
  - `PROXMOX_BACKEND_TIMEOUT` – Request timeout in milliseconds (default `15000`).
- Run the `paas-backend` service (see `paas-backend/README.md`) and ensure Redis is available for background workers.
- Create a server from the dashboard and choose **Proxmox managed**. Pick the Proxmox node, template VM, target VM ID, hostname, and storage.
- A provisioning worker clones the template, tracks the Proxmox task, and updates the server record. Status appears in *Settings → Servers* under the Provisioner column.
- Workers start automatically alongside the main server process when `IS_CLOUD=false`.

## 🛠️ Features

### Applications
- Deploy any type of application (Node.js, PHP, Python, Go, Ruby, etc.)
- Automatic containerization with Docker
- Environment variable management
- Custom domains and SSL certificates
- Auto-scaling capabilities

### Databases
- **MySQL**: Relational database management
- **PostgreSQL**: Advanced relational database
- **MongoDB**: NoSQL document database
- **Redis**: In-memory data structure store
- **MariaDB**: MySQL alternative

### Infrastructure
- **Docker Compose**: Native support for complex applications
- **Multi-Node**: Scale applications using Docker Swarm
- **Traefik Integration**: Automatic load balancing and routing
- **Real-time Monitoring**: CPU, memory, storage, and network usage

### Security
- **SSH Key Management**: Secure server access
- **Role-based Access Control**: User permissions and roles
- **Two-Factor Authentication**: Enhanced security
- **API Key Management**: Programmatic access

## 📊 Monitoring & Management

### Real-time Monitoring
- Server resource usage (CPU, Memory, Disk, Network)
- Container statistics
- Application performance metrics
- Custom alerting and notifications

### Backup & Recovery
- Automated database backups
- Volume backup management
- Scheduled backup jobs
- One-click restore functionality

### Notifications
- **Email**: SMTP integration
- **Slack**: Webhook notifications
- **Discord**: Channel notifications
- **Telegram**: Bot notifications
- **Gotify**: Push notifications

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `NODE_ENV` | Environment mode | Yes | development |
| `PORT` | HTTP port | No | 3000 |
| `HOST` | Server bind address | No | 0.0.0.0 |
| `IS_CLOUD` | Multi-tenant mode | Yes | false |
| `PUBLIC_APP_URL` | Public base URL | Yes | http://localhost:3000 |
| `STRIPE_ENABLED` | Enable billing | No | true |
| `SERVER_URL` | Deployments service base URL | Yes | http://localhost:4000 |
| `API_KEY` | Shared secret between GuildServer and deployments service | Yes | dev-guildserver-key |
| `DOKPLOY_FORCE_LOCAL_PATHS` | Force every path to use the local `.docker` directory (rarely needed) | No | false |
| `DOKPLOY_REMOTE_BASE_PATH` | Base directory to use on remote servers (defaults to `/etc/${BRAND_SLUG}`) | No | - |
| `DOKPLOY_REMOTE_DOCKER_CMD` | Override docker binary for remote commands (e.g. `sudo docker`) | No | docker |
| `DOKPLOY_REMOTE_SHELL_PREFIX` | Optional shell prefix executed before remote commands (e.g. `sudo -n bash`) | No | - |
| `SMTP_SERVER` | Outbound SMTP host | No | 127.0.0.1 |
| `SMTP_PORT` | Outbound SMTP port | No | 1025 |
| `SMTP_USERNAME` | SMTP username (if required) | No | - |
| `SMTP_PASSWORD` | SMTP password (if required) | No | - |
| `SMTP_FROM_ADDRESS` | Default sender address for GuildServer emails | No | GuildServer &lt;no-reply@example.com&gt; |

### Database Configuration

- **Host**: localhost:5432
- **Database**: guildserver
- **Username**: guildserver
- **Password**: amukds4wi9001583845717ad2

### Redis Configuration

- **Host**: localhost:6379
- **Port**: 6379
- **Container**: guildserver-redis

## 🚀 Deployment

### Local Development

```bash
# Start services
docker start guildserver-redis guildserver-postgres

# Run supporting services
# (requires Redis, DATABASE_URL, DOKPLOY_REMOTE_BASE_PATH, and optionally DOKPLOY_REMOTE_DOCKER_CMD in apps/api/.env for remote docker access)
pnpm --filter @guildserver/api run dev

# Run application (in a new terminal)
pnpm run guildserver:dev
```

### Production Deployment

1. **Set up production environment variables**
2. **Configure SSL certificates**
3. **Set up monitoring and backups**
4. **Deploy using Docker or traditional hosting**

## 📝 API Documentation

GuildServer provides a comprehensive API for programmatic access:

- **REST API**: Standard HTTP endpoints
- **tRPC**: Type-safe API with automatic documentation
- **WebSocket**: Real-time communication
- **CLI**: Command-line interface

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the Apache-2.0 License.

## 🆘 Support

- **Documentation**: [docs.guildserver.com](https://docs.guildserver.com)
- **Discord**: [Join our community](https://discord.gg/2tBnJ3jDJc)
- **Issues**: [GitHub Issues](https://github.com/guildserver/guildserver/issues)

## 🔄 Updates

To update GuildServer:

1. **Pull latest changes**:
   ```bash
   git pull origin main
   ```

2. **Update dependencies**:
   ```bash
   pnpm install
   ```

3. **Run migrations**:
   ```bash
   pnpm run migration:run
   ```

4. **Restart the application**:
   ```bash
   pnpm run guildserver:dev
   ```

---

**GuildServer** - Simplifying deployment and infrastructure management since 2024.
