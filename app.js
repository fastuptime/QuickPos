const path = require('path');

class QuickPos {
  constructor(config) {
    this.providers = {};
    this.loadProviders(config.providers);
  }

  loadProviders(providerConfigs) {
    for (const [providerName, providerConfig] of Object.entries(providerConfigs)) {
      try {
        const ProviderClass = require(path.join(__dirname, 'lib', `${providerName}.js`));
        this.providers[providerName] = new ProviderClass(providerConfig);
      } catch (error) {
        console.error(`Failed to load provider ${providerName}:`, error);
      }
    }
  }

  middleware() {
    return async (req, res, next) => {
      req.quickPos = this.providers;
      next();
    };
  }

  handleCallback(providerName) {
    return async (req, res, next) => {
      if (!this.providers[providerName]) {
        return res.status(400).json({ error: 'Invalid payment provider' });
      }

      try {
        const result = await this.providers[providerName].handleCallback(req.body);
        req.paymentResult = result;
        next();
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    };
  }
}

module.exports = QuickPos;