const axios = require('axios');
const crypto = require('crypto');

class Shopier {
  constructor(config) {
    this.config = config || {};
    const requiredFields = ['pat', 'username', 'key'];
    for (let field of requiredFields) {
      if (!config[field]) throw new Error(`Missing required field: ${field}`);
    }

    this.pat = config.pat;
    this.username = config.username; 
    this.key = config.key;
    this.baseURL = 'https://api.shopier.com/v1';
    this.axios = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.pat}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async createPayment(productDetails) {
    try {
      const response = await this.axios.post('/products', {
        type: productDetails.type || 'digital',
        priceData: {
          currency: productDetails.priceData?.currency || 'TRY',
          price: productDetails.priceData?.price
        },
        shippingPayer: productDetails.shippingPayer || 'sellerPays',
        title: productDetails.title,
        media: productDetails.media || [],
        stockQuantity: productDetails.stockQuantity,
        description: productDetails.description
      });

      return {
        status: 'success',
        data: response.data
      };
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  async deleteProductsId(params) {
    try {
      if (!params.id) throw new Error('Product ID is required');
      const response = await this.axios.delete(`/products/${params.id}`);
      return {
        status: 'success',
        data: response.data
      };
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  handleApiError(error) {
    if (error.response) {
      return new Error(`Shopier API error: ${error.response.data?.message || error.response.statusText}`);
    }
    if (error.request) {
      return new Error('No response received from Shopier API');
    }
    return new Error(`Error in Shopier operation: ${error.message}`);
  }

  verifyWebhookHash(payload) {
    if (!payload.res || !payload.hash) {
      throw new Error('Missing webhook parameters');
    }

    const calculatedHash = crypto
      .createHmac('sha256', this.key)
      .update(payload.res + this.username)
      .digest('hex');

    return calculatedHash === payload.hash;
  }

  parseWebhookData(base64Data) {
    try {
      const jsonStr = Buffer.from(base64Data, 'base64').toString();
      return JSON.parse(jsonStr);
    } catch (error) {
      throw new Error('Failed to parse webhook data');
    }
  }

  handleCallback(webhookData) {
    try {
      if (!this.verifyWebhookHash(webhookData)) {
        throw new Error('Invalid webhook signature');
      }

      const data = this.parseWebhookData(webhookData.res);
      
      return {
        status: 'success',
        data: {
          email: data.email,
          orderId: data.orderid,
          currency: data.currency, // 0:TL, 1:USD, 2:EUR
          price: data.price,
          buyerName: data.buyername,
          buyerSurname: data.buyersurname,
          productId: data.productid,
          productCount: data.productcount,
          customerNote: data.customernote,
          productList: data.productlist,
          chartDetails: data.chartdetails,
          isTest: data.istest // 0:live, 1:test
        }
      };
    } catch (error) {
      throw new Error(`Webhook handling error: ${error.message}`);
    }
  }
}

module.exports = Shopier;
