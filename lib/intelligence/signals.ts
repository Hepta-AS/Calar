/**
 * Signal Service
 * Manages automated notifications when leads cross score thresholds.
 * Supports multiple dispatch channels (console, email).
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { signals, leads } from "@/lib/db/schema";
import {
  Signal,
  SignalPayload,
  SignalType,
  SignalDispatchResult,
  ThresholdConfig,
  DEFAULT_THRESHOLD_CONFIG,
} from "./types";

// =============================================================================
// DISPATCHER INTERFACE
// =============================================================================

interface ISignalDispatcher {
  readonly channel: string;
  isConfigured(): boolean;
  dispatch(signal: Signal): Promise<SignalDispatchResult>;
}

// =============================================================================
// CONSOLE DISPATCHER (always available)
// =============================================================================

class ConsoleDispatcher implements ISignalDispatcher {
  readonly channel = "console";

  isConfigured(): boolean {
    return true; // Always available
  }

  async dispatch(signal: Signal): Promise<SignalDispatchResult> {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔔 SIGNAL TRIGGERED");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Type: ${signal.type}`);
    console.log(`Lead ID: ${signal.leadId}`);
    console.log(`Email: ${signal.payload.leadEmail}`);
    if (signal.payload.leadName) {
      console.log(`Name: ${signal.payload.leadName}`);
    }
    console.log(`Score: ${signal.payload.score}`);
    console.log(`Reason: ${signal.payload.triggerReason}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return {
      success: true,
      channel: this.channel,
    };
  }
}

// =============================================================================
// RESEND EMAIL DISPATCHER (when API key is available)
// =============================================================================

class ResendDispatcher implements ISignalDispatcher {
  readonly channel = "email";
  private readonly apiKey: string | undefined;
  private readonly fromEmail: string;
  private readonly toEmail: string;

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY;
    this.fromEmail = process.env.RESEND_FROM_EMAIL ?? "signals@example.com";
    this.toEmail = process.env.RESEND_TO_EMAIL ?? "";
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.toEmail);
  }

  async dispatch(signal: Signal): Promise<SignalDispatchResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        channel: this.channel,
        error: "Resend not configured",
      };
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: this.toEmail,
          subject: `🔔 High-Score Lead: ${signal.payload.leadEmail} (Score: ${signal.payload.score})`,
          html: this.buildEmailHtml(signal),
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          channel: this.channel,
          error: `Resend API error: ${response.status} - ${JSON.stringify(errorData)}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        channel: this.channel,
        externalId: data.id,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        channel: this.channel,
        error: `Resend request failed: ${message}`,
      };
    }
  }

  private buildEmailHtml(signal: Signal): string {
    const { payload } = signal;
    const scoreColor = payload.score >= 75 ? "#22c55e" : payload.score >= 50 ? "#eab308" : "#ef4444";

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>High-Score Lead Alert</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #f9fafb;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <div style="background: #1f2937; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">🔔 High-Score Lead Alert</h1>
            </div>
            <div style="padding: 30px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="display: inline-block; background: ${scoreColor}; color: white; font-size: 36px; font-weight: bold; padding: 15px 30px; border-radius: 50px;">
                  ${payload.score}
                </div>
                <p style="color: #6b7280; margin-top: 10px;">Lead Score</p>
              </div>

              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Email</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${payload.leadEmail}</td>
                </tr>
                ${payload.leadName ? `
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Name</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${payload.leadName}</td>
                </tr>
                ` : ""}
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Trigger</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">${payload.triggerReason}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #6b7280;">Signal Type</td>
                  <td style="padding: 10px 0;">${signal.type}</td>
                </tr>
              </table>

              <div style="margin-top: 30px; text-align: center;">
                <p style="color: #6b7280; font-size: 14px;">
                  This lead has exceeded the score threshold and may be ready for follow-up.
                </p>
              </div>
            </div>
            <div style="background: #f9fafb; padding: 15px; text-align: center; color: #9ca3af; font-size: 12px;">
              Sent by Calar Intelligence
            </div>
          </div>
        </body>
      </html>
    `;
  }
}

// =============================================================================
// SIGNAL SERVICE
// =============================================================================

class SignalService {
  private dispatchers: ISignalDispatcher[] = [];
  private thresholdConfig: ThresholdConfig;

  constructor(config?: Partial<ThresholdConfig>) {
    this.thresholdConfig = { ...DEFAULT_THRESHOLD_CONFIG, ...config };

    // Register dispatchers
    this.dispatchers.push(new ConsoleDispatcher());
    this.dispatchers.push(new ResendDispatcher());
  }

  /**
   * Checks if a signal should be triggered for the given score.
   */
  shouldTriggerScoreThreshold(score: number): boolean {
    return this.thresholdConfig.enabled && score > this.thresholdConfig.scoreThreshold;
  }

  /**
   * Checks if a page path is considered high-intent.
   */
  isHighIntentPage(path: string): boolean {
    const normalizedPath = path.toLowerCase().split("?")[0];
    return this.thresholdConfig.highIntentPages.some(
      (p) => normalizedPath === p || normalizedPath.startsWith(p + "/")
    );
  }

  /**
   * Creates and persists a new signal.
   */
  async createSignal(
    tenantId: string,
    leadId: string,
    type: SignalType,
    payload: SignalPayload
  ): Promise<string> {
    const [signal] = await db
      .insert(signals)
      .values({
        tenantId,
        leadId,
        type,
        payload,
        status: "pending",
      })
      .returning({ id: signals.id });

    return signal.id;
  }

  /**
   * Dispatches a signal to all configured notification channels.
   */
  async dispatchSignal(signalId: string): Promise<SignalDispatchResult[]> {
    // Fetch the signal
    const [signalRecord] = await db
      .select()
      .from(signals)
      .where(eq(signals.id, signalId))
      .limit(1);

    if (!signalRecord) {
      throw new Error(`Signal not found: ${signalId}`);
    }

    // Mark as processing
    await db
      .update(signals)
      .set({ status: "processing" })
      .where(eq(signals.id, signalId));

    const signal: Signal = {
      id: signalRecord.id,
      leadId: signalRecord.leadId,
      type: signalRecord.type as SignalType,
      payload: signalRecord.payload!,
    };

    // Dispatch to all configured channels
    const results: SignalDispatchResult[] = [];

    for (const dispatcher of this.dispatchers) {
      if (!dispatcher.isConfigured()) {
        continue;
      }

      const result = await dispatcher.dispatch(signal);
      results.push(result);
    }

    // Update signal status based on results
    const anySuccess = results.some((r) => r.success);
    if (anySuccess) {
      await db
        .update(signals)
        .set({
          status: "delivered",
          deliveredAt: new Date(),
        })
        .where(eq(signals.id, signalId));
    } else if (results.length > 0) {
      const errors = results.map((r) => r.error).filter(Boolean).join("; ");
      await db
        .update(signals)
        .set({
          status: "failed",
          error: errors,
        })
        .where(eq(signals.id, signalId));
    }

    return results;
  }

  /**
   * Triggers a score threshold signal for a lead.
   * Creates the signal and dispatches immediately.
   */
  async triggerScoreThreshold(
    tenantId: string,
    leadId: string,
    score: number
  ): Promise<{ signalId: string; results: SignalDispatchResult[] }> {
    // Fetch lead info for the payload
    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (!lead) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    const payload: SignalPayload = {
      leadEmail: lead.email,
      leadName: lead.name ?? undefined,
      score,
      triggerReason: `Score exceeded threshold (${score} > ${this.thresholdConfig.scoreThreshold})`,
    };

    const signalId = await this.createSignal(tenantId, leadId, "score_threshold", payload);
    const results = await this.dispatchSignal(signalId);

    return { signalId, results };
  }

  /**
   * Returns the current threshold configuration.
   */
  getThresholdConfig(): ThresholdConfig {
    return { ...this.thresholdConfig };
  }
}

// Singleton instance
let signalServiceInstance: SignalService | null = null;

export function getSignalService(config?: Partial<ThresholdConfig>): SignalService {
  if (!signalServiceInstance) {
    signalServiceInstance = new SignalService(config);
  }
  return signalServiceInstance;
}

/**
 * Helper function to check and trigger signals for a lead.
 */
export async function checkAndTriggerSignals(
  tenantId: string,
  leadId: string,
  score: number,
  previousScore: number
): Promise<{ signalTriggered: boolean; signalId: string | null }> {
  const service = getSignalService();

  // Only trigger if score newly exceeds threshold
  const shouldTrigger = service.shouldTriggerScoreThreshold(score);
  const wasAboveThreshold = service.shouldTriggerScoreThreshold(previousScore);

  if (shouldTrigger && !wasAboveThreshold) {
    const { signalId } = await service.triggerScoreThreshold(tenantId, leadId, score);
    return { signalTriggered: true, signalId };
  }

  return { signalTriggered: false, signalId: null };
}
