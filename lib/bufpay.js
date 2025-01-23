const crypto = require('crypto');
const axios = require('axios');

class BufPay {
  constructor(config) {
    this.config = config || {};
    const requiredFields = ['appId', 'appSecret'];
    for (let field of requiredFields) {
      if (!config[field]) throw new Error(`Missing required field: ${field}`);
    }

    this.appId = config.appId;
    this.appSecret = config.appSecret;
    this.baseUrl = 'https://bufpay.com/api';
  }

  async createPayment(paymentDetails) {
    try {
      // console.log('Creating payment with details:', JSON.stringify(paymentDetails, null, 2));

      let requiredData = ['name', 'payType', 'price', 'orderId', 'orderUid', 'notifyUrl'];
      for (let data of requiredData) {
        if (!paymentDetails[data]) throw new Error(`Missing required data: ${data}`);
      }

      const signature = this.generateToken(
        paymentDetails.name,
        paymentDetails.payType,
        paymentDetails.price,
        paymentDetails.orderId,
        paymentDetails.orderUid,
        paymentDetails.notifyUrl,
        paymentDetails.returnUrl || '',
        paymentDetails.feedbackUrl || '',
        this.appSecret
      );

      // console.log('Generated signature:', signature);

      const formData = {
        name: paymentDetails.name,
        pay_type: paymentDetails.payType,
        price: paymentDetails.price,
        order_id: paymentDetails.orderId,
        order_uid: paymentDetails.orderUid,
        notify_url: paymentDetails.notifyUrl,
        return_url: paymentDetails.returnUrl || '',
        feedback_url: paymentDetails.feedbackUrl || '',
        sign: signature
      };

      // console.log('Sending request with form data:', JSON.stringify(formData, null, 2));

      const response = await axios({
        method: 'POST',
        url: `${this.baseUrl}/pay/${this.appId}?format=json`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: new URLSearchParams(formData).toString()
      });

      // console.log('Received response:', JSON.stringify(response.data, null, 2));

      if (!response.data) {
        throw new Error('Empty response received from BufPay API');
      }

      const responseData = response.data;

      // Log the full response for debugging
      // console.log('Response status:', responseData.status);
      // console.log('Full response:', JSON.stringify(responseData, null, 2));

      if (responseData.status === 'success' || responseData.status === 'ok') { 
        return {
          status: 'success',
          data: {
              aoid: responseData.aoid,
              pay_type: responseData?.pay_type,
              price: responseData?.price,
              qr_price: responseData?.qr_price,
              qr: responseData?.qr,
              cid: responseData?.cid,
              expires_in: responseData?.expires_in,
              return_url: responseData?.return_url,
              feedback_url: responseData?.feedback_url
          }
        };
      } else {
        return {
          status: 'fail',
          message: responseData?.status
        }
      }
    } catch (error) {
      // console.error('Error details:', error);

      if (error.response) {
        // console.error('API Response Error:', {
        //   status: error.response.status,
        //   data: error.response.data,
        //   headers: error.response.headers
        // });
        throw new Error(`BufPay API error: ${JSON.stringify(error.response.data)}`);
      } else if (error.request) {
        // console.error('No Response Error:', error.request);
        throw new Error('No response received from BufPay API');
      } else {
        // console.error('Request Setup Error:', error.message);
        throw new Error(`Error in BufPay payment creation: ${error.message}`);
      }
    }
  }

  generateToken(...params) {
    try {
      const concatenated = params
        .filter(param => param !== undefined && param !== null)
        .map(param => String(param))
        .join('');

      // console.log('Generating token with params:', concatenated);

      const token = crypto
        .createHash('md5')
        .update(concatenated, 'utf8')
        .digest('hex')
        .toUpperCase();

      // console.log('Generated token:', token);
      return token;
    } catch (error) {
      // console.error('Token generation error:', error);
      throw new Error(`Error generating token: ${error.message}`);
    }
  }

  verifyCallback(callbackData) {
    try {
      console.log('Verifying callback data:', JSON.stringify(callbackData, null, 2));

      const { aoid, order_id, order_uid, price, pay_price, sign } = callbackData;

      if (!aoid || !order_id || !order_uid || !price || !pay_price || !sign) {
        console.log('Missing required callback fields');
        return false;
      }

      const expectedSignature = this.generateToken(
        aoid,
        order_id,
        order_uid,
        price,
        pay_price,
        this.appSecret
      );

      console.log('Expected signature:', expectedSignature);
      console.log('Received signature:', sign);

      return sign === expectedSignature;
    } catch (error) {
      console.error('Callback verification error:', error);
      return false;
    }
  }

  async handleCallback(callbackData) {
    try {
      console.log('Processing callback data:', JSON.stringify(callbackData, null, 2));

      const isValid = this.verifyCallback(callbackData);
      if (!isValid) {
        throw new Error("BufPay notification failed: invalid signature");
      }

      if (callbackData.status === 'success') {
        return {
          status: 'success',
          orderId: callbackData.order_id,
          transactionId: callbackData.aoid,
          amount: parseFloat(callbackData.pay_price),
          originalAmount: parseFloat(callbackData.price),
          orderUid: callbackData.order_uid
        };
      } else {
        throw new Error(`Payment failed: ${JSON.stringify(callbackData)}`);
      }
    } catch (error) {
      console.error('Callback handling error:', error);
      throw new Error(`Error in BufPay callback handling: ${error.message}`);
    }
  }

  async queryPayment(aoid) {
    try {
      console.log('Querying payment with AOID:', aoid);

      if (!aoid) {
        throw new Error('Transaction ID (AOID) is required');
      }

      const response = await axios.get(`${this.baseUrl}/query/${aoid}`);
      console.log('Query response:', JSON.stringify(response.data, null, 2));

      return response.data;
    } catch (error) {
      console.error('Payment query error:', error);
      throw new Error(`Payment query failed: ${error.message}`);
    }
  }
}

module.exports = BufPay;