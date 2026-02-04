/**
 * E-Sign Routes Index
 * Orchestrates all e-signature related routes
 */

import { Router } from 'express';
import { esignBrandingRoutes } from './esign-branding-routes';
import { esignTemplateRoutes } from './esign-template-routes';
import { esignPowerformRoutes } from './esign-powerform-routes';
import { esignEnvelopeRoutes } from './esign-envelope-routes';

const router = Router();

// Mount sub-routers
router.use(esignBrandingRoutes);
router.use(esignTemplateRoutes);
router.use(esignPowerformRoutes);
router.use(esignEnvelopeRoutes);

export { router as esignRoutes };
