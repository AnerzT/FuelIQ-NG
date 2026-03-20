// server/services/smsService.ts

// Configuration
const SMS_ENABLED = process.env.SMS_ENABLED === "true";
const SMS_PROVIDER = process.env.SMS_PROVIDER || "console"; // console, twilio, africaistalking, etc.
const SMS_FROM = process.env.SMS_FROM || "FuelIQ-NG";

// Mock SMS service for development
class MockSmsService {
  async send(phone: string, message: string): Promise<boolean> {
    console.log(`📱 [MOCK SMS] To: ${phone}`);
    console.log(`📱 [MOCK SMS] Message: ${message}`);
    console.log(`📱 [MOCK SMS] Length: ${message.length} characters`);
    return true;
  }
}

// Twilio SMS service
class TwilioSmsService {
  private client: any;
  private fromNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || SMS_FROM;

    if (!accountSid || !authToken) {
      console.warn("⚠️ Twilio credentials not configured, falling back to mock SMS");
      this.client = null;
    } else {
      try {
        // Dynamic import to avoid requiring twilio in all environments
        import('twilio').then(twilio => {
          this.client = twilio(accountSid, authToken);
          console.log("✅ Twilio SMS service initialized");
        }).catch(err => {
          console.error("❌ Failed to load twilio package:", err);
          this.client = null;
        });
      } catch (err) {
        console.error("❌ Failed to initialize Twilio:", err);
        this.client = null;
      }
    }
  }

  async send(phone: string, message: string): Promise<boolean> {
    if (!this.client) {
      // Fallback to mock
      const mockService = new MockSmsService();
      return mockService.send(phone, message);
    }

    try {
      // Format phone number (ensure it has country code)
      const formattedPhone = this.formatPhoneNumber(phone);
      
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedPhone,
      });

      console.log(`✅ SMS sent to ${formattedPhone}, SID: ${result.sid}`);
      return true;
    } catch (error) {
      console.error("❌ Failed to send SMS via Twilio:", error);
      return false;
    }
  }

  private formatPhoneNumber(phone: string): string {
    // Remove any non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Nigerian numbers: if it starts with 0, replace with +234
    if (digits.startsWith('0')) {
      return '+234' + digits.substring(1);
    }
    
    // If it doesn't have +, add it
    if (!phone.startsWith('+')) {
      return '+' + digits;
    }
    
    return phone;
  }
}

// Africa's Talking SMS service
class AfricaIsTalkingSmsService {
  private username: string;
  private apiKey: string;
  private from: string;

  constructor() {
    this.username = process.env.AFRICASTALKING_USERNAME || '';
    this.apiKey = process.env.AFRICASTALKING_API_KEY || '';
    this.from = process.env.SMS_FROM || 'FuelIQ-NG';

    if (!this.username || !this.apiKey) {
      console.warn("⚠️ Africa's Talking credentials not configured, falling back to mock SMS");
    }
  }

  async send(phone: string, message: string): Promise<boolean> {
    if (!this.username || !this.apiKey) {
      // Fallback to mock
      const mockService = new MockSmsService();
      return mockService.send(phone, message);
    }

    try {
      // Format phone number for Africa's Talking
      const formattedPhone = this.formatPhoneNumber(phone);
      
      // Dynamic import to avoid requiring the package in all environments
      import('africastalking').then(africastalking => {
        const client = africastalking({
          username: this.username,
          apiKey: this.apiKey,
        });
        
        return client.SMS.send({
          to: [formattedPhone],
          message: message,
          from: this.from,
        });
      }).then(response => {
        console.log(`✅ SMS sent to ${formattedPhone} via Africa's Talking`, response);
        return true;
      }).catch(err => {
        console.error("❌ Failed to send SMS via Africa's Talking:", err);
        return false;
      });

      return true;
    } catch (error) {
      console.error("❌ Failed to send SMS via Africa's Talking:", error);
      return false;
    }
  }

  private formatPhoneNumber(phone: string): string {
    // Remove any non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Africa's Talking expects international format without +
    if (digits.startsWith('0')) {
      return '234' + digits.substring(1);
    }
    
    return digits;
  }
}

// Console SMS service (for development)
class ConsoleSmsService {
  async send(phone: string, message: string): Promise<boolean> {
    console.log(`📱 [CONSOLE SMS] To: ${phone}`);
    console.log(`📱 [CONSOLE SMS] Message: ${message}`);
    console.log(`📱 [CONSOLE SMS] Length: ${message.length} characters`);
    return true;
  }
}

// Factory to get the appropriate SMS service
function getSmsService() {
  if (!SMS_ENABLED) {
    return new ConsoleSmsService();
  }

  switch (SMS_PROVIDER) {
    case 'twilio':
      return new TwilioSmsService();
    case 'africastalking':
      return new AfricaIsTalkingSmsService();
    case 'console':
    default:
      return new ConsoleSmsService();
  }
}

// Create the SMS service instance
const smsService = getSmsService();

/**
 * Send an SMS message
 * @param phone Recipient phone number
 * @param message Message content
 * @returns Promise<boolean> indicating success
 */
export async function sendSms(phone: string, message: string): Promise<boolean> {
  try {
    if (!phone) {
      console.error("❌ Cannot send SMS: No phone number provided");
      return false;
    }

    if (!message) {
      console.error("❌ Cannot send SMS: No message provided");
      return false;
    }

    // Log the attempt
    console.log(`📤 Attempting to send SMS to ${phone}`);
    
    // Send via the service
    const result = await smsService.send(phone, message);
    
    if (result) {
      console.log(`✅ SMS sent successfully to ${phone}`);
    } else {
      console.error(`❌ Failed to send SMS to ${phone}`);
    }
    
    return result;
  } catch (error) {
    console.error("❌ Error in sendSms function:", error);
    return false;
  }
}

/**
 * Send bulk SMS messages
 * @param recipients Array of phone numbers and messages
 * @returns Promise with results
 */
export async function sendBulkSms(
  recipients: Array<{ phone: string; message: string }>
): Promise<Array<{ phone: string; success: boolean; error?: string }>> {
  const results = [];

  for (const recipient of recipients) {
    try {
      const success = await sendSms(recipient.phone, recipient.message);
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
 * Send SMS to multiple users with the same message
 * @param phones Array of phone numbers
 * @param message Message to send
 * @returns Promise with results
 */
export async function sendSmsToMany(phones: string[], message: string): Promise<{
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
      const success = await sendSms(phone, message);
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
 * Verify if a phone number is valid
 * @param phone Phone number to verify
 * @returns boolean indicating if valid
 */
export function isValidPhoneNumber(phone: string): boolean {
  // Remove any non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Check if it's a Nigerian number (11 digits starting with 0, or 13 digits starting with 234)
  const isValidNigerian = (digits.length === 11 && digits.startsWith('0')) ||
                          (digits.length === 13 && digits.startsWith('234'));
  
  // Basic international format check
  const isValidInternational = digits.length >= 10 && digits.length <= 15 && phone.startsWith('+');
  
  return isValidNigerian || isValidInternational;
}

/**
 * Get SMS service status
 * @returns Status object
 */
export function getSmsStatus(): {
  enabled: boolean;
  provider: string;
  configured: boolean;
} {
  const provider = SMS_PROVIDER;
  let configured = true;

  if (provider === 'twilio') {
    configured = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  } else if (provider === 'africastalking') {
    configured = !!(process.env.AFRICASTALKING_USERNAME && process.env.AFRICASTALKING_API_KEY);
  }

  return {
    enabled: SMS_ENABLED,
    provider,
    configured,
  };
}

// For backward compatibility, also export as sendSMS (but marked as deprecated)
/**
 * @deprecated Use sendSms instead
 */
export const sendSMS = sendSms;

export default {
  sendSms,
  sendBulkSms,
  sendSmsToMany,
  isValidPhoneNumber,
  getSmsStatus,
};
