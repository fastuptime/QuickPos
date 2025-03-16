const axios = require('axios');
const crypto = require('crypto');
const esnekpos = require('esnekpos');

class EsnekPos {
  constructor(config) {
    this.config = config || {};
    const requiredFields = ['merchant', 'merchantKey'];
    for (let field of requiredFields) {
      if (!config[field]) throw new Error(`Missing required field: ${field}`);
    }

    this.client = esnekpos.createClient({
      merchant: config.merchant,
      merchantKey: config.merchantKey,
      testMode: config.testMode || false
    });
    
    this.debug = config.debug || false;
  }

  async createPayment(paymentDetails) {
    try {
      // Zorunlu alanları kontrol et
      const requiredData = ['amount', 'currency', 'orderId', 'callbackUrl'];
      for (let data of requiredData) {
        if (!paymentDetails[data]) throw new Error(`Missing required data: ${data}`);
      }

      // Temel yapılandırma objesi
      const baseConfig = {
        Config: {
          ORDER_REF_NUMBER: paymentDetails.orderId,
          ORDER_AMOUNT: paymentDetails.amount,
          PRICES_CURRENCY: paymentDetails.currency || 'TRY',
          BACK_URL: paymentDetails.callbackUrl,
          LOCALE: paymentDetails.locale || 'tr'
        },
        Customer: {
          FIRST_NAME: paymentDetails.name || 'Müşteri',
          LAST_NAME: paymentDetails.surname || 'Adı',
          MAIL: paymentDetails.email || 'musteri@example.com',
          PHONE: paymentDetails.phone || '',
          CITY: paymentDetails.city || '',
          STATE: paymentDetails.state || '',
          ADDRESS: paymentDetails.address || ''
        },
        Product: [
          {
            PRODUCT_ID: paymentDetails.productId || '1',
            PRODUCT_NAME: paymentDetails.description || 'Ürün Adı',
            PRODUCT_CATEGORY: paymentDetails.category || 'Diğer',
            PRODUCT_DESCRIPTION: paymentDetails.description || 'Ürün Açıklaması',
            PRODUCT_AMOUNT: paymentDetails.amount
          }
        ]
      };

      // Ödeme türüne göre işlem
      let response;
      
      if (paymentDetails.paymentMethod === 'bkm') {
        // BKM Express ödemesi
        if (this.debug) console.log('Creating BKM Express payment');
        response = await this.client.payment.createBkmPayment(baseConfig);
      } else if (paymentDetails.creditCard) {
        // 3D ödeme
        if (this.debug) console.log('Creating 3D payment with card info');
        
        baseConfig.CreditCard = {
          CC_NUMBER: paymentDetails.creditCard.number,
          EXP_MONTH: paymentDetails.creditCard.expireMonth,
          EXP_YEAR: paymentDetails.creditCard.expireYear,
          CC_CVV: paymentDetails.creditCard.cvv,
          CC_OWNER: paymentDetails.creditCard.owner,
          INSTALLMENT_NUMBER: paymentDetails.creditCard.installment || '1'
        };
        
        response = await this.client.payment.create3DPayment(baseConfig);
      } else if (paymentDetails.recurring) {
        // Tekrarlı ödeme
        if (this.debug) console.log('Creating recurring payment');
        
        // Recurring özellikleri ekle
        baseConfig.Config.REPEAT = paymentDetails.recurring.repeat || '1';
        baseConfig.Config.TRIES_COUNT = paymentDetails.recurring.triesCount || '3';
        baseConfig.Config.START_DATE = paymentDetails.recurring.startDate || 
          new Date(Date.now() + 86400000).toISOString().split('T')[0];
        
        // Kart bilgileri array olarak eklenmeli
        baseConfig.Cards = [{
          CC_NUMBER: paymentDetails.creditCard.number,
          EXP_MONTH: paymentDetails.creditCard.expireMonth,
          EXP_YEAR: paymentDetails.creditCard.expireYear,
          CC_CVV: paymentDetails.creditCard.cvv,
          CC_OWNER: paymentDetails.creditCard.owner
        }];
        
        response = await this.client.recurring.createRecurringPayment(baseConfig);
      } else {
        // Ortak ödeme sayfası
        if (this.debug) console.log('Creating common payment page');
        response = await this.client.payment.createCommonPayment(baseConfig);
      }
      
      if (this.debug) console.log('EsnekPOS response:', response);

      if (response && (response.STATUS == 'SUCCESS')) {
        return {
          status: 'success',
          data: {
            transactionId: response.ORDER_REF_NUMBER || response.orderRefNumber || response.data?.orderRefNumber,
            url: response.URL_3DS || response.data?.URL_3DS,
            id: response.REFNO || response.orderRefNumber || response.data?.orderRefNumber,
            html: response.HTML_3DS || response.data?.HTML_3DS || null
          }
        };
      } else {
        return {
          status: 'fail',
          message: response.message || 'Ödeme oluşturulamadı',
          error: response.errorMessage || response.error || 'Bilinmeyen hata'
        };
      }
    } catch (error) {
      if (this.debug) console.error('EsnekPOS payment creation error:', error);
      
      return {
        status: 'fail',
        message: error.message || 'Bilinmeyen hata'
      };
    }
  }

  async handleCallback(callbackData) {
    try {
      if (this.debug) console.log('Processing callback data:', callbackData);

      // İşlem başarılı mı?
      const isSuccess = callbackData.STATUS === 'SUCCESS' || 
                        callbackData.result === 'success' || 
                        callbackData.success === true;
      
      if (isSuccess) {
        // İşlem sorgulama ile durum teyidi
        const orderRefNumber = callbackData.ORDER_REF_NUMBER || callbackData.orderRefNumber;
        
        if (!orderRefNumber) {
          throw new Error('Missing order reference number');
        }
        
        const transactionDetails = await this.getPaymentStatus(orderRefNumber);
   
        if (transactionDetails.status === 'success') {
          return {
            status: 'success',
            orderId: orderRefNumber,
            transactionId: callbackData.transactionId || orderRefNumber,
            amount: parseFloat(callbackData.AMOUNT || callbackData.amount || callbackData.ORDER_AMOUNT),
            currency: callbackData.currency || callbackData.PRICES_CURRENCY || 'TRY',
            paymentType: callbackData.paymentType || 'creditcard',
            date: callbackData.date || new Date().toISOString()
          };
        } else {
          throw new Error('Transaction verification failed');
        }
      } else {
        throw new Error(`Payment failed with status: ${callbackData.status || 'unknown'}`);
      }
    } catch (error) {
      if (this.debug) console.error('Callback handling error:', error);
      throw new Error(`Error in EsnekPOS callback handling: ${error.message}`);
    }
  }

  async getPaymentStatus(orderRefNumber) {
    try {
      const result = await this.client.query.queryTransactionDetail(orderRefNumber);

      if (this.debug) console.log('Payment status result:', result);
      
      if (result && result.STATUS === 'SUCCESS') {
        return {
          status: 'success',
          data: result.paymentList || result
        };
      } else {
        return {
          status: 'fail',
          message: result.message || 'İşlem bulunamadı'
        };
      }
    } catch (error) {
      if (this.debug) console.error('Get payment status error:', error);
      throw new Error(`Error getting payment status: ${error.message}`);
    }
  }

  async refundPayment(orderRefNumber, amount = null, syncWithPos = true) {
    try {
      const params = {
        orderRefNumber: orderRefNumber,
        amount: amount, // Null ise tam iade yapılır
        syncWithPos: syncWithPos
      };
      
      const result = await this.client.refund.refundTransaction(params);
      
      if (result && result.success) {
        return {
          status: 'success',
          data: result.data || result
        };
      } else {
        return {
          status: 'fail',
          message: result.message || 'İade işlemi başarısız oldu'
        };
      }
    } catch (error) {
      if (this.debug) console.error('Refund error:', error);
      throw new Error(`Error refunding payment: ${error.message}`);
    }
  }

  // Taksit seçenekleri sorgulama
  async getInstallmentOptions(amount, bin = null, commissionForCustomer = 1) {
    try {
      const params = {
        amount: amount,
        commissionForCustomer: commissionForCustomer
      };
      
      if (bin && bin.length === 6) {
        params.bin = bin;
      }
      
      const result = await this.client.query.getInstallmentOptions(params);
      
      if (result && result.success) {
        return {
          status: 'success',
          data: result.data || result
        };
      } else {
        return {
          status: 'fail',
          message: result.message || 'Taksit seçenekleri alınamadı'
        };
      }
    } catch (error) {
      if (this.debug) console.error('Get installment options error:', error);
      throw new Error(`Error getting installment options: ${error.message}`);
    }
  }
  
  // Üye işyeri bakiyesi sorgulama
  async getDealerBalance(currency = 'TRY') {
    try {
      const result = await this.client.query.getDealerBalance({
        currency: currency
      });
      
      if (result && result.success) {
        return {
          status: 'success',
          data: result.data || result
        };
      } else {
        return {
          status: 'fail',
          message: result.message || 'Bakiye bilgisi alınamadı'
        };
      }
    } catch (error) {
      if (this.debug) console.error('Get dealer balance error:', error);
      throw new Error(`Error getting dealer balance: ${error.message}`);
    }
  }
  
  // BIN sorgulama
  async getBinInfo(bin) {
    try {
      if (!bin || bin.length !== 6) {
        throw new Error('Geçerli bir BIN numarası (ilk 6 hane) gerekli');
      }
      
      const result = await this.client.query.getBinInfo(bin);
      
      if (result && result.success) {
        return {
          status: 'success',
          data: result.data || result
        };
      } else {
        return {
          status: 'fail',
          message: result.message || 'BIN bilgisi alınamadı'
        };
      }
    } catch (error) {
      if (this.debug) console.error('Get BIN info error:', error);
      throw new Error(`Error getting BIN info: ${error.message}`);
    }
  }

  // Alt üye işyeri tanımlama (Pazaryeri için)
  async setSubMerchant(merchantData) {
    try {
      const result = await this.client.marketplace.setSubMerchant(merchantData);
      
      if (result && result.success) {
        return {
          status: 'success',
          data: result.data || result
        };
      } else {
        return {
          status: 'fail',
          message: result.message || 'Alt üye işyeri tanımlanamadı'
        };
      }
    } catch (error) {
      if (this.debug) console.error('Set sub-merchant error:', error);
      throw new Error(`Error setting sub-merchant: ${error.message}`);
    }
  }

  // Fiziksel POS listesi
  async listPhysicalPos() {
    try {
      const result = await this.client.physicalPos.listPhysicalPos();
      
      if (result && result.success) {
        return {
          status: 'success',
          data: result.data || result
        };
      } else {
        return {
          status: 'fail',
          message: result.message || 'Fiziksel POS listesi alınamadı'
        };
      }
    } catch (error) {
      if (this.debug) console.error('List physical POS error:', error);
      throw new Error(`Error listing physical POS: ${error.message}`);
    }
  }
}

module.exports = EsnekPos;
