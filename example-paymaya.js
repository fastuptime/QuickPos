// package.json'a "paymaya-integration" modülünü eklemeyi unutmayın
// npm install paymaya-integration

const express = require('express');
const bodyParser = require('body-parser');
const QuickPos = require('./app');
const PayMaya = require('./lib/paymaya');

const app = express();
app.use(require('multer')().none());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const quickPos = new QuickPos({
  providers: {
    paymaya: {
      publicKey: 'pk-NCLk7JeDbX1m22ZRMDYO9bEPowNWT5J4aNIKIbcTy2a', // Test public key
      secretKey: 'sk-8MqXdZYWV9UJB92Mc0i149CtzTWT7BYBQeiarM27iAi', // Test secret key
      isProduction: false
    }
  }
});

app.use(quickPos.middleware());

// Ödeme form sayfası
app.get('/', (req, res) => {
  res.send(`
    <h1>PayMaya Ödeme Testi</h1>
    <form action="/create-payment" method="post">
      <div>
        <label>Ürün Adı:</label>
        <input type="text" name="name" value="Test Ürünü" required>
      </div>
      <div>
        <label>Tutar:</label>
        <input type="number" name="amount" value="1000" required>
      </div>
      <div>
        <label>Para Birimi:</label>
        <select name="currency" required>
          <option value="PHP">PHP</option>
          <option value="USD">USD</option>
        </select>
      </div>
      <div>
        <label>Sipariş ID:</label>
        <input type="text" name="orderId" value="ORDER-${Date.now()}">
      </div>
      <button type="submit">Ödeme Oluştur</button>
    </form>
  `);
});

// Ödeme oluşturma rotası
app.post('/create-payment', async (req, res) => {
  try {
    const result = await quickPos.providers['paymaya'].createPayment({
      name: req.body.name,
      amount: req.body.amount,
      currency: req.body.currency,
      orderId: req.body.orderId,
      successUrl: `http://${req.headers.host}/payment-callback?checkoutId=${req.body.orderId}`,
      failureUrl: `http://${req.headers.host}/`,
      cancelUrl: `http://${req.headers.host}/`
    });

    if (result.status === 'success') {
      console.log('Ödeme başarıyla oluşturuldu:', result.data);
      res.redirect(result.data.url);
    } else {
      res.status(400).json({ error: 'Ödeme oluşturulamadı', details: result });
    }
  } catch (error) {
    console.error('Ödeme oluşturma hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Başarılı ödeme geri dönüş noktası
app.get('/payment-callback', quickPos.handleCallback('paymaya'), (req, res) => {
  if (req.paymentResult && req.paymentResult.status === 'success') {
    console.log('Ödeme sonucu:', req.paymentResult);
    // Ödeme sonucu: {
    //     status: 'success',
    //     id: 'bef67078-eae7-4a13-96f3-4abb9a131444',
    //     orderId: 'ORDER-1742130974673',
    //     amount: '1000',
    //     currency: 'PHP'
    //   }
    return res.redirect('/');
    res.send(`<h1>Ödeme Başarılı</h1>
              <p>Sipariş No: ${req.paymentResult.orderId}</p>
    `);
  } else {
    res.status(400).json({ error: 'Ödeme başarısız', details: req.paymentResult });
  }
});

// Başarısız ve iptal edilen ödeme dönüş sayfaları
app.get('/payment-failed', (req, res) => {
  res.send('<h1>Ödeme Başarısız</h1><p>İşlem tamamlanamadı.</p>');
});

app.get('/payment-canceled', (req, res) => {
  res.send('<h1>Ödeme İptal Edildi</h1><p>İşlem kullanıcı tarafından iptal edildi.</p>');
});

const PORT = process.env.PORT || 80;
app.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışıyor`);
});