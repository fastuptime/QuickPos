const express = require('express');
const bodyParser = require('body-parser');
const QuickPos = require('./app');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const quickPos = new QuickPos({
  providers: {
    esnekpos: {
      merchant: 'TEST1234',
      merchantKey: '4oK26hK8MOXrIV1bzTRVPA==',
      testMode: true,
      debug: false
    }
  }
});

app.use(quickPos.middleware());

// Ana sayfa - Ödeme formu
app.get('/', (req, res) => {
  res.send(`
    <h1>EsnekPOS Ödeme Testi</h1>
    <h2>Ortak Ödeme Sayfası</h2>
    <form action="/create-common-payment" method="post">
      <div>
        <label>Tutar:</label>
        <input type="text" name="amount" value="100.00" required>
      </div>
      <div>
        <label>Para Birimi:</label>
        <select name="currency" required>
          <option value="TRY">TRY</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
      </div>
      <div>
        <label>Sipariş Numarası:</label>
        <input type="text" name="orderId" value="ORDER-${Date.now()}" required>
      </div>
      <div>
        <label>Açıklama:</label>
        <input type="text" name="description" value="Test ödemesi" required>
      </div>
      <div>
        <label>E-posta:</label>
        <input type="email" name="email" value="musteri@example.com" required>
      </div>
      <button type="submit">Ortak Ödeme Sayfası Oluştur</button>
    </form>
    
    <hr>
    
    <h2>3D Secure Ödeme</h2>
    <form action="/create-3d-payment" method="post">
      <div>
        <label>Tutar:</label>
        <input type="text" name="amount" value="100.00" required>
      </div>
      <div>
        <label>Para Birimi:</label>
        <select name="currency" required>
          <option value="TRY">TRY</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
      </div>
      <div>
        <label>Sipariş Numarası:</label>
        <input type="text" name="orderId" value="ORDER-${Date.now()}" required>
      </div>
      <div>
        <label>Açıklama:</label>
        <input type="text" name="description" value="Test ödemesi" required>
      </div>
      <div>
        <label>E-posta:</label>
        <input type="email" name="email" value="musteri@example.com" required>
      </div>
      
      <h3>Kart Bilgileri</h3>
      <div>
        <label>Kart Numarası:</label>
        <input type="text" name="cardNumber" value="4159562885391991" required>
      </div>
      <div>
        <label>Son Kullanma Ay:</label>
        <input type="text" name="expireMonth" value="12" required>
      </div>
      <div>
        <label>Son Kullanma Yıl:</label>
        <input type="text" name="expireYear" value="2025" required>
      </div>
      <div>
        <label>CVV:</label>
        <input type="text" name="cvv" value="123" required>
      </div>
      <div>
        <label>Kart Sahibi:</label>
        <input type="text" name="cardOwner" value="John Doe" required>
      </div>
      <div>
        <label>Taksit Sayısı:</label>
        <select name="installment">
          <option value="1">Tek Çekim</option>
          <option value="2">2 Taksit</option>
          <option value="3">3 Taksit</option>
          <option value="6">6 Taksit</option>
        </select>
      </div>
      
      <button type="submit">3D Secure Ödeme Başlat</button>
    </form>
  `);
});

// Ortak ödeme sayfası oluşturma rotası
app.post('/create-common-payment', async (req, res) => {
  try {
    const result = await quickPos.providers['esnekpos'].createPayment({
      amount: req.body.amount,
      currency: req.body.currency,
      orderId: req.body.orderId,
      description: req.body.description,
      email: req.body.email,
      ip: '195.142.21.81', // Opsiyonel
      phone: '5555555555',
      city: 'İstanbul',
      state: 'Kadıköy',
      address: 'Örnek Mahallesi, Örnek Sokak No: 1',
      name: 'Müşteri',
      surname: 'Test',
      callbackUrl: `http://${req.headers.host}/webhook-callback`
    });

    if (result.status === 'success') {
      console.log('Ödeme sayfası başarıyla oluşturuldu:', result.data);
    //   Ödeme sayfası başarıyla oluşturuldu: {
    //     transactionId: 'ORDER-1742140882252',
    //     url: 'https://postest.esnekpos.com/Pages/CommonPaymentNew.aspx?hash=837e4aafc61c9e1e9a074922b165fd540b0e4374db4740c511b51f5efb3b9b49',
    //     id: '29386',
    //     html: null
    //   }
      res.redirect(result.data.url);
    } else {
      res.status(400).json({ error: 'Ödeme sayfası oluşturulamadı', details: result });
    }
  } catch (error) {
    console.error('Ödeme sayfası oluşturma hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3D Secure ödeme başlatma rotası
app.post('/create-3d-payment', async (req, res) => {
  try {
    const result = await quickPos.providers['esnekpos'].createPayment({
      amount: req.body.amount,
      currency: req.body.currency,
      orderId: req.body.orderId,
      description: req.body.description,
      email: req.body.email,
      name: 'Müşteri',
      surname: 'Test',
      callbackUrl: `http://${req.headers.host}/webhook-callback`,
      creditCard: {
        number: req.body.cardNumber,
        expireMonth: req.body.expireMonth,
        expireYear: req.body.expireYear,
        cvv: req.body.cvv,
        owner: req.body.cardOwner,
        installment: req.body.installment
      }
    });

    if (result.status === 'success') {
      console.log('3D Secure ödeme başarıyla başlatıldı:', result.data);
      
      if (result.data.html) {
        // 3D Secure form HTML'i varsa göster
        res.send(`
          <h1>3D Secure İşlemi</h1>
          <p>3D Secure doğrulama sayfasına yönlendiriliyorsunuz...</p>
          ${result.data.html}
        `);
      } else {
        // URL varsa yönlendir
        res.redirect(result.data.url);
      }
    } else {
      res.status(400).json({ error: 'Ödeme başlatılamadı', details: result });
    }
  } catch (error) {
    console.error('Ödeme başlatma hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook callback
app.post('/webhook-callback', quickPos.handleCallback('esnekpos'), (req, res) => {
  try {
    console.log('Ödeme sonucu:', req.paymentResult);
    // Ödeme sonucu: {
    //     status: 'success',
    //     orderId: 'ORDER-1742140882252',
    //     transactionId: 'ORDER-1742140882252',
    //     amount: 101,
    //     currency: 'TRY',
    //     paymentType: 'creditcard',
    //     date: '2025-03-16T16:12:32.022Z'
    //   }
    if (req.paymentResult && req.paymentResult.status === 'success') {
      // Burada ödemeyi onaylayabilir, veritabanına kaydedebilirsiniz
      res.status(200).send('OK');
    } else {
      console.error('Ödeme başarısız:', req.paymentResult || 'Sonuç yok');
      res.status(400).send('Payment failed');
    }
  } catch (error) {
    console.error('Webhook hatası:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Ödeme durumu sorgulama
app.get('/check-payment/:orderRefNumber', async (req, res) => {
  try {
    const result = await quickPos.providers['esnekpos'].getPaymentStatus(req.params.orderRefNumber);
    res.json(result);
  } catch (error) {
    console.error('Ödeme sorgulama hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// İade işlemi
app.post('/refund-payment', async (req, res) => {
  try {
    const { orderRefNumber, amount } = req.body;
    const result = await quickPos.providers['esnekpos'].refundPayment(orderRefNumber, amount);
    res.json(result);
  } catch (error) {
    console.error('İade işlemi hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 80;
app.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışıyor`);
});
