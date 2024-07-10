# 💳 QuickPos 🚀

QuickPos, farklı ödeme sağlayıcılarını destekleyen güçlü bir ödeme entegrasyon modülüdür. Şu anda PayTR sağlayıcısını desteklemektedir ve gelecekte birçok yeni sağlayıcı ile özellik eklemeyi planlamaktadır. Yol haritamıza göz atarak gelecek özellikleri keşfedebilirsiniz.

---

## ✨ Özellikler

- 🔌 **Çoklu Ödeme Sağlayıcı Desteği**: Birden fazla ödeme sağlayıcı ile uyumlu.
- 🛡️ **Güvenli Ödeme İşlemleri**: Güvenli ve sorunsuz ödeme işlemleri.
- 🔄 **Kolay Entegrasyon**: Hızlı ve basit entegrasyon.
- 📊 **Detaylı Ödeme Raporları**: Gelişmiş raporlama özellikleri.
- 💼 **İşletmeler için Özelleştirilebilir Çözümler**: Özel ihtiyaçlara yönelik çözümler.

---

## 📦 Kurulum 

```bash
npm install quickpos
```

---

## 🛠️ Kullanım

### 1. Sunucu Kurulumu

```javascript
const express = require('express');
const bodyParser = require('body-parser');
const QuickPos = require('quickpos');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const quickPos = new QuickPos({
  providers: {
    paytr: {
      merchantId: 'xXxxXxX',
      merchantKey: 'xXxxXxX',
      merchantSalt: 'xXxxXxX',
      mode: 'test',
    }
  },
});

// QuickPos middleware'ini ekleyin
app.use(quickPos.middleware());

// Ödeme oluşturma formu
app.get('/', (req, res) => {
    res.send(`
        <form action="/payment/paytr" method="post">
        <input type="text" name="amount" placeholder="Amount" required>
        <select name="currency" required>
            <option value="TL">TL</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
        </select>
        <input type="text" name="orderId" placeholder="Order ID" required>
        <button type="submit">Pay</button>
        </form>
    `);
});

// Ödeme oluşturma rotası
app.post('/payment/:provider', async (req, res) => {
  const { provider } = req.params;
  
  if (!req.quickPos[provider]) {
    return res.status(400).json({ error: 'Invalid payment provider' });
  }

  try {
    const result = await req.quickPos[provider].createPayment({
      name: 'Test Product',
      amount: req.body.amount,
      currency: req.body.currency,
      callback_link: `https://mylocalhostx.speedsmm.com/payment-callback/${provider}`,
      callback_id: req.body.orderId,
      maxInstallment: 1,
      expiry_date: '2024-12-25 17:00:00',
      email: 'test@gmail.com',
    });

    if (result.status === 'success') {
      res.json({ redirectUrl: result.data.url });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Callback rotası
app.post('/payment-callback/:provider', quickPos.handleCallback('paytr'), (req, res) => {
  console.log('Payment result:', req.paymentResult);
  
  if (req.paymentResult.status === 'success') {
    res.send('OK');
  } else {
    res.status(400).send('Payment failed');
  }
});

app.listen(80, () => {
  console.log('Server is running on port 80');
});
```

### 2. Konfigürasyon

`QuickPos` örneğini oluştururken ödeme sağlayıcılarını yapılandırın:

```javascript
const quickPos = new QuickPos({
  providers: {
    paytr: {
      merchantId: 'xXxxXxX',
      merchantKey: 'xXxxXxX',
      merchantSalt: 'xXxxXxX',
      mode: 'test',
    }
  },
});
```

---

## Desteklenen Ödeme Sağlayıcıları 🏦

- PayTR

---

## Yol Haritası 🛣️

### Gelecek Özellikler

- 🏦 Yeni ödeme sağlayıcıları: İyzico, Vallet, Shipy
- 🌐 Çoklu dil desteği
- 💸 Çoklu para birimi desteği
- 📝 Gelişmiş dökümantasyon

### İlerleme Durumu

- [x] PayTR entegrasyonu
- [ ] İyzico entegrasyonu
- [ ] Vallet entegrasyonu
- [ ] Shipy entegrasyonu
- [ ] Shopinext entegrasyonu
- [ ] Paywant entegrasyonu
- [ ] Payizone entegrasyonu
- [ ] Weepay entegrasyonu
- [ ] Paynet entegrasyonu
- [ ] Stripe entegrasyonu
- [ ] PayPal entegrasyonu

---

## Katkıda Bulunma 🤝

Katkılarınızı bekliyoruz! Lütfen [katkı yönergelerimizi](CONTRIBUTING.md) okuyun.