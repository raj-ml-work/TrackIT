/**
 * Authorization Middleware for Fastify
 *
 * Uses the permission registry to authorize requests.
 * Apply as a preHandler hook on any route:
 *
 *   app.post('/assets', { preHandler: authorize('assets', 'create') }, handler);
 *
 * The middleware:
 * 1. Extracts the JWT from the Authorization header
 * 2. Resolves the user from the database
 * 3. Checks the permission registry for (resource, action, user.role)
 * 4. Sets request.currentUser on success, or returns 401/403
 */

import { verifyAccessToken } from '../auth.js';
import { hasPermission, resolveRole } from '../permissions.js';

/**
 * Create a Fastify preHandler that checks if the requesting user
 * has permission for the given resource and action.
 *
 * @param {string} resource - e.g. 'assets', 'employees.salary'
 * @param {string} action   - e.g. 'view', 'create', 'edit', 'delete'
 * @param {object} [options]
 * @param {Function} [options.getProvider] - Provider getter (injected at route registration)
 */
export const createAuthorize = (getProvider) => {
  return (resource, action) => {
    return async (request, reply) => {
      // 1. Extract token
      const authHeader = request.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

      if (!token) {
        return reply.code(401).send({ error: 'Authorization token missing.' });
      }

      // 2. Verify token
      const payload = verifyAccessToken(token);
      if (!payload) {
        return reply.code(401).send({ error: 'Authorization token invalid or expired.' });
      }

      // 3. Resolve user from DB
      const provider = getProvider();
      const user = await provider.getUserById(payload.sub);

      if (!user) {
        return reply.code(401).send({ error: 'User not found.' });
      }

      if (user.status === 'Inactive') {
        return reply.code(403).send({ error: 'Account is inactive. Please contact your administrator.' });
      }

      // 4. Check permission
      const effectiveRole = resolveRole(user.role);
      if (!hasPermission(effectiveRole, resource, action)) {
        return reply.code(403).send({
          error: `Insufficient permissions: ${effectiveRole} role cannot ${action} ${resource}.`
        });
      }

      // 5. Attach user to request for downstream handlers
      request.currentUser = user;
    };
  };
};
