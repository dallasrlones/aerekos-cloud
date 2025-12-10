# Testing Guide

## Quick Start

### Option 1: Docker Compose (Recommended)

1. **Start both backend and frontend:**
```bash
cd /Users/dallaslones/work/aerekos-cloud/conductor
docker-compose up --build
```

2. **Access the application:**
   - Frontend: http://localhost:3001
   - Backend API: http://localhost:3000
   - Health Check: http://localhost:3000/health

3. **Default login credentials:**
   - Username: `admin`
   - Password: `admin123` (change this in production!)

### Option 2: Development Mode

#### Backend Only:
```bash
cd /Users/dallaslones/work/aerekos-cloud/conductor
npm install
npm start
```

#### Frontend Only:
```bash
cd /Users/dallaslones/work/aerekos-cloud/conductor/app
npm install
npm start
# Then press 'w' for web, 'i' for iOS, or 'a' for Android
```

#### Both (Separate Terminals):
1. Terminal 1 - Backend:
```bash
cd /Users/dallaslones/work/aerekos-cloud/conductor
npm start
```

2. Terminal 2 - Frontend:
```bash
cd /Users/dallaslones/work/aerekos-cloud/conductor/app
npm start
# Press 'w' for web
```

## Environment Setup

### Backend (.env)
Create `conductor/.env` from `.env_example`:
```bash
cd /Users/dallaslones/work/aerekos-cloud/conductor
cp .env_example .env
# Edit .env with your settings
```

### Frontend (.env)
Create `conductor/app/.env` from `.env_example`:
```bash
cd /Users/dallaslones/work/aerekos-cloud/conductor/app
cp .env_example .env
# For local development, use: EXPO_PUBLIC_API_URL=http://localhost:3000
# For Docker, use: EXPO_PUBLIC_API_URL=http://conductor:3000
```

## Testing the Application

### 1. Health Check
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "conductor",
  "database": "connected",
  "timestamp": "..."
}
```

### 2. Login via API
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### 3. Frontend Testing
1. Open http://localhost:3001 (or http://localhost:19006 for dev mode)
2. You should see the login screen with dark theme
3. Enter credentials:
   - Username: `admin`
   - Password: `admin123`
4. After login, you should see the dashboard with:
   - Welcome message with username
   - System health status
   - Empty states for workers and services

## Troubleshooting

### Backend Issues
- **Port already in use**: Change `PORT` in `.env`
- **Database errors**: Check `data/` directory permissions
- **Tests failing**: Run `npm test` to see specific errors

### Frontend Issues
- **API connection errors**: Check `EXPO_PUBLIC_API_URL` in `.env`
- **Build errors**: Make sure all dependencies are installed (`npm install`)
- **Docker build fails**: Check Dockerfile and ensure Expo CLI is available

### Docker Issues
- **Services won't start**: Check logs with `docker-compose logs`
- **Frontend can't reach backend**: Ensure both are on same network (`aerekos-cloud-network`)
- **Port conflicts**: Change ports in `docker-compose.yml`

## Running Tests

### Backend Tests
```bash
cd /Users/dallaslones/work/aerekos-cloud/conductor
npm test
```

All 48 tests should pass ✅

### Frontend Tests
(Not yet implemented - coming soon!)

## Next Steps

After successful testing:
1. ✅ Backend API working
2. ✅ Frontend login working
3. ✅ Dashboard displaying
4. ⏭️ Implement worker registration
5. ⏭️ Add service management
6. ⏭️ Add more dashboard features
