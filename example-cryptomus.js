
const express = require('express');
const bodyParser = require('body-parser');
const QuickPos = require('./app');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(require('multer')().none());

const quickPos = new QuickPos({
  providers: {
    cryptomus: {
        merchantId: 'xxxx',
        paymentKey: 'xxxxx'
    }
  }
});

app.use(quickPos.middleware());

quickPos.providers['cryptomus'].createPayment({
    orderId: `ST${Date.now()}`,
    amount: String(123), //Sağlayıcı String istiyor.
    currency: 'USD',
    network: 'ETH',
    callbackUrl: 'https://yourdomain.com/webhook',
    returnUrl: 'https://yourdomain.com/return',
    lifetime: 3600,
    toCurrency: 'ETH'
})
.then(response => console.log(response))
.catch(error => console.error(error));

app.post('/cryptomusWebhook', quickPos.handleCallback('cryptomus'), (req, res) => {
    console.log('Payment result:', req.paymentResult);
    
    res.json({ status: 'success' });
});

app.listen(3000, () => console.log('Server started on http://localhost:3000'));
