const PaparaClient = require('./lib/papara');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

const papara = new PaparaClient({
    apiKey: 'xxxx',
    merchantSecretKey: 'xxxx'
}, true);

app.post('/callback', async (req, res) => {
    try {
        const result = await papara.handleCallback(req.body);
        console.log(result);
        /*
        {
            status: 'success',
            orderId: '1234',
            uuid: '39061b51-7688-4287-9f90-5b1aa4a25178',
            amount: 1,
            currency: 0,
            paymentMethod: 0
        }
        */
        res.send('OK');
    } catch (error) {
        res.status(400).send(error.message);
    }
});

app.listen(80, () => console.log('Server started'));

// Ödeme oluşturma örneği
(async () => {
    const payment = await papara.createPayment({
        amount: 1,
        nameSurname: 'Test Customer',
        referenceId: '1234',
        currency: 'USD', // TRY, USD, EUR
        orderDescription: 'Test Payment',
        notificationUrl: 'https://test.dalamangoldtaxi.net/callback',
        redirectUrl: 'https://your-domain.com'
    });
    /*


    {
        data: {
            merchant: {
                id: '2f73fd0a-d480-4f6f-a2a3-4c663ffbc26d',
                balances: [Array],
                legalName: 'TEST2',
                iconUrl: null,
                brandName: 'TEST2',
                allowedPaymentTypes: [Array],
                allowingGuestCheckout: true,
                allowingPaparaCheckout: false,
                isCorporateCardsListOnPaparaAppEnabled: true,
                atmDepositEnabled: false
            },
            userName: null,
            relatedTransactions: [],
            totalRefundedAmount: 0,
            id: 'f825a55e-598c-411b-af80-a729fd3c13d1',
            createdAt: '2025-01-03T21:59:38.1511487',
            merchantId: '2f73fd0a-d480-4f6f-a2a3-4c663ffbc26d',
            userId: null,
            paymentMethod: 0,
            paymentMethodDescription: null,
            referenceId: '1234',
            orderDescription: 'Test Payment',
            status: 0,
            statusDescription: null,
            amount: 1,
            fee: 0,
            currency: 0,
            currencyInfo: {
            currencyEnum: 0,
            symbol: '₺',
            code: 'TRY',
            number: 949,
            preferredDisplayCode: 'TL',
            name: 'Türk Lirası',
            isCryptocurrency: false,
            isInternationalMoneyTransferCurrency: false,
            precision: 2,
            iconUrl: 'https://dkto9gpxgolik.cloudfront.net/icons/currencies/try.svg',
            flagUrl: 'https://dkto9gpxgolik.cloudfront.net/icons/currencies/try_flag.png',
            currencyEnumIso: 949,
            isMetalCurrency: false
            },
            notificationUrl: 'https://your-domain.com/callback',
            failNotificationUrl: null,
            notificationDone: false,
            paymentUrl: 'https://test.papara.com/checkout/f825a55e-598c-411b-af80-a729fd3c13d1',
            merchantSecretKey: null,
            remainingRefundAmount: null,
            returningRedirectUrl: 'https://your-domain.com?paymentId=f825a55e-598c-411b-af80-a729fd3c13d1&referenceId=1234&status=0&amount=1&paymentId=f825a55e-598c-411b-af80-a729fd3c13d1&referenceId=1234&status=0&amount=1',
            errorCode: null,
            errorMessage: null,
            turkishNationalId: 0,
            secureType: 1,
            basketUrl: null
        },
        succeeded: true
        }
    */

    // console.log(payment);
    console.log(payment.data.paymentUrl);   
})();