const express = require('express');
const bodyParser = require('body-parser');
const QuickPos = require('./app');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const quickPos = new QuickPos({
  providers: {
    anypay: {
      merchantId: '16219',              // Merchant ID
      secretKey: 'xxx', // Gizli anahtar
      apiId: 'xxxx',           // API ID (isteğe bağlı)
      apiKey: 'xxx',          // API anahtarı (isteğe bağlı)
      debug: true // Geliştirme aşamasında hata ayıklama için
    }
  }
});

app.use(quickPos.middleware());

// Ana sayfa - Ödeme formları
app.get('/', (req, res) => {
  res.send(`
    <h1>AnyPay Ödeme Testi</h1>
    <h2>Form Yöntemi ile Ödeme</h2>
    <form action="/create-payment-form" method="post">
      <div>
        <label>Miktar:</label>
        <input type="text" name="amount" value="10.00" required>
      </div>
      <div>
        <label>Para Birimi:</label>
        <select name="currency" required>
          <option value="RUB">RUB</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="UAH">UAH</option>
          <option value="BYN">BYN</option>
          <option value="KZT">KZT</option>
        </select>
      </div>
      <div>
        <label>Ödeme Yöntemi:</label>
        <select name="method" required>
          <option value="card">Kredi Kartı</option>
          <option value="qiwi">Qiwi</option>
          <option value="payeer">Payeer</option>
          <option value="btc">Bitcoin</option>
          <option value="eth">Ethereum</option>
          <option value="ltc">Litecoin</option>
        </select>
      </div>
      <div>
        <label>Email:</label>
        <input type="email" name="email" value="customer@example.com" required>
      </div>
      <div>
        <label>Açıklama:</label>
        <input type="text" name="desc" value="Test ürünü" required>
      </div>
      <button type="submit">Form ile Ödeme Oluştur</button>
    </form>
    
    <hr>
    
    <h2>API Yöntemi ile Ödeme (API Key gerektirir)</h2>
    <form action="/create-payment-api" method="post">
      <div>
        <label>Miktar:</label>
        <input type="text" name="amount" value="10.00" required>
      </div>
      <div>
        <label>Para Birimi:</label>
        <select name="currency" required>
          <option value="RUB">RUB</option>
          <option value="USD">USD</option>
        </select>
      </div>
      <div>
        <label>Ödeme Yöntemi:</label>
        <select name="method" required>
          <option value="card">Kredi Kartı</option>
          <option value="qiwi">Qiwi</option>
        </select>
      </div>
      <div>
        <label>Email:</label>
        <input type="email" name="email" value="customer@example.com" required>
      </div>
      <div>
        <label>Açıklama:</label>
        <input type="text" name="desc" value="API Test ürünü" required>
      </div>
      <button type="submit">API ile Ödeme Oluştur</button>
    </form>
    
    <hr>
    
    <h3>Diğer İşlemler</h3>
    <ul>
      <li><a href="/balance">Bakiye Görüntüle</a></li>
      <li><a href="/rates">Döviz Kurları</a></li>
      <li><a href="/commissions">Komisyon Oranları</a></li>
      <li><a href="/notification-ips">Bildirim IP Adresleri</a></li>
      <li><a href="/payments">Son Ödemeler</a></li>
    </ul>
  `);
});

// Form yöntemiyle ödeme oluşturma
app.post('/create-payment-form', async (req, res) => {
  try {
    const result = await quickPos.providers['anypay'].createPayment({
      amount: req.body.amount,
      currency: req.body.currency,
      orderId: `ORDER${Date.now()}`,
      desc: req.body.desc,
      method: req.body.method,
      email: req.body.email,
      successUrl: `http://${req.headers.host}/success`,
      failUrl: `http://${req.headers.host}/fail`,
      notificationUrl: `http://${req.headers.host}/webhook/anypay`,
      returnFormHtml: true // Form HTML'ini döndür
    });

    if (result.status === 'success') {
      // HTML formunu doğrudan göster
      console.log('Ödeme formu oluşturuldu');
      res.send(`
        <h1>AnyPay Ödeme Formu</h1>
        <p>Sipariş No: ${result.data.pay_id}</p>
        <div id="payment-form">${result.data.formHtml}</div>
        <p><a href="/">Ana Sayfaya Dön</a></p>
        <script>
          // Form otomatik olarak gönderilsin
          document.addEventListener('DOMContentLoaded', function() {
            document.querySelector('form').submit();
          });
        </script>
      `);
    } else {
      res.status(400).json({ error: 'Ödeme formu oluşturulamadı', details: result });
    }
  } catch (error) {
    console.error('Ödeme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// API yöntemiyle ödeme oluşturma
app.post('/create-payment-api', async (req, res) => {
  try {
    const result = await quickPos.providers['anypay'].createPayment({
      amount: req.body.amount,
      currency: req.body.currency,
      orderId: `ORDER${Date.now()}`,
      desc: req.body.desc,
      method: req.body.method,
      email: req.body.email,
      successUrl: `http://${req.headers.host}/success`,
      failUrl: `http://${req.headers.host}/fail`,
      notificationUrl: `http://${req.headers.host}/webhook/anypay`,
      useApi: true // API yöntemini kullan
    });

    if (result.status === 'success') {
      console.log('API ile ödeme bağlantısı oluşturuldu:', result.data.url);
      res.redirect(result.data.url);
    } else {
      res.status(400).json({ error: 'API ile ödeme oluşturulamadı', details: result });
    }
  } catch (error) {
    console.error('API ödeme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook işleme
app.post('/webhook/anypay', async (req, res) => {
  try {
    const notification = req.body;
    const ipAddress = req.ip;
    
    console.log('Webhook çağrısı alındı:', notification);
    console.log('IP Adresi:', ipAddress);
    
    // IP adresini kontrol et (isteğe bağlı)
    const validIPs = ['185.162.128.38', '185.162.128.39', '185.162.128.88'];
    if (!validIPs.includes(ipAddress)) {
      console.warn('Uyarı: İstek bilinen bir Anypay IP adresinden gelmiyor');
    }
    
    // İmza doğrulaması
    const isValid = quickPos.providers['anypay'].validateNotification(notification, ipAddress);
    
    if (!isValid) {
      console.error('Geçersiz imza veya IP adresi');
      return res.status(400).send('Invalid signature or IP');
    }
    
    // İşlemi doğrula ve işle
    const paymentResult = await quickPos.providers['anypay'].handleCallback(notification);
    
    console.log('Ödeme sonucu:', paymentResult);
    
    if (paymentResult.status === 'success') {
      // Burada sipariş durumunu güncelleyebilir, veritabanı işlemleri yapabilirsiniz
      console.log(`Ödeme başarılı: Sipariş #${paymentResult.orderId}, Tutar: ${paymentResult.amount} ${paymentResult.currency}`);
      
      // AnyPay başarılı yanıt bekliyor
      res.send('OK');
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
  res.send('<h1>Ödemeniz başarıyla tamamlandı!</h1><a href="/">Ana Sayfaya Dön</a>');
});

// Başarısız ödeme sayfası
app.get('/fail', (req, res) => {
  res.send('<h1>Ödeme işlemi başarısız oldu!</h1><a href="/">Tekrar Deneyin</a>');
});

// Bakiye sorgulama
app.get('/balance', async (req, res) => {
  try {
    const balance = await quickPos.providers['anypay'].getBalance();
    res.json(balance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Döviz kurları
app.get('/rates', async (req, res) => {
  try {
    const rates = await quickPos.providers['anypay'].getRates();
    
    res.send(`
      <h1>AnyPay Döviz Kurları</h1>
      <h2>Giriş Kurları (In)</h2>
      <pre>${JSON.stringify(rates.in, null, 2)}</pre>
      <h2>Çıkış Kurları (Out)</h2>
      <pre>${JSON.stringify(rates.out, null, 2)}</pre>
      <p><a href="/">Ana Sayfaya Dön</a></p>
    `);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Komisyon oranları
app.get('/commissions', async (req, res) => {
  try {
    const commissions = await quickPos.providers['anypay'].getCommissions();
    res.send(`
      <h1>AnyPay Komisyon Oranları</h1>
      <pre>${JSON.stringify(commissions, null, 2)}</pre>
      <p><a href="/">Ana Sayfaya Dön</a></p>
    `);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bildirim IP adresleri
app.get('/notification-ips', async (req, res) => {
  try {
    const ips = await quickPos.providers['anypay'].getNotificationIPs();
    res.send(`
      <h1>AnyPay Bildirim IP Adresleri</h1>
      <p>Şu IP adreslerinden gelen bildirimler kabul edilmeli:</p>
      <ul>
        ${ips.ip.map(ip => `<li>${ip}</li>`).join('')}
      </ul>
      <p><a href="/">Ana Sayfaya Dön</a></p>
    `);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ödemeleri listeleme
app.get('/payments', async (req, res) => {
  try {
    const payments = await quickPos.providers['anypay'].getPayments({
      offset: 0,
      count: 10
    });
    
    res.send(`
      <h1>Son Ödemeler</h1>
      <p>Toplam Ödeme: ${payments.total}</p>
      <table border="1" cellpadding="5" cellspacing="0">
        <tr>
          <th>İşlem ID</th>
          <th>Sipariş ID</th>
          <th>Tutar</th>
          <th>Para Birimi</th>
          <th>Durum</th>
          <th>Tarih</th>
        </tr>
        ${payments.payments.map(p => `
          <tr>
            <td>${p.transaction_id}</td>
            <td>${p.pay_id}</td>
            <td>${p.amount}</td>
            <td>${p.currency}</td>
            <td>${p.status}</td>
            <td>${p.date}</td>
          </tr>
        `).join('')}
      </table>
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
