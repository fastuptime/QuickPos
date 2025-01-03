const express = require('express');
const bodyParser = require('body-parser');
const QuickPos = require('quickpos');

const app = express();
app.use(bodyParser.json({ limit: '50mb', extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(require('multer')().none());

const quickPos = new QuickPos({
  providers: {
    payeer: {
        m_shop: 'XXXX',
        m_key: 'XXXXXX'
    }
  }
});

app.use(quickPos.middleware());

app.use(async (req, res, next) => {
    console.log('Middleware çalıştı');
    console.log(req.method, req.url);
    next();
});

(async () => {
    const payment = await quickPos.providers['payeer'].createPayment({
        orderId: 'S12345',
        amount: '0.01',
        currency: 'RUB',
        description: 'Test payment'
    });
    console.log(payment);
})();

app.post('/status', quickPos.handleCallback('payeer'), async (req, res) => {
    /*
    POST /status
    {
        status: 'success',
        orderId: 'S12345',
        amount: '0.01',
        currency: 'RUB',
        operationId: '2175845325',
        paymentDate: '29.12.2024 20:37:43'
    }
    Ödeme başarılı: {
        status: 'success',
        orderId: 'S12345',
        amount: '0.01',
        currency: 'RUB',
        operationId: 'xxxx',
        paymentDate: '29.12.2024 20:37:43'
    }
    */
    console.log(req.paymentResult);
    try {
        if (req.paymentResult.status === 'success') {
            console.log('Ödeme başarılı:', req.paymentResult);
        } else {
            console.error('Ödeme başarısız:', req.paymentResult);
        }
    } catch (error) {
        console.error('Webhook hatası:', error);
        res.status(400).json({error: error.message});
    }
});


const PORT = 80;
app.listen(PORT, () => {
  console.log(`Webhook server running on port ${PORT}`);
});