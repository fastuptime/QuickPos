const crypto = require('crypto');
const axios = require('axios');

class Cryptomus {
    constructor(config) {
        const requiredFields = ['merchantId', 'paymentKey'];
        for (let field of requiredFields) {
            if (!config[field]) throw new Error(`Missing required field: ${field}`);
        }

        this.merchantId = config.merchantId;
        this.paymentKey = config.paymentKey;
        this.apiUrl = 'https://api.cryptomus.com/v1';
    }

    createSignature(payload) {
        const data = Buffer.from(JSON.stringify(payload)).toString('base64');
        return crypto.createHash('md5').update(data + this.paymentKey).digest('hex');
    }

    async createPayment(options) {
        const payload = {
            merchant_id: this.merchantId,
            order_id: options.orderId,
            amount: options.amount,
            currency: options.currency || 'USD',
            url_callback: options.callbackUrl,
            url_return: options.returnUrl,
            is_payment_multiple: false,
            lifetime: options.lifetime || 3600,
            // network: options.network || 'ETH',
            // to_currency: options.toCurrency || 'ETH'
        };

        const sign = this.createSignature(payload);

        try {
            const response = await axios.post(`${this.apiUrl}/payment`, payload, {
                headers: {
                    'merchant': this.merchantId,
                    'sign': sign
                }
            });
            return response.data;
        } catch (error) {
            return error.response.data;
        }
    }

    async getPaymentStatus(orderId) {
        const payload = {
            merchant_id: this.merchantId,
            order_id: orderId
        };

        const sign = this.createSignature(payload);

        try {
            const response = await axios.post(`${this.apiUrl}/payment/status`, payload, {
                headers: {
                    'merchant': this.merchantId,
                    'sign': sign
                }
            });
            return response.data;
        } catch (error) {
            throw new Error(`Payment status query error: ${error.message}`);
        }
    }

    async testWebhook(payload) {
        const sign = this.createSignature(payload);

        try {
            const response = await axios.post(`${this.apiUrl}/test-webhook/payment`, payload, {
                headers: {
                    'merchant': this.merchantId,
                    'sign': sign
                }
            });
            return response.data;
        }
        catch (error) {
            throw new Error(`Test webhook error: ${error.message}`);
        }
    }

    verifyWebhook(payload, signature) {
        if (payload?.sign) delete payload.sign;
        const data = Buffer.from(JSON.stringify(payload)).toString('base64');
        const hash = crypto.createHash('md5').update(data + this.paymentKey).digest('hex');
        return hash === signature;
    }

    async handleCallback(callbackData) {
        try {
            if (!this.verifyWebhook(callbackData, callbackData.sign)) {
                throw new Error("Cryptomus notification failed: invalid signature");
            }
    
            if (callbackData.status === 'paid') {
                return {
                    status: 'success',
                    orderId: callbackData.order_id,
                    uuid: callbackData.uuid,
                    amount: parseFloat(callbackData.amount),
                    payment_amount: parseFloat(callbackData.payment_amount),
                    payment_amount_usd: parseFloat(callbackData.payment_amount_usd),
                    currency: callbackData.currency,
                    paymentMethod: callbackData.payment_method,
                    network: callbackData.network
                };
            } else {
                throw new Error(`Payment failed with status: ${callbackData.status}`);
            }
        } catch (error) {
            throw new Error(`Error in Cryptomus callback handling: ${error.message}`);
        }
    }
}

module.exports = Cryptomus;