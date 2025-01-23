const express = require('express');
const bodyParser = require('body-parser');
const QuickPos = require('./app');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
// app.use(require('multer')().none());

const quickPos = new QuickPos({
  providers: {
    bufpay: {
      appId: 'xxxx',
      appSecret: 'xxx'
    }
  }
});

app.use(quickPos.middleware());

quickPos.providers['bufpay'].createPayment({
  name: 'Product Name',
  payType: 'alipay', 
  price: '100.00',
  orderId: 'ORDER123',
  orderUid: 'user@example.com',
  notifyUrl: 'https://your-domain.com/webhook'
})
.then(response => console.log(response))
.catch(error => console.error(error));

app.post('/shopierWebhook', quickPos.handleCallback('shopier'), (req, res) => {
  try {
    console.log('Payment result:', req.paymentResult.data.chartDetails);
    /*
    Payment result: {
    status: 'success',
      data: {
        email: 'fastuptime@gmail.com',
        orderId: '313758163',
        currency: 0,
        price: '1',
        buyerName: 'Can',
        buyerSurname: 'Kaya',
        productId: 31857020,
        productCount: 1,
        customerNote: '',
        productList: '31857020',
        chartDetails: [ [Object] ],
        isTest: 1
      }
    }
    */
    if (!(req.body.res && req.body.hash)) {
      return res.status(400).send('missing parameter');
    }

    // İşlem başarılı
    res.send('success');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('error');
  }
});

const PORT = 80;
app.listen(PORT, () => {
  console.log(`Webhook server running on port ${PORT}`);
});