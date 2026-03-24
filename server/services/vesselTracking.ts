import { storage } from "../storage.js";
import { MarketSignal } from "../../shared/schema.js";

/**
 * Mock vessel tracking data
 */
const MOCK_VESSELS = [
  { id: "VSL001", name: "MT APAPA STAR", location: "Apapa Port", eta: "2026-03-25", status: "berthed" },
  { id: "VSL002", name: "MT LAGOS PRIDE", location: "Approaching", eta: "2026-03-26", status: "en-route" },
  { id: "VSL003", name: "MT WARRI QUEEN", location: "Warri Port", eta: "2026-03-24", status: "berthed" },
];

/**
 * Get current vessel tracking data
 */
export async function getVesselTracking() {
  // In a real implementation, this would fetch from an external API
  return MOCK_VESSELS;
}

/**
 * Update market signals based on vessel activity
 */
export async function updateVesselSignals() {
  try {
    const terminals = await storage.getAllTerminals(); // fixed: use getAllTerminals()
    
    for (const terminal of terminals) {
      const currentSignal = await storage.getLatestSignal(terminal.id);
      
      // Determine vessel activity based on terminal name (mock logic)
      let vesselActivity = "None";
      const terminalVessels = MOCK_VESSELS.filter(v => 
        v.location.toLowerCase().includes(terminal.name.toLowerCase())
      );
      
      if (terminalVessels.length > 0) {
        vesselActivity = "Moderate";
        if (terminalVessels.some(v => v.status === "berthed")) {
          vesselActivity = "High";
        }
      }
      
      // Only update if changed
      if (currentSignal?.vesselActivity !== vesselActivity) {
        await storage.createSignal({
          terminalId: terminal.id,
          productType: "PMS",
          vesselActivity,
          truckQueue: currentSignal?.truckQueue || "Low",
          nnpcSupply: currentSignal?.nnpcSupply || "Moderate",
          fxPressure: currentSignal?.fxPressure || "Medium",
          policyRisk: currentSignal?.policyRisk || "Low",
        });
        console.log(`✅ Updated vessel signal for terminal ${terminal.name}`);
      }
    }
  } catch (error) {
    console.error("❌ Failed to update vessel signals:", error);
    throw error;
  }
}
