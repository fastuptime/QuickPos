const express = require('express');
const bodyParser = require('body-parser');
const QuickPos = require('./app');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const quickPos = new QuickPos({
  providers: {
    paytr: {
      merchantId: '347042',
      merchantKey: 'XxXxx',
      merchantSalt: 'XxxXxxX',
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
      // Diğer gerekli alanlar...
    });

    if (result.status === 'success') {
      console.log('Redirecting to:', result.data.url); // Redirecting to: https://www.paytr.com/link/RYncnsW
      console.log('Details:', result.data);
      // Details: {
      //   transactionId: 'RYncnsW',
      //   url: 'https://www.paytr.com/link/RYncnsW',
      //   id: 'RYncnsW',
      //   qr: 'iVBORw0KGgoAAAANSUhEUgAAAuQAAALkAQMAAAB9arImAAAABlBMVEX///8AAABVwtN+c+A+9/SN9AsBtGNWsJOZRe9v6AgoCd2XcSvlyRJkiRJkiRJkiTph7Wx93Xjne++Xkd+ZLmMTqfT6fS99Xe5jMNgDo8sFTqdTqfTd9ZjfVnVzoEdl/kFFsvodDqdTqevVuUtYh86nU6n0+lf6YGcxSdxo9PpdDqd/kGfbXaas7uVo9PpdDqd/v/vQ++CzA91GZ1Op9Pp2+vz+ufv+QLdjMtfRafT6XT6X9XLwG4XXP/V/HCg0+l0Op0+Xzr76D1vDG/x5SSn0+l0On0bPVaFFAuOyY1+9k10Op1Op++l9y3iIk/j22Z5nx9/DdPpdDqd/vf1QcotPomHl3r8zKbT6XQ6fUP9YX0gi72Hd6TT6XQ6fW+9m8OCPJKPuxlv8Xlq0+l0Op2+nT6sCvN85LbjbG86nU6n0+n3LfLZcR1CahcX+3ya2nQ6nU6n76XnyXvjYrOY6eWyfz+vtqDT6XQ6fUu9m+WxPrBnQ7wAdDqdTqfTzwVlfR/Ow3OzMzqdTqfT6deqkGIG5xvDYI/qMjqdTqfTd9afdxz+Vs5u+9DpdDqdvr3exvogLl++wyNfDWw6nU6n03fTl8O5ld9nh3Ge915NbTqdTqfTt9PLNO6rzoduv8+W+d3yXTqdTqfT6aPeF8yQvPeR96HT6XQ6nb7SAylwbNvyXTqdTqfT6fd5O5va+bnbL7r5QKfT6XQ6vYzf+RCfcZ8+hOl0Op1O31CXJEmSJEmSJEmSJD30D3dYBJaQzBp5AAAAAElFTkSuQmCC'
      // }
      res.json({ redirectUrl: result.data.url });
      //   res.redirect(result.data.url);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Callback rotası
app.post('/payment-callback/:provider', quickPos.handleCallback('paytr'), (req, res) => {
  // req.paymentResult içinde işlenmiş ödeme sonucu bulunur
  console.log('Payment result:', req.paymentResult);
  // Payment result: {
  //   status: 'success',
  //   orderId: 'S1720611701344454893122353174',
  //   amount: 2,
  //   currency: 'TL',
  //   paymentType: 'card'
  // }

  // Burada kendi iş mantığınızı uygulayabilirsiniz
  if (req.paymentResult.status === 'success') {
    // Ödeme başarılı
    res.send('OK');
  } else {
    // Ödeme başarısız
    res.status(400).send('Payment failed');
  }
});

app.listen(80, () => {
  console.log('Server is running on port 3000');
});