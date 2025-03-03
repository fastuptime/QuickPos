const express = require('express');
const bodyParser = require('body-parser');
const QuickPos = require('quickpos');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(require('multer')().none());

const quickPos = new QuickPos({
  providers: {
    shopier: {
      pat: 'xxxxx',
      username: 'xxxxx',
      key: 'xxxxx'
    }
  }
});

app.use(quickPos.middleware());

quickPos.providers['shopier'].createPayment({
  type: 'digital',
  priceData: {
    currency: 'TRY',
    price: '1'
  },
  shippingPayer: 'sellerPays',
  title: 'Add Balance',
  media: [{
    type: 'image',
    placement: 1,
    url: 'https://cdn.shopier.app/pictures_mid/speedsmm_21561f0e-2331-4611-8e93-2b020b1b7f92.png'
  }],
  stockQuantity: 1,
  description: 'Add balance to your account'
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