/**
 * Service Area Validation
 * MVP: Simple ZIP code validation for Idaho (83xxx range)
 * Future: Google Maps Distance Matrix API for real distance checks
 */

/**
 * Check if a ZIP code is in service area
 * @param {string} zip - ZIP code to validate
 * @returns {boolean} - True if in service area
 */
function isInServiceArea(zip) {
  if (!zip) return true; // No ZIP provided, allow through
  
  const cleanZip = zip.toString().trim();
  
  // MVP: Idaho only (83xxx range)
  // 83000-83999 covers all Idaho ZIP codes
  const zipNum = parseInt(cleanZip, 10);
  
  if (isNaN(zipNum)) return true; // Invalid ZIP, let it through (will handle later)
  
  return zipNum >= 83000 && zipNum <= 83999;
}

/**
 * Extract ZIP code from various formats
 * @param {string} text - Text potentially containing ZIP
 * @returns {string|null} - Extracted ZIP or null
 */
function extractZip(text) {
  if (!text) return null;
  
  // Match 5-digit ZIP codes
  const zipMatch = text.match(/\b(\d{5})\b/);
  
  return zipMatch ? zipMatch[1] : null;
}

/**
 * Get decline message for out-of-service area
 * @param {string} name - Lead's first name
 * @param {string} zip - ZIP code that's out of area
 * @returns {string} - Decline message
 */
function getDeclineMessage(name, zip) {
  return `Hey ${name}, thanks for reaching out. Unfortunately we don't service your area.`;
}

module.exports = {
  isInServiceArea,
  extractZip,
  getDeclineMessage
};
