import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:4001';

app.use(helmet());
const corsOptions = {
  origin: '*',
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS']
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(morgan('combined'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Increased for development
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', service: 'API Gateway' });
});

// Middleware to validate JWT and propagate SaaS Tenant & User headers to downstream
const authenticateAndPropagate = async (req: Request, res: Response, next: NextFunction) => {
  // Allow registration, login and demo request to bypass gateway verification
  const path = req.path;
  if (
    path.startsWith('/auth/login') ||
    path.startsWith('/auth/register') ||
    path.startsWith('/auth/super-admin/register') ||
    path.startsWith('/auth/request-demo') ||
    path.startsWith('/auth/upload') ||
    path.startsWith('/auth/forgot-password') ||
    path.startsWith('/auth/reset-password') ||
    path.startsWith('/api/auth/login') ||
    path.startsWith('/api/auth/register') ||
    path.startsWith('/api/auth/super-admin/register') ||
    path.startsWith('/api/auth/request-demo') ||
    path.startsWith('/api/auth/upload') ||
    path.startsWith('/api/auth/forgot-password') ||
    path.startsWith('/api/auth/reset-password') ||
    path.startsWith('/api/public') ||
    path.startsWith('/public')
  ) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid token format' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const response = await axios.post(`${AUTH_SERVICE_URL}/verify-token`, { token });
    if (response.data.valid && response.data.decoded) {
      const decoded = response.data.decoded;
      
      // Inject headers to request
      req.headers['x-user-id'] = String(decoded.id);
      req.headers['x-user-role'] = String(decoded.role || 'COMPANY_USER');
      
      if (decoded.isPlatformLevel) {
        // Platform Admin (Super Admin) has global access
        req.headers['x-is-platform-admin'] = 'true';
        // Default Super Admin to Tenant 1 if no specific tenant context is provided by the frontend
        req.headers['x-tenant-id'] = req.headers['x-tenant-id'] || '1';
      } else {
        req.headers['x-is-platform-admin'] = 'false';
        req.headers['x-tenant-id'] = String(decoded.tenantId);
      }

      next();
    } else {
      res.status(401).json({ error: 'Unauthorized', message: 'Token verification failed' });
    }
  } catch (error) {
    console.error('Auth verification error at Gateway:', error);
    res.status(401).json({ error: 'Unauthorized', message: 'Auth service unreachable or returned error' });
  }
};

app.use('/api', authenticateAndPropagate);

// Proxy configuration
const routes = [
  { path: '/api/auth', target: AUTH_SERVICE_URL },
  { path: '/api/users', target: process.env.USER_SERVICE_URL || 'http://localhost:4002' },
  { path: '/api/hotels', target: process.env.HOTEL_SERVICE_URL || 'http://localhost:4003' },
  { path: '/api/flights', target: process.env.FLIGHT_SERVICE_URL || 'http://localhost:4004' },
  { path: '/api/bookings', target: process.env.BOOKING_SERVICE_URL || 'http://localhost:4005' },
  { path: '/api/catalog', target: process.env.BOOKING_SERVICE_URL || 'http://localhost:4005' },
  { path: '/api/ledger', target: process.env.BOOKING_SERVICE_URL || 'http://localhost:4005' },
  { path: '/api/finance', target: process.env.BOOKING_SERVICE_URL || 'http://localhost:4005' },
  { path: '/api/public', target: process.env.BOOKING_SERVICE_URL || 'http://localhost:4005' },
  { path: '/api/agents', target: AUTH_SERVICE_URL },
  { path: '/api/vendors', target: AUTH_SERVICE_URL },
];

routes.forEach(route => {
  const proxyOptions: Options = {
    target: route.target,
    changeOrigin: true,
    pathRewrite: {
      [`^${route.path}`]: route.path === '/api/agents' ? '/agents' : route.path === '/api/vendors' ? '/vendors' : route.path === '/api/catalog' ? '/catalog' : route.path === '/api/ledger' ? '/ledger' : route.path === '/api/finance' ? '/finance' : route.path === '/api/public' ? '/public' : '',
    },
    onProxyReq: (proxyReq, req, res) => {
      // Forward the injected SaaS headers downstream explicitly
      if (req.headers['x-user-id']) {
        proxyReq.setHeader('X-User-Id', req.headers['x-user-id'] as string);
      }
      if (req.headers['x-user-role']) {
        proxyReq.setHeader('X-User-Role', req.headers['x-user-role'] as string);
      }
      if (req.headers['x-tenant-id']) {
        proxyReq.setHeader('X-Tenant-Id', req.headers['x-tenant-id'] as string);
      }
      if (req.headers['x-is-platform-admin']) {
        proxyReq.setHeader('X-Is-Platform-Admin', req.headers['x-is-platform-admin'] as string);
      }
    },
    onError: (err, req, res) => {
      console.error(`Error proxying to ${route.target}:`, err);
      // @ts-ignore
      res.status(502).json({ error: 'Bad Gateway', message: 'Downstream service is unreachable' });
    }
  };

  app.use(route.path, createProxyMiddleware(proxyOptions));
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', message: 'Route does not exist' });
});

app.listen(PORT, () => {
  console.log(`API Gateway (SaaS enabled) is running on port ${PORT}`);
});
