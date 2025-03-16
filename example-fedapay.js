const express = require('express');
const bodyParser = require('body-parser');
const QuickPos = require('./app');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const quickPos = new QuickPos({
  providers: {
    fedapay: {
      apiKey: 'sk_sandbd_92HEJoHiqT3g9dS6', // Sandbox API Key
      environment: 'sandbox', // 'sandbox' veya 'live'
      debug: true // Geliştirme aşamasında hata ayıklama için
    }
  }
});

// QuickPos middleware'ini ekle
app.use(quickPos.middleware());

// Ana sayfa - Ödeme form sayfası
app.get('/', (req, res) => {
  res.send(`
    <h1>FedaPay Ödeme Testi</h1>
    <form action="/create-payment" method="post">
      <div>
        <label>Tutar:</label>
        <input type="text" name="amount" value="1000" required>
      </div>
      <div>
        <label>Para Birimi:</label>
        <select name="currency" required>
          <option value="XOF">XOF (West African CFA franc)</option>
          <option value="USD">USD (US Dollar)</option>
          <option value="EUR">EUR (Euro)</option>
        </select>
      </div>
      <div>
        <label>Ödeme Modu:</label>
        <select name="mode">
          <option value="">Seçiniz (Opsiyonel)</option>
          <option value="mtn">MTN Mobile Money</option>
          <option value="moov">Moov Money</option>
          <option value="mtn_open">MTN Open API</option>
          <option value="moov_open">Moov Open API</option>
          <option value="card">Kredi Kartı</option>
        </select>
      </div>
      <div>
        <label>Sipariş No:</label>
        <input type="text" name="orderId" value="ORDER-${Date.now()}" required>
      </div>
      <div>
        <label>Açıklama:</label>
        <input type="text" name="description" value="Test Ödemesi" required>
      </div>
      <div>
        <label>E-posta:</label>
        <input type="email" name="email" value="customer@example.com">
      </div>
      <div>
        <label>İsim:</label>
        <input type="text" name="firstName" value="John">
      </div>
      <div>
        <label>Soyisim:</label>
        <input type="text" name="lastName" value="Doe">
      </div>
      <div>
        <label>Telefon Numarası:</label>
        <input type="text" name="phone" value="90090909">
      </div>
      <div>
        <label>Telefon Ülkesi:</label>
        <select name="phoneCountry">
          <option value="BJ">Benin (BJ)</option>
          <option value="TG">Togo (TG)</option>
          <option value="CI">Côte d'Ivoire (CI)</option>
          <option value="SN">Senegal (SN)</option>
        </select>
      </div>
      <button type="submit">Ödeme Oluştur</button>
    </form>
  `);
});

// Ödeme oluşturma rotası
app.post('/create-payment', async (req, res) => {
  try {
    const result = await quickPos.providers['fedapay'].createPayment({
      amount: req.body.amount,
      currency: req.body.currency,
      description: req.body.description,
      orderId: req.body.orderId,
      email: req.body.email,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phone: req.body.phone,
      phoneCountry: req.body.phoneCountry,
      mode: req.body.mode || null,
      successUrl: `http://${req.headers.host}/success`,
      failUrl: `http://${req.headers.host}/cancel`,
      notificationUrl: `http://${req.headers.host}/webhook/fedapay`
    });

    if (result.status === 'success') {
      console.log('Ödeme başarıyla oluşturuldu:', result.data);
    //   Ödeme başarıyla oluşturuldu: {
    //     id: 307688,
    //     transactionId: 307688,
    //     reference: 'trx_Q6E_1742143079406',
    //     url: 'https://sandbox-process.fedapay.com/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjMwNzY4OCwiZXhwIjoxNzQyMjI5NDgwfQ.ZaGo6MmkdLf1eeYKH7KhnjFBBYKaiGhYOWQ9aSy8b38',
    //     token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjMwNzY4OCwiZXhwIjoxNzQyMjI5NDgwfQ.ZaGo6MmkdLf1eeYKH7KhnjFBBYKaiGhYOWQ9aSy8b38'
    //   }
      // Ödeme sayfasına yönlendir
      res.redirect(result.data.url);
    } else {
      res.status(400).json({ error: 'Ödeme oluşturulamadı', details: result });
    }
  } catch (error) {
    console.error('Ödeme oluşturma hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook işleme rotası
app.post('/webhook/fedapay', async (req, res) => {
  try {
    const notification = req.body;
    console.log('Webhook çağrısı alındı:', notification);

    // FedaPay tarafından gönderilen signature header'i kontrol et
    const signature = req.headers['fedapay-signature'];
    
    if (signature) {
      const isValidSignature = await quickPos.providers['fedapay'].verifySignature(
        req.body,
        signature
      );
      
      if (!isValidSignature) {
        console.error('Geçersiz imza');
        return res.status(400).send('Invalid signature');
      }
    }
    
    // İşlemi doğrula ve işle
    const paymentResult = await quickPos.providers['fedapay'].handleCallback(notification);
    
    console.log('Ödeme sonucu:', paymentResult);
    
    if (paymentResult.status === 'success') {
      // Burada sipariş durumunu güncelleyebilir, veritabanı işlemleri yapabilirsiniz
      console.log(`Ödeme başarılı: Sipariş #${paymentResult.orderId}, Tutar: ${paymentResult.amount} ${paymentResult.currency}`);
      
      // FedaPay başarılı yanıt bekliyor
      res.status(200).send('OK');
    } else {
      // Başarısız işlem
      res.status(400).send('FAIL');
    }
  } catch (error) {
    console.error('Webhook hatası:', error);
    res.status(500).send('ERROR');
  }
});

// Başarılı ödeme sayfası
app.get('/success', (req, res) => {
  res.send(`
    <h1>Ödemeniz başarıyla tamamlandı!</h1>
    <p>İşlem numarası: ${req.query.transaction_id || 'Belirtilmedi'}</p>
    <a href="/">Ana Sayfaya Dön</a>
  `);
});

// İptal edilen/başarısız ödeme sayfası
app.get('/cancel', (req, res) => {
  res.send(`
    <h1>Ödeme işlemi iptal edildi veya başarısız oldu!</h1>
    <a href="/">Tekrar Deneyin</a>
  `);
});

// İşlem sorgulama
app.get('/transaction/:id', async (req, res) => {
  try {
    const result = await quickPos.providers['fedapay'].getTransaction(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// İşlem listesi
app.get('/transactions', async (req, res) => {
  try {
    const result = await quickPos.providers['fedapay'].listTransactions({
      page: req.query.page || 1,
      per_page: req.query.per_page || 10
    });
    
    res.send(`
      <h1>Son İşlemler</h1>
      <pre>${JSON.stringify(result.data, null, 2)}</pre>
      <p><a href="/">Ana Sayfaya Dön</a></p>
    `);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 80;
app.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışıyor`);
});
