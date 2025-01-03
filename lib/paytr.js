const crypto = require('crypto');
const jsSHA = require('jssha');
const axios = require('axios');

class PayTR {
  constructor(config) {
    this.config = config || {};
    const requiredFields = ['merchantId', 'merchantKey', 'merchantSalt'];
    for (let field of requiredFields) {
      if (!config[field]) throw new Error(`Missing required field: ${field}`);
    }

    this.merchantId = config.merchantId;
    this.merchantKey = config.merchantKey;
    this.merchantSalt = config.merchantSalt;
  }

  async createPayment(paymentDetails) {
    try {
      let requiredData = ['name', 'amount', 'currency', 'maxInstallment', 'expiry_date'];
      for (let data of requiredData) {
        if (!paymentDetails[data]) throw new Error(`Missing required data: ${data}`);
      }
      
      const price = Math.round(paymentDetails.amount * 100).toString();
      const linkType = paymentDetails.linkType || 'product';
      const currency = paymentDetails.currency || 'TL';
      const lang = paymentDetails.lang || 'tr';
      const minCount = paymentDetails.min_count || '1';

      const required = paymentDetails.name + price + currency + paymentDetails.maxInstallment + linkType + lang + minCount;
      const paytrToken = this.generateToken(required);

      const formData = {
        merchant_id: this.merchantId,
        name: paymentDetails.name,
        price: price,
        currency: currency,
        max_installment: paymentDetails.maxInstallment,
        link_type: linkType,
        lang: lang,
        min_count: minCount,
        paytr_token: paytrToken,
        expiry_date: paymentDetails?.expiry_date,
        get_qr: '1',
        max_count: Number(paymentDetails?.max_count) || '1',
      };

      let optionalData = ['email', 'callback_link', 'callback_id'];
      for (let data of optionalData) { formData[data] = paymentDetails[data]; }

      const response = await axios({
        method: 'POST',
        url: 'https://www.paytr.com/odeme/api/link/create',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: new URLSearchParams(formData).toString()
      });

      const responseData = response.data;

      if (responseData.status === 'success') {
        return {
          status: 'success',
          data: {
            transactionId: responseData.id,
            url: responseData.link,
            id: responseData.id,
            qr: responseData.base64_qr
          }
        };
      } else {
        throw new Error(responseData.reason || 'Unknown error occurred');
      }
    } catch (error) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        throw new Error(`PayTR API error: ${error.response.data.reason || error.response.statusText}`);
      } else if (error.request) {
        // The request was made but no response was received
        throw new Error('No response received from PayTR API');
      } else {
        // Something happened in setting up the request that triggered an Error
        throw new Error(`Error in PayTR payment creation: ${error.message}`);
      }
    }
  }

  async handleCallback(callbackData) {
    try {
      const token = callbackData.callback_id + callbackData.merchant_oid + this.merchantSalt + callbackData.status + callbackData.total_amount;

      let paytrToken = this.hashCheck(token, callbackData.hash);
      if (!paytrToken) {
        throw new Error("PAYTR notification failed: bad hash");
      }

      if (callbackData.status === 'success') {
        return {
          status: 'success',
          orderId: callbackData.callback_id,
          merchant_oid: callbackData.merchant_oid,
          amount: parseFloat(callbackData.total_amount) / 100,
          currency: callbackData.currency,
          paymentType: callbackData.payment_type
        };
      } else {
        throw new Error("Payment failed");
      }
    } catch (error) {
      throw new Error(`Error in PayTR callback handling: ${error.message}`);
    }
  }

  generateToken(data) {
    return crypto.createHmac('sha256', this.merchantKey)
      .update(data + this.merchantSalt)
      .digest('base64');
  }

  hashCheck(data, key) {
    let shaObj = new jsSHA("SHA-256", "TEXT");
    shaObj.setHMACKey(this.merchantKey, "TEXT");
    shaObj.update(data);
    if (shaObj.getHMAC("B64") === key) return true;
    else return false;
  }
}

module.exports = PayTR;