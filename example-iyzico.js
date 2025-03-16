const express = require('express');
const bodyParser = require('body-parser');
const QuickPos = require('./app');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const quickPos = new QuickPos({
  providers: {
    iyzico: {
      apiKey: 'sandbox-x',
      secretKey: 'sandbox-x',
      uri: 'https://sandbox-api.iyzipay.com' // Canlı ortam için: 'https://api.iyzipay.com'
    }
  }
});

app.use(quickPos.middleware());

// Ödeme oluşturma örneği
app.get('/', async (req, res) => {
  try {
    const result = await quickPos.providers['iyzico'].createPayment({
      name: 'Test Product',
      amount: '100.00',
      currency: 'TRY',
      callbackUrl: 'https://test.dalamangoldtaxi.net/iyzico-callback',
      email: 'customer@example.com',
      buyerName: 'John',
      buyerSurname: 'Doe',
      address: 'Test Address',
      city: 'Istanbul',
      country: 'Turkey',
      zipCode: '34000'
    });

    if (result.status === 'success') {
      // Ödeme linkini doğrudan yönlendirme veya JSON yanıtı olarak döndürebilirsiniz
      console.log('Ödeme linki oluşturuldu:', result.data.url);
      
      // Seçenek 1: Link bilgisini JSON olarak döndür
      res.json({
        status: 'success',
        redirectUrl: result.data.url,
        token: result.data.token
      });
      
      // Seçenek 2: Doğrudan ödeme sayfasına yönlendir
      // res.redirect(result.data.url);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Ödeme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Callback rotası
app.post('/iyzico-callback', quickPos.handleCallback('iyzico'), (req, res) => {
  console.log('Ödeme sonucu:', req.paymentResult);
  /*
  Ödeme sonucu: Ödeme sonucu: {
  status: 'success',
  orderId: 'order_1742131444461',
  amount: 100,
  currency: 'TRY',
  paymentId: '23770523',
  paymentType: 'CREDIT_CARD',
  paymentTransactionId: '2b839c1c-7fba-4580-8303-29f78c4228dd',
  installment: 1
}
  */

  // Başarılı ödeme sonrası yönlendirme
  if (req.paymentResult && req.paymentResult.status === 'success') {
    res.redirect('/payment-success');
  } else {
    res.redirect('/payment-failed');
  }
});

// Ayrıca GET isteği ile de callback'i işleyebilmek için
app.get('/iyzico-callback', quickPos.handleCallback('iyzico'), (req, res) => {
  if (req.paymentResult && req.paymentResult.status === 'success') {
    res.redirect('/payment-success');
  } else {
    res.redirect('/payment-failed');
  }
});

app.get('/payment-success', (req, res) => {
  res.send('Ödeme başarıyla tamamlandı!');
});

app.get('/payment-failed', (req, res) => {
  res.send('Ödeme başarısız oldu!');
});

app.listen(80, () => {
  console.log('Server is running on port 80');
});
