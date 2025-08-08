const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummyKeyId',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'rzp_test_dummyKeySecret',
});

/**
 * Create a linked account (sub-merchant) for a restaurant
 * @param {Object} accountData - Data required by Razorpay for account creation
 * @returns {Promise<Object>} - Razorpay account response
 */
async function createLinkedAccount(accountData) {
  return razorpay.accounts.create(accountData);
}

/**
 * Create a payment routed to a sub-merchant (linked account)
 * @param {Object} paymentData - Payment data (amount, currency, etc.)
 * @param {string} linkedAccountId - Razorpay linked account ID
 * @returns {Promise<Object>} - Razorpay payment response
 */
async function createRoutedPayment(paymentData, linkedAccountId) {
  return razorpay.payments.create({
    ...paymentData,
    on_behalf_of: linkedAccountId,
  });
}

module.exports = {
  createLinkedAccount,
  createRoutedPayment,
}; 