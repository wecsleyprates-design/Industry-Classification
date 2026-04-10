# Workflow Service

This is the Workflow Service for Worth-AI, providing workflow management
capabilities.

## Getting Started

### Prerequisites

- **Node.js 22.19.0+** (required)
- npm 10.0.0+ (recommended)
- Docker (for containerized deployment)
- PostgreSQL database

### Node.js Version Management

This project requires **Node.js 22.19.0 or higher**. The project includes:

- **`.nvmrc`** file for automatic Node.js version switching with nvm
- **`package.json` engines** field to enforce version requirements
- **Preinstall script** that validates Node.js version

#### Using nvm (recommended):

```bash
# Install and use the correct Node.js version
nvm install
nvm use
```

#### Manual installation:

```bash
# Check your Node.js version
node --version

# Should be v22.19.0 or higher
```

### Installation

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables:

```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

3. Run database migrations:

```bash
npm run migrate:up
```

### Development

Start the development server:

```bash
npm run dev
```

### Production

Build and start the production server:

```bash
npm run build
npm start
```

## API Endpoints

- `GET /api/health` - Health check endpoint
- `GET /api/v1/workflows` - List workflows (coming soon)
- `POST /api/v1/workflows` - Create workflow (coming soon)
- `GET /api/v1/workflows/:id` - Get workflow by ID (coming soon)
- `PUT /api/v1/workflows/:id` - Update workflow (coming soon)
- `DELETE /api/v1/workflows/:id` - Delete workflow (coming soon)

## Project Structure

```
src/
├── api/                 # API routes and controllers
│   ├── v1/             # API version 1
│   │   └── workflows/  # Workflow endpoints
│   └── health.ts       # Health check endpoint
├── configs/            # Configuration files
├── constants/          # Application constants
├── helpers/            # Helper functions
├── middlewares/        # Express middlewares
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── workers/            # Background workers
```
