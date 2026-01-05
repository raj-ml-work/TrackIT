import jwt from 'jsonwebtoken';
import { config } from './config.js';

export const signAccessToken = (user) => {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role
    },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessTtl }
  );
};

export const signRefreshToken = (user) => {
  return jwt.sign(
    {
      sub: user.id
    },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshTtl }
  );
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, config.jwt.accessSecret);
};

export const verifyRefreshToken = (token) => {
  return jwt.verify(token, config.jwt.refreshSecret);
};

export const getAccessExpiry = () => {
  return new Date(Date.now() + config.jwt.accessTtlMs).toISOString();
};

export const setRefreshCookie = (reply, refreshToken) => {
  reply.setCookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'lax',
    path: '/auth/refresh',
    maxAge: Math.floor(config.jwt.refreshTtlMs / 1000)
  });
};

export const clearRefreshCookie = (reply) => {
  reply.clearCookie('refresh_token', {
    path: '/auth/refresh'
  });
};
