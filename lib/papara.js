const axios = require('axios');

class PaparaClient {
    constructor(config) {
        const requiredFields = ['apiKey', 'merchantSecretKey'];
        for (let field of requiredFields) {
            if (!config[field]) throw new Error(`Missing required field: ${field}`);
        }

        this.URL = config?.test ? 'https://merchant-api.test.papara.com' : 'https://merchant-api.papara.com';
        this.merchantSecretKey = config.merchantSecretKey;
        this.client = axios.create({
            baseURL: this.URL,
            headers: {
                'ApiKey': config.apiKey,
                'Content-Type': 'application/json'
            }
        });

        this.client.interceptors.response.use(response => {
            return response;
        }, error => {
            if (error.response) {
                throw new Error(`Papara API error: ${error.response.data.message}`);
            }
            throw new Error(`Papara API error: ${error.message}`);
        });
    }

    async createPayment(options) {
        try {
            let currencys = {
                'TRY': 0,
                'USD': 1,
                'EUR': 2
            }

            const response = await this.client.post('/payments', {
                amount: Number(options.amount),
                nameSurname: options.nameSurname,
                referenceId: options.referenceId,
                currency: currencys[options.currency],
                orderDescription: options.orderDescription,
                notificationUrl: options.notificationUrl,
                redirectUrl: options.redirectUrl
            });
            return response.data;
        } catch (error) {
            throw new Error(`Payment creation error: ${error.message}`);
        }
    }

    async getAccount() {
        try {
            const response = await this.client.get('/account');
            return response.data;
        } catch (error) {
            throw new Error(`Account info error: ${error.message}`);
        }
    }

    async getAccountLedger(options) {
        try {
            const response = await this.client.post('/account/ledgers', {
                startDate: options.startDate,
                endDate: options.endDate,
                page: options.page || 1,
                pageSize: options.pageSize || 50
            });
            return response.data;
        } catch (error) {
            throw new Error(`Account ledger error: ${error.message}`);
        }
    }

    async getPaymentStatus(paymentId) {
        try {
            const response = await this.client.get(`/payments?id=${paymentId}`);
            return response.data;
        } catch (error) {
            throw new Error(`Payment status error: ${error.message}`);
        }
    }

    async handleCallback(callbackData) {
        try {
            const verification = await this.verifyPaymentCallback(callbackData);
            
            if (!verification.status) {
                throw new Error(verification.error.message);
            }

            return {
                status: 'success',
                orderId: verification.data.referenceId,
                uuid: verification.data.id,
                amount: parseFloat(verification.data.amount),
                currency: verification.data.currency,
                paymentMethod: verification.data.paymentMethod
            };
        } catch (error) {
            throw new Error(`Error in Papara callback handling: ${error.message}`);
        }
    }

    async verifyPaymentCallback(data) {
        try {
            if (data.status !== 1) {
                return {
                    status: false,
                    error: {
                        code: data?.errorCode,
                        message: data?.ErrorMessage || 'Payment failed'
                    }
                };
            }
            
            if (data.merchantSecretKey !== this.merchantSecretKey) {
                return {
                    status: false,
                    error: {
                        code: 401,
                        message: 'Invalid merchant secret key'
                    }
                };
            }

            return {
                status: true,
                data: data
            };
        } catch (error) {
            return {
                status: false,
                error: {
                    code: 500,
                    message: error.message
                }
            };
        }
    }
}

module.exports = PaparaClient;