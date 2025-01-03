const crypto = require('crypto');
const axios = require('axios');

class Payeer {
    constructor(config) {
        this.config = config || {};
        const requiredFields = ['m_shop', 'm_key'];
        for (let field of requiredFields) {
            if (!config[field]) throw new Error(`Missing required field: ${field}`);
        }

        this.m_shop = config.m_shop;
        this.m_key = config.m_key;
    }

    async createPayment(paymentDetails) {
        try {
            const requiredData = ['orderId', 'amount', 'currency', 'description'];
            for (let data of requiredData) {
                if (!paymentDetails[data]) throw new Error(`Missing required data: ${data}`);
            }

            const m_sign = this.generateSignature(
                paymentDetails.orderId,
                paymentDetails.amount,
                paymentDetails.currency,
                Buffer.from(paymentDetails.description).toString('base64')
            );

            const paymentUrl = `https://payeer.com/merchant/?m_shop=${this.m_shop}&m_orderid=${paymentDetails.orderId}&m_amount=${paymentDetails.amount}&m_curr=${paymentDetails.currency}&m_desc=${Buffer.from(paymentDetails.description).toString('base64')}&m_sign=${m_sign}&lang=${paymentDetails.lang || 'en'}`;

            return {
                status: 'success',
                data: {
                    url: paymentUrl,
                    orderId: paymentDetails.orderId,
                    amount: paymentDetails.amount,
                    currency: paymentDetails.currency
                }
            };
        } catch (error) {
            throw new Error(`Error in Payeer payment creation: ${error.message}`);
        }
    }

    async handleCallback(callbackData) {
        try {
            const signHash = this.generatePaymentStatusSignature(callbackData);

            if (callbackData.m_sign === signHash && callbackData.m_status === 'success') {
                return {
                    status: 'success',
                    orderId: callbackData.m_orderid,
                    amount: callbackData.m_amount,
                    currency: callbackData.m_curr,
                    operationId: callbackData.m_operation_id,
                    paymentDate: callbackData.m_operation_pay_date
                };
            } else {
                throw new Error('Payment validation failed');
            }
        } catch (error) {
            throw new Error(`Error in Payeer callback handling: ${error.message}`);
        }
    }

    generateSignature(m_orderid, m_amount, m_curr, m_desc) {
        const arHash = [
            this.m_shop,
            m_orderid,
            m_amount,
            m_curr,
            m_desc,
            this.m_key
        ];

        return crypto.createHash('sha256')
                    .update(arHash.join(':'))
                    .digest('hex')
                    .toUpperCase();
    }

    generatePaymentStatusSignature(paymentData) {
        const arHash = [
            paymentData.m_operation_id,
            paymentData.m_operation_ps,
            paymentData.m_operation_date,
            paymentData.m_operation_pay_date,
            paymentData.m_shop,
            paymentData.m_orderid,
            paymentData.m_amount,
            paymentData.m_curr,
            paymentData.m_desc,
            paymentData.m_status
        ];

        if (paymentData.m_params) {
            arHash.push(paymentData.m_params);
        }

        arHash.push(this.m_key);

        return crypto.createHash('sha256')
                    .update(arHash.join(':'))
                    .digest('hex')
                    .toUpperCase();
    }
}

module.exports = Payeer;