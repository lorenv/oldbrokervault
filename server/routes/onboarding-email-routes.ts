import { Router } from 'express';
import { onboardingEmailService } from '../services/onboarding-email-service';

const router = Router();

/**
 * Test endpoint to send all onboarding emails immediately
 * Only available in development mode
 */
router.post('/test-sequence', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Test endpoint not available in production' });
  }

  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { email, userName } = req.body;

    // Use provided email or current user's email
    const testEmail = email || req.user.email;
    const testUserName = userName || req.user.name || req.user.email.split('@')[0];

    await onboardingEmailService.sendTestSequence({
      email: testEmail,
      userName: testUserName,
      userId: req.user.id
    });

    res.json({
      success: true,
      message: `Test onboarding sequence sent to ${testEmail}`,
      emails: [
        'Welcome Email (sent immediately)',
        'Getting Started Email (sent after 1 second)',
        'Pain/Solution Email (sent after 2 seconds)',
        'Testimonial Email (sent after 3 seconds)'
      ]
    });
  } catch (error) {
    console.error('Error sending test sequence:', error);
    res.status(500).json({
      error: 'Failed to send test sequence',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Cancel all scheduled onboarding emails for a user
 */
router.post('/cancel', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    onboardingEmailService.cancelScheduledEmails(req.user.id);

    res.json({
      success: true,
      message: 'All scheduled onboarding emails have been cancelled'
    });
  } catch (error) {
    console.error('Error cancelling emails:', error);
    res.status(500).json({
      error: 'Failed to cancel scheduled emails',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get the current onboarding email configuration
 */
router.get('/config', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  res.json({
    sequence: [
      {
        name: 'Welcome Email',
        delay: 'Immediate',
        subject: 'Welcome to CIM Share - Your AI-Powered CIM Creation Tool'
      },
      {
        name: 'Getting Started',
        delay: '1 hour after registration',
        subject: 'Quick Start: Create Your First CIM in 3 Simple Steps'
      },
      {
        name: 'Pain/Solution',
        delay: '1 day after registration',
        subject: 'Stop Wasting Hours on CIM Creation - There\'s a Better Way'
      },
      {
        name: 'Testimonial',
        delay: '2 days after registration',
        subject: 'How Sarah Saved 50+ Hours Last Month with CIM Share'
      }
    ]
  });
});

export default router;