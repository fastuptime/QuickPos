class Vallet {
    constructor(config) {
      this.config = config;
    }
  
    async createPayment(paymentDetails) {
      return {
        status: 'success',
        data: { url: 'https://paytr.com/payment-page' }
      };
    }
  
    async handleCallback(callbackData) {
      return {
        status: 'success',
        orderId: callbackData.orderId,
        amount: callbackData.amount,
      };
    }
  }
  
  module.exports = Vallet;