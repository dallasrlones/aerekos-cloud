# Aerekos Cloud Frontend

React Native (Expo) frontend for the aerekos-cloud conductor.

## Features

- ✅ Dark theme inspired by Assassin's Creed
- ✅ JWT-based authentication
- ✅ Login screen
- ✅ Dashboard with health check status
- ✅ Dockerized for easy deployment

## Quick Start

### Development

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env_example .env
# Edit .env with your API URL
```

3. Start the development server:
```bash
npm start
```

Then choose:
- `w` for web
- `i` for iOS simulator
- `a` for Android emulator

### Docker

Build and run with Docker Compose (from conductor root):
```bash
docker-compose up --build
```

The frontend will be available at `http://localhost:3001`

## Project Structure

```
app/
├── components/       # Reusable UI components
│   ├── Button/
│   └── Input/
├── contexts/         # React contexts (AuthContext)
├── screens/          # Screen components
│   ├── Login/
│   └── Dashboard/
├── services/         # API service layer
├── styles/          # Global styles and theme
└── utils/           # Utility functions (API client)
```

## Environment Variables

- `EXPO_PUBLIC_API_URL` - API base URL (default: `http://localhost:3000`)

## API Integration

The frontend connects to the conductor API:
- Authentication: `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`
- Health check: `/health`

## Theme

Dark theme with gold accents, inspired by Assassin's Creed loading screens.

## Docker

The frontend is dockerized using:
- Multi-stage build (Node.js builder + nginx server)
- Static file serving via nginx
- Health check endpoint
- Environment variable configuration
