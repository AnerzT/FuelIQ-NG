// server/services/whatsappService.ts

// Configuration
const WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED === "true";
const WHATSAPP_PROVIDER = process.env.WHATSAPP_PROVIDER || "console"; // console, twilio, etc.
const WHATSAPP_FROM = process.env.WHATSAPP_FROM || "FuelIQ-NG";

// Mock WhatsApp service for development
class MockWhatsAppService {
  async send(phone: string, message: string): Promise<boolean> {
    console.log(`💬 [MOCK WHATSAPP] To: ${phone}`);
    console.log(`💬 [MOCK WHATSAPP] Message: ${message}`);
    console.log(`💬 [MOCK WHATSAPP] Length: ${message.length} characters`);
    return true;
  }
}

// Twilio WhatsApp service with safe dynamic import
class TwilioWhatsAppService {
  private client: any = null;
  private fromNumber: string;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Twilio WhatsApp numbers are in format: whatsapp:+14155238886
    this.fromNumber = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER || ''}`;
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      console.warn("⚠️ Twilio credentials not configured, falling back to mock WhatsApp");
      this.initialized = false;
      return;
    }

    try {
      // Safe dynamic import with try-catch
      const twilioModule = await import('twilio').catch(() => null);
      if (!twilioModule) {
        console.warn("⚠️ Twilio package not installed, falling back to mock WhatsApp");
        this.initialized = false;
        return;
      }
      
      const twilio = twilioModule.default || twilioModule;
      this.client = twilio(accountSid, authToken);
      this.initialized = true;
      console.log("✅ Twilio WhatsApp service initialized");
    } catch (err) {
      console.warn("⚠️ Failed to initialize Twilio WhatsApp, falling back to mock");
      this.initialized = false;
    }
  }

  async send(phone: string, message: string): Promise<boolean> {
    // Wait for initialization
    if (this.initPromise) {
      await this.initPromise;
    }

    if (!this.initialized || !this.client) {
      // Fallback to mock
      const mockService = new MockWhatsAppService();
      return mockService.send(phone, message);
    }

    try {
      // Format phone number for WhatsApp
      const formattedPhone = this.formatPhoneNumber(phone);
      
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedPhone,
      });

      console.log(`✅ WhatsApp message sent to ${formattedPhone}, SID: ${result.sid}`);
      return true;
    } catch (error) {
      console.error("❌ Failed to send WhatsApp message via Twilio:", error);
      return false;
    }
  }

  private formatPhoneNumber(phone: string): string {
    // Remove any non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Format for WhatsApp: whatsapp:+234XXXXXXXXXX
    if (digits.startsWith('0')) {
      return `whatsapp:+234${digits.substring(1)}`;
    }
    
    if (!digits.startsWith('234') && digits.length === 11) {
      return `whatsapp:+234${digits.substring(1)}`;
    }
    
    if (digits.startsWith('234')) {
      return `whatsapp:+${digits}`;
    }
    
    if (!phone.startsWith('+')) {
      return `whatsapp:+${digits}`;
    }
    
    return `whatsapp:${phone}`;
  }
}

// Console WhatsApp service (for development)
class ConsoleWhatsAppService {
  async send(phone: string, message: string): Promise<boolean> {
    console.log(`💬 [CONSOLE WHATSAPP] To: ${phone}`);
    console.log(`💬 [CONSOLE WHATSAPP] Message: ${message}`);
    console.log(`💬 [CONSOLE WHATSAPP] Length: ${message.length} characters`);
    return true;
  }
}

// Factory to get the appropriate WhatsApp service
function getWhatsAppService() {
  if (!WHATSAPP_ENABLED) {
    return new ConsoleWhatsAppService();
  }

  switch (WHATSAPP_PROVIDER) {
    case 'twilio':
      return new TwilioWhatsAppService();
    case 'console':
    default:
      return new ConsoleWhatsAppService();
  }
}

// Create the WhatsApp service instance
const whatsAppService = getWhatsAppService();

/**
 * Send a WhatsApp message
 * @param phone Recipient phone number
 * @param message Message content
 * @returns Promise<boolean> indicating success
 */
export async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  try {
    if (!phone) {
      console.error("❌ Cannot send WhatsApp message: No phone number provided");
      return false;
    }

    if (!message) {
      console.error("❌ Cannot send WhatsApp message: No message provided");
      return false;
    }

    // Log the attempt
    console.log(`📤 Attempting to send WhatsApp message to ${phone}`);
    
    // Send via the service
    const result = await whatsAppService.send(phone, message);
    
    if (result) {
      console.log(`✅ WhatsApp message sent successfully to ${phone}`);
    } else {
      console.error(`❌ Failed to send WhatsApp message to ${phone}`);
    }
    
    return result;
  } catch (error) {
    console.error("❌ Error in sendWhatsAppMessage function:", error);
    return false;
  }
}

/**
 * Send bulk WhatsApp messages
 * @param recipients Array of phone numbers and messages
 * @returns Promise with results
 */
export async function sendBulkWhatsAppMessages(
  recipients: Array<{ phone: string; message: string }>
): Promise<Array<{ phone: string; success: boolean; error?: string }>> {
  const results = [];

  for (const recipient of recipients) {
    try {
      const success = await sendWhatsAppMessage(recipient.phone, recipient.message);
      results.push({
        phone: recipient.phone,
        success,
        error: success ? undefined : "Failed to send",
      });
      
      // Small delay to avoid rate limiting
      if (recipients.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      results.push({
        phone: recipient.phone,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}

/**
 * Send WhatsApp message to multiple users with the same message
 * @param phones Array of phone numbers
 * @param message Message to send
 * @returns Promise with results
 */
export async function sendWhatsAppToMany(phones: string[], message: string): Promise<{
  total: number;
  successful: number;
  failed: number;
  results: Array<{ phone: string; success: boolean }>;
}> {
  const results = [];
  let successful = 0;
  let failed = 0;

  for (const phone of phones) {
    try {
      const success = await sendWhatsAppMessage(phone, message);
      results.push({ phone, success });
      
      if (success) {
        successful++;
      } else {
        failed++;
      }
      
      // Small delay to avoid rate limiting
      if (phones.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      results.push({ phone, success: false });
      failed++;
    }
  }

  return {
    total: phones.length,
    successful,
    failed,
    results,
  };
}

/**
 * Verify if a phone number is valid for WhatsApp
 * @param phone Phone number to verify
 * @returns boolean indicating if valid
 */
export function isValidWhatsAppNumber(phone: string): boolean {
  // Remove any non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Check if it's a Nigerian number (11 digits starting with 0, or 13 digits starting with 234)
  const isValidNigerian = (digits.length === 11 && digits.startsWith('0')) ||
                          (digits.length === 13 && digits.startsWith('234'));
  
  // Basic international format check
  const isValidInternational = digits.length >= 10 && digits.length <= 15;
  
  return isValidNigerian || isValidInternational;
}

/**
 * Get WhatsApp service status
 * @returns Status object
 */
export function getWhatsAppStatus(): {
  enabled: boolean;
  provider: string;
  configured: boolean;
} {
  const provider = WHATSAPP_PROVIDER;
  let configured = true;

  if (provider === 'twilio') {
    configured = !!(process.env.TWILIO_ACCOUNT_SID && 
                    process.env.TWILIO_AUTH_TOKEN && 
                    process.env.TWILIO_WHATSAPP_NUMBER);
  }

  return {
    enabled: WHATSAPP_ENABLED,
    provider,
    configured,
  };
}

/**
 * Format a message with WhatsApp-specific formatting
 * @param message Raw message
 * @returns Formatted message
 */
export function formatWhatsAppMessage(message: string): string {
  // WhatsApp supports basic markdown
  let formatted = message;
  
  // Bold: *text*
  // Italic: _text_
  // Strikethrough: ~text~
  // Code: ```text```
  
  return formatted;
}

// For backward compatibility, also export as sendWhatsApp (but marked as deprecated)
/**
 * @deprecated Use sendWhatsAppMessage instead
 */
export const sendWhatsApp = sendWhatsAppMessage;

export default {
  sendWhatsAppMessage,
  sendBulkWhatsAppMessages,
  sendWhatsAppToMany,
  isValidWhatsAppNumber,
  getWhatsAppStatus,
  formatWhatsAppMessage,
};
