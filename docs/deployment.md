# WebShield Production Deployment & Hardening Guide

This document outlines the deployment process, infrastructure prerequisites, environment configuration, reverse proxy setup, database management, and operational best practices for deploying **WebShield** in a production environment.

---

## 1. Prerequisites & Infrastructure Requirements

| Component | Minimum Specification | Recommended Specification |
| :--- | :--- | :--- |
| **Operating System** | Ubuntu 22.04 LTS / Debian 12 / Alpine Linux | Ubuntu 24.04 LTS / Amazon Linux 2023 |
| **Node.js** | `v20.14.0 LTS` | `v20.x LTS` or `v22.x LTS` |
| **pnpm** | `v9.x` | `v9.x` |
| **Database** | PostgreSQL 14+ (1 GB RAM, 10 GB SSD) | Managed PostgreSQL (AWS RDS / GCP Cloud SQL / Supabase) |
| **Memory (API)** | 512 MB RAM | 1 GB – 2 GB RAM (for concurrent PDF generation) |
| **Storage** | 5 GB Persistent SSD | 20 GB+ for generated PDF reports storage |

---

## 2. Environment Variables Configuration

In production, supply environment variables via system environment or a secure secret manager (e.g. AWS Secrets Manager, Vault, Doppler). **NEVER commit `.env` to Git.**

### Complete Production Environment Matrix

| Variable | Type | Required | Example / Description |
| :--- | :--- | :---: | :--- |
| `NODE_ENV` | `string` | **Yes** | `production` |
| `PORT` | `number` | **Yes** | `5000` |
| `LOG_LEVEL` | `string` | No | `info` (options: `debug`, `info`, `warn`, `error`) |
| `DATABASE_URL` | `string` | **Yes** | `postgresql://user:password@db-host:5432/webshield?sslmode=require` |
| `JWT_SECRET` | `string` | **Yes** | 64+ byte base64 cryptographic secret (HMAC-SHA256) |
| `REFRESH_TOKEN_SECRET` | `string` | **Yes** | 64+ byte base64 cryptographic secret (HMAC-SHA256) |
| `ACCESS_TOKEN_EXPIRES_IN` | `string` | No | `15m` (recommended: 15m) |
| `REFRESH_TOKEN_EXPIRES_IN` | `string` | No | `7d` (format: `7d`, `30d`) |
| `CORS_ORIGIN` | `string` | **Yes** | `https://webshield.example.com` (Exact domain, no wildcard) |
| `SCAN_TIMEOUT` | `number` | No | `10000` (10 seconds socket timeout) |
| `MAX_SCAN_REQUESTS` | `number` | No | `10` (maximum concurrent probe requests per scan) |
| `DEV_ADMIN_PASSWORD` | `string` | **No** | **DO NOT SET IN PRODUCTION** |

### Secret Generation Command

```bash
# Generate high-entropy secrets for JWT_SECRET and REFRESH_TOKEN_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

---

## 3. Production Build & Deployment Steps

### Step 1: Clone & Install Dependencies

```bash
git clone https://github.com/your-username/webshield.git /var/www/webshield
cd /var/www/webshield
pnpm install --frozen-lockfile
```

### Step 2: Database Migration

```bash
# Apply pending Prisma migrations to production database
pnpm --filter @webshield/api prisma migrate deploy --schema=../../prisma/schema.prisma
```

### Step 3: Build Monorepo

```bash
# Builds security engine, Express API, and React frontend SPA
pnpm build
```

This compiles:
- `packages/security-engine/dist/` (TypeScript build)
- `apps/api/dist/` (Node.js API build)
- `apps/web/dist/` (Static React SPA build)

### Step 4: Storage Directory Initialization

Ensure the PDF storage directory exists with write permissions for the Node.js process:

```bash
mkdir -p /var/www/webshield/apps/api/storage/reports
chmod 700 /var/www/webshield/apps/api/storage/reports
```

---

## 4. Process Management (PM2)

Use **PM2** to manage the Node.js API process with auto-restart, cluster mode, and log rotation:

```bash
npm install -g pm2
```

Create `ecosystem.config.cjs`:

```javascript
module.exports = {
  apps: [
    {
      name: 'webshield-api',
      script: './apps/api/dist/server.js',
      cwd: '/var/www/webshield',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      max_memory_restart: '1G',
      kill_timeout: 10000,
      listen_timeout: 10000,
      error_file: '/var/log/webshield/api-error.log',
      out_file: '/var/log/webshield/api-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
```

Start the API:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

---

## 5. Reverse Proxy Configuration (Nginx & HTTPS)

Place Nginx in front of WebShield to terminate TLS, serve static React assets, and proxy API traffic:

```nginx
# /etc/nginx/sites-available/webshield.conf

server {
    listen 80;
    server_name webshield.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name webshield.example.com;

    # TLS Certificates (Let's Encrypt / Certbot)
    ssl_certificate /etc/letsencrypt/live/webshield.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/webshield.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Frontend Static Assets (Vite Build)
    root /var/www/webshield/apps/web/dist;
    index index.html;

    # Static Assets Caching
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA Routing Fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API Reverse Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-ID $request_id;
        
        # Buffer settings for PDF downloads
        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;

        # Timeouts
        proxy_connect_timeout 15s;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}
```

---

## 6. Cookies & CORS Configuration

- **Cookies**: In production (`NODE_ENV=production`), refresh cookies are automatically configured with `secure: true`, `httpOnly: true`, and `sameSite: 'strict'`. HTTPS is mandatory for cookie exchange.
- **CORS**: Set `CORS_ORIGIN` to your exact frontend origin (e.g. `https://webshield.example.com`). Wildcards (`*`) are disallowed because `credentials: true` is enforced for cookie transmission.

---

## 7. Storage, Logs & Health Monitoring

### Storage Management
PDF reports are stored on the local filesystem under `apps/api/storage/reports/`.
- Ensure disk capacity monitoring (minimum 10 GB allocated).
- Optional cron cleanup for old reports:
  ```bash
  # Delete reports older than 90 days
  find /var/www/webshield/apps/api/storage/reports -name "*.pdf" -mtime +90 -delete
  ```

### Log Management
- **PM2 Log Rotation**:
  ```bash
  pm2 install pm2-logrotate
  pm2 set pm2-logrotate:max_size 50M
  pm2 set pm2-logrotate:retain 14
  ```

### Health Check Endpoints
- **Public Liveness Probe**: `GET /api/health`
  - Returns `200 OK` for load balancer probes.
- **Administrative Telemetry**: `GET /api/admin/health` (Requires `ADMIN` JWT)
  - Returns active database latency, memory stats, and storage checks with zero IP/secret leakage.

---

## 8. Database Backups & Disaster Recovery

Implement automated daily PostgreSQL backups using `pg_dump`:

```bash
# Automated daily backup script
pg_dump -U postgres -h db-host -Fc webshield > /var/backups/webshield_$(date +%Y%m%d_%H%M%S).dump

# Restore procedure
pg_restore -U postgres -h db-host -d webshield /var/backups/webshield_20260827_120000.dump
```
