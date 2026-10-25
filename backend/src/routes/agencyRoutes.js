import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as agencyController from '../controllers/agencyController.js';

const router = Router();

router.use(requireAuth);

// Agency Context & Portal Overview
router.get('/context', agencyController.getAgencyContext);
router.get('/portal', agencyController.getAgencyContext); // Alias for frontend portal view

// Client Workspaces & Delegated Access
router.get('/clients', agencyController.getClients);
router.get('/clients/:id', agencyController.getClientDetails);
router.post('/clients/invite', agencyController.inviteClient);
router.post('/invite-client', agencyController.inviteClient);
router.delete('/clients/:relationId', agencyController.revokeClientAccess);
router.post('/clients/:relationId/revoke', agencyController.revokeClientAccess);

// Agency Staff & Team Members
router.get('/staff', agencyController.getStaff);
router.post('/staff/invite', agencyController.inviteStaff);
router.delete('/staff/:membershipId', agencyController.removeStaff);

// White-Label Branding & Custom Domains
router.put('/branding', agencyController.updateBranding);
router.patch('/branding', agencyController.updateBranding); // Alias for frontend compatibility
router.post('/domains/verify', agencyController.verifyDomain);
router.post('/domain/verify-dns', agencyController.verifyDomain); // Alias
router.post('/domain/simulate-tls', agencyController.verifyDomain); // Alias

export default router;
