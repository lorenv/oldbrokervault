/**
 * E-Sign Routes
 *
 * This file re-exports the modular e-sign routes from the esign/ directory.
 * The routes have been split into focused modules:
 *
 * - esign-branding-routes.ts: Branding settings (logo, colors)
 * - esign-template-routes.ts: Template CRUD, recent recipients
 * - esign-powerform-routes.ts: Public form functionality
 * - esign-envelope-routes.ts: Envelopes, signing workflow, completion
 * - esign-utils.ts: Shared utilities and helpers
 */

export { esignRoutes } from './esign/index';
