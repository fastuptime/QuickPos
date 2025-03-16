const { AnypayClient, crypto } = require('anypay-node');

class AnyPay {
  constructor(config) {
    this.config = config || {};
    const requiredFields = ['merchantId', 'secretKey'];
    for (let field of requiredFields) {
      if (!config[field]) throw new Error(`Missing required field: ${field}`);
    }

    this.client = new AnypayClient({
      merchantId: config.merchantId,
      secretKey: config.secretKey,
      apiId: config.apiId || '',
      apiKey: config.apiKey || ''
    });
    
    this.debug = config.debug || false;
    this.crypto = crypto; // Crypto yardımcı fonksiyonlarını dışa açalım
  }

  async createPayment(paymentDetails) {
    try {
      const requiredData = ['amount', 'currency', 'orderId', 'desc'];
      for (let data of requiredData) {
        if (!paymentDetails[data]) throw new Error(`Missing required data: ${data}`);
      }

      // Parametre adlarını dönüştür (QuickPos -> AnyPay API)
      const params = {
        pay_id: paymentDetails.orderId,
        amount: paymentDetails.amount,
        currency: paymentDetails.currency,
        desc: paymentDetails.desc,
        method: paymentDetails.method || '',
        email: paymentDetails.email || '',
        success_url: paymentDetails.successUrl || '',
        fail_url: paymentDetails.failUrl || '',
        webhook_url: paymentDetails.notificationUrl || ''
      };

      if (this.debug) console.log('Creating payment with params:', params);

      // Form verisi ve HTML URL'si al
      const formData = this.client.createPaymentFormData(params);
      
      if (this.debug) console.log('Payment form data:', formData);

      // API ile ödeme oluşturma
      if (paymentDetails.useApi) {
        try {
          const apiResponse = await this.client.createPayment(params);
          if (this.debug) console.log('API payment response:', apiResponse);
          
          return {
            status: 'success',
            data: {
              url: apiResponse.payment_url,
              id: apiResponse.id || apiResponse.transaction_id,
              pay_id: params.pay_id,
              amount: params.amount,
              currency: params.currency
            }
          };
        } catch (apiError) {
          if (this.debug) console.error('API payment error:', apiError);
          throw apiError;
        }
      }
      
      // Form HTML oluşturma ya da POST URL'i alma
      if (paymentDetails.returnFormHtml) {
        // HTML formunu döndür
        const formHtml = this.client.createPaymentForm(params);
        return {
          status: 'success',
          data: {
            formHtml: formHtml,
            pay_id: params.pay_id
          }
        };
      } else {
        // Doğrudan post URL'ini döndür
        return {
          status: 'success',
          data: {
            url: 'https://anypay.io/payment',
            formData: formData,
            pay_id: params.pay_id,
            amount: params.amount,
            currency: params.currency
          }
        };
      }
    } catch (error) {
      if (this.debug) console.error('Payment creation error:', error);
      
      return {
        status: 'fail',
        message: error.message || 'Unknown error'
      };
    }
  }

  async handleCallback(callbackData) {
    try {
      if (this.debug) console.log('Processing callback data:', callbackData);

      if (!callbackData || !callbackData.pay_id) {
        throw new Error('Missing required callback parameters');
      }

      // IP adresini kontrol edebiliriz (isteğe bağlı)
      const isValid = this.client.validateNotification(callbackData);
      
      if (!isValid) {
        throw new Error('Invalid notification signature');
      }

      // status "paid" ise başarılı
      if (callbackData.status === 'paid') {
        return {
          status: 'success',
          orderId: callbackData.pay_id,
          amount: parseFloat(callbackData.amount),
          currency: callbackData.currency,
          transactionId: callbackData.transaction_id,
          profit: callbackData.profit,
          paymentMethod: callbackData.method,
          email: callbackData.email,
          test: callbackData.test === '1'
        };
      } else {
        throw new Error(`Payment failed with status: ${callbackData.status}`);
      }
    } catch (error) {
      if (this.debug) console.error('Callback handling error:', error);
      throw new Error(`Error in AnyPay callback handling: ${error.message}`);
    }
  }

  async getPaymentInfo(transactionId) {
    try {
      const payments = await this.client.getPayments({ trans_id: transactionId });
      
      if (payments && Array.isArray(payments) && payments.length > 0) {
        return {
          status: 'success',
          data: payments[0]
        };
      } else {
        throw new Error('Payment not found');
      }
    } catch (error) {
      if (this.debug) console.error('Get payment info error:', error);
      throw new Error(`Error in AnyPay payment info: ${error.message}`);
    }
  }
  
  async getBalance() {
    try {
      return await this.client.getBalance();
    } catch (error) {
      if (this.debug) console.error('Get balance error:', error);
      throw new Error(`Error getting balance: ${error.message}`);
    }
  }
  
  async getPayments(params = {}) {
    try {
      return await this.client.getPayments(params);
    } catch (error) {
      if (this.debug) console.error('Get payments error:', error);
      throw new Error(`Error getting payments: ${error.message}`);
    }
  }
  
  async getRates() {
    try {
      return await this.client.getRates();
    } catch (error) {
      if (this.debug) console.error('Get rates error:', error);
      throw new Error(`Error getting rates: ${error.message}`);
    }
  }
  
  async getCommissions() {
    try {
      return await this.client.getCommissions();
    } catch (error) {
      if (this.debug) console.error('Get commissions error:', error);
      throw new Error(`Error getting commissions: ${error.message}`);
    }
  }
  
  async createPaymentForm(params) {
    try {
      return this.client.createPaymentForm(params);
    } catch (error) {
      if (this.debug) console.error('Create payment form error:', error);
      throw new Error(`Error creating payment form: ${error.message}`);
    }
  }
  
  async getNotificationIPs() {
    try {
      return await this.client.getNotificationIPs();
    } catch (error) {
      if (this.debug) console.error('Get notification IPs error:', error);
      throw new Error(`Error getting notification IPs: ${error.message}`);
    }
  }

  async createPayout(params) {
    try {
      return await this.client.createPayout(params);
    } catch (error) {
      if (this.debug) console.error('Create payout error:', error);
      throw new Error(`Error creating payout: ${error.message}`);
    }
  }
  
  async getPayouts(params = {}) {
    try {
      return await this.client.getPayouts(params);
    } catch (error) {
      if (this.debug) console.error('Get payouts error:', error);
      throw new Error(`Error getting payouts: ${error.message}`);
    }
  }
  
  // Form verisi ve HTML döndüren yardımcı metodlar
  createPaymentFormData(params) {
    return this.client.createPaymentFormData(params);
  }
  
  createPaymentForm(params) {
    return this.client.createPaymentForm(params);
  }
  
  validateNotification(notification, ipAddress) {
    return this.client.validateNotification(notification, ipAddress);
  }
}

module.exports = AnyPay;
