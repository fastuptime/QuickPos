const Iyzipay = require('iyzipay');
const uuid = require('uuid');
const dayjs = require('dayjs');

class Iyzico {
  constructor(config) {
    this.config = config || {};
    const requiredFields = ['apiKey', 'secretKey', 'uri'];
    for (let field of requiredFields) {
      if (!config[field]) throw new Error(`Missing required field: ${field}`);
    }

    this.iyzipay = new Iyzipay({
      apiKey: config.apiKey,
      secretKey: config.secretKey,
      uri: config.uri || 'https://sandbox-api.iyzipay.com'
    });
  }

  async createPayment(paymentDetails) {
    try {
      // Zorunlu alanları kontrol et
      const requiredData = ['name', 'amount', 'currency', 'callbackUrl', 'email'];
      for (let data of requiredData) {
        if (!paymentDetails[data]) throw new Error(`Missing required data: ${data}`);
      }
      
      const price = parseFloat(paymentDetails.amount).toFixed(2);
      const paidPrice = price; // Fiyatı ayarla, vergi/komisyon eklenecekse burada değiştirebilirsin
      const currency = this.getCurrencyCode(paymentDetails.currency);
      
      // Benzersiz sipariş ID oluştur
      const conversationId = paymentDetails.conversationId || `conv_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const basketId = paymentDetails.orderId || `order_${Date.now()}`;

      // Ödeme formu oluşturma isteği
      const request = {
        locale: paymentDetails.locale || Iyzipay.LOCALE.TR,
        conversationId: conversationId,
        price: price,
        paidPrice: paidPrice,
        currency: currency,
        basketId: basketId,
        paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
        callbackUrl: paymentDetails.callbackUrl,
        enabledInstallments: paymentDetails.enabledInstallments || [1, 2, 3, 6, 9],
        buyer: {
          id: paymentDetails.buyerId || 'BY789',
          name: paymentDetails.buyerName || 'John',
          surname: paymentDetails.buyerSurname || 'Doe',
          gsmNumber: paymentDetails.buyerPhone || '+905350000000',
          email: paymentDetails.email,
          identityNumber: paymentDetails.identityNumber || '74300864791',
          lastLoginDate: paymentDetails.lastLoginDate || dayjs().format('YYYY-MM-DD HH:mm:ss'),
          registrationDate: paymentDetails.registrationDate || dayjs().format('YYYY-MM-DD HH:mm:ss'),
          registrationAddress: paymentDetails.address || 'Nidakule Göztepe, Merdivenköy Mah. Bora Sok. No:1',
          ip: paymentDetails.ip || '85.34.78.112',
          city: paymentDetails.city || 'Istanbul',
          country: paymentDetails.country || 'Turkey',
          zipCode: paymentDetails.zipCode || '34732'
        },
        shippingAddress: {
          contactName: paymentDetails.buyerName ? `${paymentDetails.buyerName} ${paymentDetails.buyerSurname}` : 'John Doe',
          city: paymentDetails.city || 'Istanbul',
          country: paymentDetails.country || 'Turkey',
          address: paymentDetails.address || 'Nidakule Göztepe, Merdivenköy Mah. Bora Sok. No:1',
          zipCode: paymentDetails.zipCode || '34732'
        },
        billingAddress: {
          contactName: paymentDetails.buyerName ? `${paymentDetails.buyerName} ${paymentDetails.buyerSurname}` : 'John Doe',
          city: paymentDetails.city || 'Istanbul',
          country: paymentDetails.country || 'Turkey',
          address: paymentDetails.address || 'Nidakule Göztepe, Merdivenköy Mah. Bora Sok. No:1',
          zipCode: paymentDetails.zipCode || '34732'
        },
        basketItems: [
          {
            id: paymentDetails.itemId || `ITEM${Date.now()}`,
            name: paymentDetails.name,
            category1: paymentDetails.category || 'Digital',
            category2: paymentDetails.subCategory || 'Service',
            itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
            price: price
          }
        ]
      };

      // Önce checkoutFormInitialize ile ödeme formu oluşturalım
      return new Promise((resolve, reject) => {
        this.iyzipay.checkoutFormInitialize.create(request, (err, result) => {
          if (err) {
            return reject(new Error(`Iyzico error: ${err.message}`));
          }

          if (result.status === 'success') {
            resolve({
              status: 'success',
              data: {
                token: result.token,
                url: result.paymentPageUrl, // Ödeme sayfası linki
                status: result.status
              }
            });
          } else {
            reject(new Error(`Iyzico payment creation failed: ${result.errorMessage}`));
          }
        });
      });
    } catch (error) {
      throw new Error(`Error in Iyzico payment creation: ${error.message}`);
    }
  }

  async handleCallback(callbackData) {
    try {
      if (!callbackData || !callbackData.token) {
        throw new Error('Invalid callback data: token is missing');
      }

      const request = {
        locale: Iyzipay.LOCALE.TR,
        conversationId: `retrieve_${Date.now()}`,
        token: callbackData.token
      };

      return new Promise((resolve, reject) => {
        // checkout form ile ödeme sonucunu kontrol et
        this.iyzipay.checkoutForm.retrieve(request, (err, result) => {
          if (err) {
            return reject(new Error(`Iyzico retrieval error: ${err.message}`));
          }

          console.log(result)

          if (result.status === 'success' && result.paymentStatus === 'SUCCESS') {
            resolve({
              status: 'success',
              orderId: result.basketId,
              amount: parseFloat(result.price),
              currency: this.getCurrencyName(result.currency),
              paymentId: result.paymentId,
              paymentType: result.cardType || 'Unknown',
              paymentTransactionId: result.token,
              installment: result.installment
            });
          } else {
            reject(new Error(`Payment failed: ${result.errorMessage || 'Unknown error'}`));
          }
        });
      });
    } catch (error) {
      throw new Error(`Error in Iyzico callback handling: ${error.message}`);
    }
  }

  getCurrencyCode(currency) {
    const currencyMap = {
      'TRY': Iyzipay.CURRENCY.TRY,
      'TL': Iyzipay.CURRENCY.TRY,
      'USD': Iyzipay.CURRENCY.USD,
      'EUR': Iyzipay.CURRENCY.EUR,
      'GBP': Iyzipay.CURRENCY.GBP
    };
    
    return currencyMap[currency.toUpperCase()] || Iyzipay.CURRENCY.TRY;
  }
  
  getCurrencyName(currencyCode) {
    const currencyMap = {
      [Iyzipay.CURRENCY.TRY]: 'TRY',
      [Iyzipay.CURRENCY.USD]: 'USD',
      [Iyzipay.CURRENCY.EUR]: 'EUR',
      [Iyzipay.CURRENCY.GBP]: 'GBP'
    };
    
    return currencyMap[currencyCode] || 'TRY';
  }
}

module.exports = Iyzico;
