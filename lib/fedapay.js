const { FedaPay, Transaction, Customer } = require('fedapay');

class FedaPayClient {
  constructor(config) {
    this.config = config || {};
    const requiredFields = ['apiKey', 'environment'];
    
    for (let field of requiredFields) {
      if (!config[field]) throw new Error(`Missing required field: ${field}`);
    }

    // Initialize FedaPay client
    FedaPay.setApiKey(config.apiKey);
    FedaPay.setEnvironment(config.environment || 'sandbox'); // sandbox or live
    
    // Optional configuration
    if (config.accountId) FedaPay.setAccountId(config.accountId);
    
    this.debug = config.debug || false;
  }

  async createPayment(paymentDetails) {
    try {
      // Validate required fields
      const requiredData = ['amount', 'currency', 'description'];
      for (let data of requiredData) {
        if (!paymentDetails[data]) throw new Error(`Missing required data: ${data}`);
      }

      if (this.debug) console.log('Creating payment with details:', paymentDetails);

      // Prepare customer data if available
      let customer = null;
      if (paymentDetails.email || paymentDetails.firstName || paymentDetails.lastName || paymentDetails.phone) {
        customer = {
          email: paymentDetails.email,
          firstname: paymentDetails.firstName || paymentDetails.name,
          lastname: paymentDetails.lastName || paymentDetails.surname
        };
        
        // Format phone number correctly according to FedaPay API
        if (paymentDetails.phone) {
          customer.phone_number = {
            number: paymentDetails.phone,
            country: paymentDetails.phoneCountry || 'BJ' // Default to Benin if not specified
          };
        }
      }

      // Create transaction data
      const transactionData = {
        description: paymentDetails.description,
        amount: paymentDetails.amount,
        currency: { 
          iso: paymentDetails.currency
        },
        callback_url: paymentDetails.callbackUrl || paymentDetails.notificationUrl,
        reference: paymentDetails.orderId || `order-${Date.now()}`
      };
      
      // Add payment mode if specified (mtn, moov, etc.)
      if (paymentDetails.mode) {
        transactionData.mode = paymentDetails.mode;
      }
      
      // Add customer if exists
      if (customer) {
        transactionData.customer = customer;
      }

      // Create transaction
      const transaction = await Transaction.create(transactionData);
      
      if (this.debug) console.log('Transaction created:', transaction);

      // Correct way to generate payment URL using the Transaction class directly
      // We need to retrieve the transaction first to use generateToken method
      const retrievedTransaction = await Transaction.retrieve(transaction.id);
      const tokenData = await retrievedTransaction.generateToken({
        return_url: paymentDetails.returnUrl || paymentDetails.successUrl,
        cancel_url: paymentDetails.cancelUrl || paymentDetails.failUrl
      });
      
      if (this.debug) console.log('Payment token generated:', tokenData);

      // Extract the token and URL from the response
      const paymentUrl = tokenData.url;
      const token = tokenData.token;

      return {
        status: 'success',
        data: {
          id: transaction.id,
          transactionId: transaction.id,
          reference: transaction.reference,
          url: paymentUrl,
          token: token
        }
      };
    } catch (error) {
      if (this.debug) console.error('FedaPay payment creation error:', error);
      
      return {
        status: 'fail',
        message: error.message || 'Unknown error'
      };
    }
  }

  async handleCallback(callbackData) {
    try {
      if (this.debug) console.log('Processing callback data:', callbackData);

      // FedaPay webhook data structure may vary, adjust as needed
      const transactionId = callbackData.id || callbackData.transaction_id;

      if (!transactionId) {
        throw new Error('Invalid callback data: missing transaction ID');
      }

      // Retrieve the transaction to verify its status
      const transaction = await Transaction.retrieve(transactionId);

      if (this.debug) console.log('Retrieved transaction:', transaction);

      if (transaction && transaction.status === 'approved') {
        return {
          status: 'success',
          transactionId: transaction.id,
          orderId: transaction.reference,
          amount: transaction.amount,
          currency: transaction.currency.iso,
          paymentDate: transaction.approved_at || transaction.updated_at,
          paymentMethod: transaction.mode || 'unknown'
        };
      } else {
        throw new Error(`Payment failed with status: ${transaction?.status || 'unknown'}`);
      }
    } catch (error) {
      if (this.debug) console.error('Callback handling error:', error);
      throw new Error(`Error in FedaPay callback handling: ${error.message}`);
    }
  }

  // Additional utility methods

  async getTransaction(transactionId) {
    try {
      const transaction = await Transaction.retrieve(transactionId);
      return {
        status: 'success',
        data: transaction
      };
    } catch (error) {
      if (this.debug) console.error('Get transaction error:', error);
      return {
        status: 'fail',
        message: error.message
      };
    }
  }

  async listTransactions(params = {}) {
    try {
      const transactions = await Transaction.all(params);
      return {
        status: 'success',
        data: transactions
      };
    } catch (error) {
      if (this.debug) console.error('List transactions error:', error);
      return {
        status: 'fail',
        message: error.message
      };
    }
  }

  async verifySignature(payload, signature, key = null) {
    try {
      // Use provided key or default to API key
      const secretKey = key || this.config.apiKey;
      
      // Implementation depends on FedaPay's webhook signature verification method
      // This is a placeholder - adjust according to FedaPay's actual verification method
      return FedaPay.Webhook.verifySignature(payload, signature, secretKey);
    } catch (error) {
      if (this.debug) console.error('Signature verification error:', error);
      return false;
    }
  }
}

module.exports = FedaPayClient;
