import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  user?: any;
}

/**
 * JWT Authentication Middleware
 * Validates the Authorization Bearer token.
 * This protects all /api/* routes (except auth login/register) from unauthorized access.
 */
export function requireApiKey(req: AuthenticatedRequest, res: Response, next: NextFunction): void | Response {
  // Allow login and register routes to bypass auth
  if (req.path.startsWith('/auth/login') || req.path.startsWith('/auth/register')) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.API_SECRET || process.env.JWT_SECRET || 'fallback_secret');
    req.user = decoded; // Attach user payload { id: ... } to request
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Token is invalid or expired.' });
  }
}
