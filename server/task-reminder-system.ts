import { db } from './db';
import { crmTasks, users, notifications, organizationMembers } from '@shared/schema';
import { eq, and, isNull, isNotNull, lte, lt, ne } from 'drizzle-orm';
import { emailService } from './email-service';

// Map reminder options to milliseconds before due time
const REMINDER_OFFSETS: Record<string, number> = {
  'at_time': 0,
  '15_minutes': 15 * 60 * 1000,
  '30_minutes': 30 * 60 * 1000,
  '1_hour': 60 * 60 * 1000,
  '1_day': 24 * 60 * 60 * 1000,
  '1_week': 7 * 24 * 60 * 60 * 1000,
};

interface TaskWithAssignee {
  task: {
    id: number;
    organizationId: number;
    title: string;
    description: string | null;
    dueDate: Date | null;
    dueTime: string | null;
    reminder: string | null;
    reminderSentAt: Date | null;
    overdueNotifiedAt: Date | null;
    assignedTo: number | null;
    objectType: string | null;
    objectId: number | null;
    status: string;
  };
  assignee: {
    id: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
    timezone: string | null;
  } | null;
}

export class TaskReminderSystem {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Calculate the reminder time based on due date/time, reminder offset, and user timezone
   * The due date/time is interpreted in the user's timezone, then converted to UTC for comparison
   */
  private calculateReminderTime(dueDate: Date, dueTime: string | null, reminderOption: string, userTimezone: string): Date {
    // Get the date components from the stored due date (stored as UTC midnight)
    const year = dueDate.getUTCFullYear();
    const month = dueDate.getUTCMonth();
    const day = dueDate.getUTCDate();

    // Parse the time (or default to 9 AM)
    let hours = 9;
    let minutes = 0;
    if (dueTime) {
      [hours, minutes] = dueTime.split(':').map(Number);
    }

    // Create a date string that represents the local time in the user's timezone
    // Format: "YYYY-MM-DD HH:MM:SS" to be interpreted in the user's timezone
    const localDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;

    // Use Intl.DateTimeFormat to convert from user's timezone to UTC
    try {
      // Create a formatter for the user's timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: userTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });

      // Get the UTC offset for the user's timezone at the due time
      // We need to find what UTC time corresponds to the local time
      // This is a bit tricky - we'll use a binary search approach or calculate the offset
      const localDate = new Date(localDateStr + 'Z'); // Parse as UTC first

      // Get the offset by checking what time zone offset applies at this date
      const utcDate = new Date(localDateStr);
      const tzOffset = this.getTimezoneOffset(userTimezone, utcDate);

      // The due time in UTC is the local time minus the offset
      const dueTimeUtc = new Date(localDate.getTime() + tzOffset);

      // Subtract the reminder offset
      const reminderOffset = REMINDER_OFFSETS[reminderOption] || 0;
      return new Date(dueTimeUtc.getTime() - reminderOffset);
    } catch (e) {
      // Fallback if timezone is invalid - use server time
      console.warn(`[TaskReminder] Invalid timezone "${userTimezone}", falling back to UTC`);
      const dueDateTime = new Date(dueDate);
      if (dueTime) {
        const [h, m] = dueTime.split(':').map(Number);
        dueDateTime.setUTCHours(h, m, 0, 0);
      } else {
        dueDateTime.setUTCHours(9, 0, 0, 0);
      }
      const offset = REMINDER_OFFSETS[reminderOption] || 0;
      return new Date(dueDateTime.getTime() - offset);
    }
  }

  /**
   * Get the timezone offset in milliseconds for a given timezone at a specific date
   */
  private getTimezoneOffset(timezone: string, date: Date): number {
    // Create formatters for UTC and target timezone
    const utcFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const tzFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    // Get parts for both
    const utcParts = utcFormatter.formatToParts(date);
    const tzParts = tzFormatter.formatToParts(date);

    const getPart = (parts: Intl.DateTimeFormatPart[], type: string) => {
      const part = parts.find(p => p.type === type);
      return part ? parseInt(part.value, 10) : 0;
    };

    // Calculate the difference in minutes
    const utcMinutes = getPart(utcParts, 'hour') * 60 + getPart(utcParts, 'minute');
    const tzMinutes = getPart(tzParts, 'hour') * 60 + getPart(tzParts, 'minute');

    // Handle day boundary crossing
    const utcDay = getPart(utcParts, 'day');
    const tzDay = getPart(tzParts, 'day');

    let diffMinutes = tzMinutes - utcMinutes;
    if (tzDay > utcDay || (tzDay === 1 && utcDay > 27)) {
      diffMinutes += 24 * 60;
    } else if (tzDay < utcDay || (utcDay === 1 && tzDay > 27)) {
      diffMinutes -= 24 * 60;
    }

    return diffMinutes * 60 * 1000;
  }

  /**
   * Generate the reminder email HTML
   */
  private generateReminderEmail(task: TaskWithAssignee['task'], assigneeName: string): { subject: string; html: string } {
    const dueDateTime = task.dueDate ? new Date(task.dueDate) : null;
    let dueDateStr = 'No due date';

    if (dueDateTime) {
      dueDateStr = dueDateTime.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      if (task.dueTime) {
        const [hours, minutes] = task.dueTime.split(':').map(Number);
        const timeDate = new Date();
        timeDate.setHours(hours, minutes);
        dueDateStr += ` at ${timeDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })}`;
      }
    }

    const taskUrl = task.objectType && task.objectId
      ? `https://cimshare.com/${task.objectType}s/${task.objectId}`
      : 'https://cimshare.com/tasks';

    const subject = `Reminder: ${task.title}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Task Reminder</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="margin-top: 0;">Hi ${assigneeName},</p>

    <p>This is a reminder about your upcoming task:</p>

    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h2 style="margin: 0 0 10px 0; color: #111827; font-size: 18px;">${task.title}</h2>
      ${task.description ? `<p style="color: #6b7280; margin: 0 0 15px 0;">${task.description}</p>` : ''}
      <p style="margin: 0; color: #4b5563;">
        <strong>Due:</strong> ${dueDateStr}
      </p>
    </div>

    <a href="${taskUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">View Task</a>

    <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
      You're receiving this email because you have a task reminder set in Broker Vault.
    </p>
  </div>
</body>
</html>
    `.trim();

    return { subject, html };
  }

  /**
   * Process pending task reminders
   */
  async processReminders(): Promise<void> {
    if (this.isRunning) {
      return; // Prevent overlapping runs
    }

    this.isRunning = true;

    try {
      const now = new Date();

      // Get all tasks that:
      // 1. Have a reminder set (not 'none')
      // 2. Have a due date
      // 3. Haven't had their reminder sent yet
      // 4. Are not completed or cancelled
      // 5. Have an assignee
      const tasksWithReminders = await db
        .select({
          task: crmTasks,
          assignee: {
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            timezone: users.timezone,
          },
        })
        .from(crmTasks)
        .leftJoin(users, eq(users.id, crmTasks.assignedTo))
        .where(
          and(
            isNotNull(crmTasks.reminder),
            ne(crmTasks.reminder, 'none'),
            isNotNull(crmTasks.dueDate),
            isNull(crmTasks.reminderSentAt),
            isNotNull(crmTasks.assignedTo),
            ne(crmTasks.status, 'completed'),
            ne(crmTasks.status, 'cancelled')
          )
        );

      if (tasksWithReminders.length === 0) {
        return;
      }

      console.log(`[TaskReminder] Checking ${tasksWithReminders.length} tasks with reminders`);

      for (const { task, assignee } of tasksWithReminders) {
        if (!assignee || !task.dueDate || !task.reminder) {
          continue;
        }

        // Calculate when the reminder should be sent (using user's timezone)
        const userTimezone = assignee.timezone || 'America/New_York';
        const reminderTime = this.calculateReminderTime(
          task.dueDate,
          task.dueTime,
          task.reminder,
          userTimezone
        );

        // Check if it's time to send the reminder
        if (now >= reminderTime) {
          console.log(`[TaskReminder] Sending reminder for task "${task.title}" to ${assignee.email}`);

          const assigneeName = assignee.firstName && assignee.lastName
            ? `${assignee.firstName} ${assignee.lastName}`
            : assignee.email.split('@')[0];

          const { subject, html } = this.generateReminderEmail(task, assigneeName);

          const success = await emailService.sendCustomEmail({
            to: assignee.email,
            subject,
            html,
          });

          if (success) {
            // Mark reminder as sent
            await db
              .update(crmTasks)
              .set({ reminderSentAt: new Date() })
              .where(eq(crmTasks.id, task.id));

            console.log(`[TaskReminder] Successfully sent reminder for task "${task.title}"`);
          } else {
            console.error(`[TaskReminder] Failed to send reminder for task "${task.title}"`);
          }

          // Also create an in-app notification for the reminder
          try {
            await db.insert(notifications).values({
              organizationId: task.organizationId,
              userId: assignee.id,
              type: 'task_reminder',
              title: 'Task due soon',
              message: `Reminder: "${task.title}" is due soon`,
              entityType: task.objectType || 'task',
              entityId: task.objectId || task.id,
            });
          } catch (notifError) {
            console.error(`[TaskReminder] Failed to create in-app notification for task "${task.title}":`, notifError);
          }
        }
      }

      // Process overdue tasks
      await this.processOverdueTasks();
    } catch (error) {
      console.error('[TaskReminder] Error processing reminders:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process overdue tasks and send notifications
   */
  async processOverdueTasks(): Promise<void> {
    try {
      const now = new Date();

      // Get all tasks that:
      // 1. Have a due date in the past
      // 2. Haven't had an overdue notification sent
      // 3. Are not completed or cancelled
      // 4. Have an assignee
      const overdueTasks = await db
        .select({
          task: crmTasks,
          assignee: {
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
          },
        })
        .from(crmTasks)
        .leftJoin(users, eq(users.id, crmTasks.assignedTo))
        .where(
          and(
            isNotNull(crmTasks.dueDate),
            lt(crmTasks.dueDate, now),
            isNull(crmTasks.overdueNotifiedAt),
            isNotNull(crmTasks.assignedTo),
            ne(crmTasks.status, 'completed'),
            ne(crmTasks.status, 'cancelled')
          )
        );

      if (overdueTasks.length === 0) {
        return;
      }

      console.log(`[TaskReminder] Found ${overdueTasks.length} overdue tasks`);

      for (const { task, assignee } of overdueTasks) {
        if (!assignee) continue;

        // Create in-app notification for overdue task
        try {
          await db.insert(notifications).values({
            organizationId: task.organizationId,
            userId: assignee.id,
            type: 'task_overdue',
            title: 'Task overdue',
            message: `Task "${task.title}" is now overdue`,
            entityType: task.objectType || 'task',
            entityId: task.objectId || task.id,
          });

          // Mark overdue notification as sent
          await db
            .update(crmTasks)
            .set({ overdueNotifiedAt: new Date() })
            .where(eq(crmTasks.id, task.id));

          console.log(`[TaskReminder] Sent overdue notification for task "${task.title}"`);
        } catch (error) {
          console.error(`[TaskReminder] Failed to send overdue notification for task "${task.title}":`, error);
        }
      }
    } catch (error) {
      console.error('[TaskReminder] Error processing overdue tasks:', error);
    }
  }

  /**
   * Start the reminder system
   */
  start(): void {
    if (this.intervalId) {
      return; // Already running
    }

    console.log('[TaskReminder] Starting task reminder system...');

    // Process immediately on start
    this.processReminders();

    // Check every 5 minutes (lightweight query, no performance impact)
    this.intervalId = setInterval(() => {
      this.processReminders();
    }, 5 * 60 * 1000); // 5 minutes

    console.log('[TaskReminder] Task reminder system started (checking every 5 minutes)');
  }

  /**
   * Stop the reminder system
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[TaskReminder] Task reminder system stopped');
    }
  }
}

export const taskReminderSystem = new TaskReminderSystem();
