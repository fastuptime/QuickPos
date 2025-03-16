const paymayasdk = require('paymaya-integration');

class PayMaya {
  constructor(config) {
    this.config = config || {};
    const requiredFields = ['publicKey', 'secretKey'];
    for (let field of requiredFields) {
      if (!config[field]) throw new Error(`Missing required field: ${field}`);
    }

    this.publicKey = config.publicKey;
    this.secretKey = config.secretKey;
    this.isProduction = config.isProduction || false;

    this.paymaya = new paymayasdk({
      publicKey: this.publicKey,
      secretKey: this.secretKey,
      environment: this.isProduction ? 'PRODUCTION' : 'SANDBOX'
    });
  }

  async createPayment(paymentDetails) {
    try {
      // Zorunlu alanları kontrol et
      const requiredData = ['name', 'amount', 'currency', 'successUrl'];
      for (let data of requiredData) {
        if (!paymentDetails[data]) throw new Error(`Missing required data: ${data}`);
      }

      // Ödeme verileri hazırlanıyor
      const paymentData = {
        totalAmount: {
          value: parseFloat(paymentDetails.amount).toFixed(2),
          currency: paymentDetails.currency
        },
        requestReferenceNumber: paymentDetails.orderId || `REF-${Date.now()}`,
        redirectUrl: {
          success: paymentDetails.successUrl,
          failure: paymentDetails.failureUrl || paymentDetails.successUrl,
          cancel: paymentDetails.cancelUrl || paymentDetails.successUrl
        },
        items: [
          {
            name: paymentDetails.name,
            description: paymentDetails.description || paymentDetails.name,
            quantity: paymentDetails.quantity || 1,
            code: paymentDetails.code || `ITEM-${Date.now()}`,
            amount: {
              value: parseFloat(paymentDetails.amount).toFixed(2),
              currency: paymentDetails.currency
            },
            totalAmount: {
              value: parseFloat(paymentDetails.amount).toFixed(2),
              currency: paymentDetails.currency
            }
          }
        ],
        metadata: paymentDetails.metadata || {}
      };

      const checkout = await this.paymaya.checkout.create(paymentData);

      return {
        status: 'success',
        data: {
          transactionId: checkout.checkoutId,
          url: checkout.redirectUrl,
          id: checkout.checkoutId,
          expiresAt: checkout.expiresAt
        }
      };
    } catch (error) {
      if (error.response) {
        throw new Error(`PayMaya API error: ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        throw new Error('No response received from PayMaya API');
      } else {
        throw new Error(`Error in PayMaya payment creation: ${error.message}`);
      }
    }
  }

  async handleCallback(callbackData) {
    try {
      if (!callbackData.checkoutId) {
        throw new Error('Invalid callback data: missing required fields');
      }

      let checkoutId = callbackData.checkoutId;

      let checkoutStatus = await this.paymaya.checkout.retrieve(checkoutId);
      checkoutStatus = checkoutStatus?.length ? checkoutStatus[0] : checkoutStatus;
      if (checkoutStatus.status === 'PAYMENT_SUCCESS') {
        return {
            status: 'success',
            id: checkoutStatus.id,
            orderId: checkoutStatus.requestReferenceNumber,
            amount: checkoutStatus.amount,
            currency: checkoutStatus.currency
        };
      } else {
        throw new Error(`Payment failed with status: ${checkoutStatus.status}. Please wait a few minutes and refresh the page.`);
      }
    } catch (error) {
      throw new Error(`Error in PayMaya callback handling: ${error.message}`);
    }
  }

  async getCheckoutStatus(checkoutId) {
    return await this.paymaya.checkout.retrieve(checkoutId);
  }

  async voidPayment(paymentId, reason) {
    return await this.paymaya.checkout.voidPayment(paymentId, reason);
  }

  async refundPayment(paymentId, data) {
    return await this.paymaya.checkout.refundPayment(paymentId, data);
  }

  verifyWebhookSignature(payload, signature) {
    return this.paymaya.webhooks.verifySignature(payload, signature);
  }
}

module.exports = PayMaya;
