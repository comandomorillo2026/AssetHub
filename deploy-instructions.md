# AssetHub Deployment Guide (PostgreSQL)

## Switching from SQLite (dev) to PostgreSQL (production)

### 1. In `prisma/schema.prisma`, change the datasource provider:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 2. Set your DATABASE_URL in Vercel:

```
postgresql://user:password@host:5432/database?schema=public
```

Recommended PostgreSQL providers:
- **Supabase** (free tier available) - https://supabase.com
- **Neon** (serverless, free tier) - https://neon.tech
- **Render** - https://render.com

### 3. Run migration on deploy:

Vercel will run `prisma db push` or `prisma migrate deploy` via a postinstall script.
Add to your `package.json`:

```json
{
  "scripts": {
    "postinstall": "prisma generate",
    "vercel-build": "prisma db push --accept-data-loss && next build"
  }
}
```

### 4. Set all environment variables in Vercel:

See `.env.production.example` for the full list.

### 5. Initialize the super admin:

After first deploy, call the seed endpoint:
```
POST https://your-domain.com/api/admin/quick-seed
```

This creates the super admin account and demo plans.
