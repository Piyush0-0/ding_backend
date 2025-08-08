const twilio = require('twilio');

// Twilio credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

const client = twilio(accountSid, authToken);

/**
 * Sends an OTP to the specified phone number using Verify v2 API.
 * @param {string} phoneNumber - The phone number to send the OTP to.
 * @returns {Promise} - A promise that resolves when the OTP is sent.
 */
const sendOtp = async (phoneNumber) => {
  try {
    const response = await client.verify.v2.services(serviceSid).verifications.create({
      to: phoneNumber,
      channel: 'sms', // Can also be 'call' or 'email'
    });
    return response;
  } catch (error) {
    throw new Error(`Failed to send OTP: ${error.message}`);
  }
};

/**
 * Verifies the OTP for the specified phone number using Verify v2 API.
 * @param {string} phoneNumber - The phone number to verify.
 * @param {string} otp - The OTP entered by the user.
 * @returns {Promise<boolean>} - A promise that resolves to `true` if the OTP is valid, `false` otherwise.
 */
const verifyOtp = async (phoneNumber, otp) => {
  try {
    const response = await client.verify.v2.services(serviceSid).verificationChecks.create({
      to: phoneNumber,
      code: otp,
    });
    return response.status === 'approved';
  } catch (error) {
    throw new Error(`Failed to verify OTP: ${error.message}`);
  }
};

module.exports = {
  sendOtp,
  verifyOtp,
};