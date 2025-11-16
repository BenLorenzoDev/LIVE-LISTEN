// config.js
module.exports = {
  apiKey: process.env.VAPI_API_KEY,
  assistantId: process.env.VAPI_ASSISTANT_ID,
  phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
  apiBaseUrl: process.env.VAPI_API_BASE_URL || "https://api.vapi.ai",
};
