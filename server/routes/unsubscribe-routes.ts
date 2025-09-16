import { Router } from 'express';
import { unsubscribeService } from '../services/unsubscribe-service';

const router = Router();

/**
 * Validate an unsubscribe token
 * GET /api/unsubscribe/validate?token=...
 */
router.get('/validate', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        error: 'Invalid or missing token',
        valid: false
      });
    }

    const validation = await unsubscribeService.validateToken(token);

    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid or expired token',
        valid: false
      });
    }

    res.json({
      valid: true,
      email: validation.email,
      preferences: await unsubscribeService.getEmailPreferences(validation.userId!)
    });
  } catch (error) {
    console.error('Error validating unsubscribe token:', error);
    res.status(500).json({
      error: 'Failed to validate token',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Unsubscribe from emails
 * POST /api/unsubscribe
 */
router.post('/', async (req, res) => {
  try {
    const { token, emailTypes } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        error: 'Invalid or missing token'
      });
    }

    // Validate token first
    const validation = await unsubscribeService.validateToken(token);

    if (!validation.valid || !validation.userId) {
      return res.status(400).json({
        error: 'Invalid or expired token'
      });
    }

    // Unsubscribe from specified email types (or defaults)
    const success = await unsubscribeService.unsubscribe(token, emailTypes);

    if (!success) {
      return res.status(400).json({
        error: 'Failed to unsubscribe'
      });
    }


    res.json({
      success: true,
      message: 'Successfully unsubscribed from emails',
      email: validation.email
    });
  } catch (error) {
    console.error('Error unsubscribing:', error);
    res.status(500).json({
      error: 'Failed to unsubscribe',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get email preferences for authenticated user
 * GET /api/unsubscribe/preferences
 */
router.get('/preferences', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const preferences = await unsubscribeService.getEmailPreferences(req.user.id);

    if (!preferences) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      preferences,
      email: req.user.email
    });
  } catch (error) {
    console.error('Error getting email preferences:', error);
    res.status(500).json({
      error: 'Failed to get email preferences',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update email preferences for authenticated user
 * PUT /api/unsubscribe/preferences
 */
router.put('/preferences', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { preferences } = req.body;

    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'Invalid preferences' });
    }

    const success = await unsubscribeService.updateEmailPreferences(req.user.id, preferences);

    if (!success) {
      return res.status(404).json({ error: 'User not found' });
    }


    res.json({
      success: true,
      message: 'Email preferences updated successfully',
      preferences: await unsubscribeService.getEmailPreferences(req.user.id)
    });
  } catch (error) {
    console.error('Error updating email preferences:', error);
    res.status(500).json({
      error: 'Failed to update email preferences',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;