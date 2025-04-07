import axios from 'axios';

// Configuration with compression and caching support
const API_CONFIG = {
  BASE_URL: "https://auth.zeenopay.com",
  ENDPOINTS: {
    EVENTS: "/events/",
    CONTESTANTS: "/events/contestants/",
    PAYMENT_INTENTS: "/payments/intents/",
    QR_INTENTS: "/payments/qr/intents",
    NQR_TRANSACTIONS: "/payments/qr/transactions/static"
  },
  DEFAULT_DATES: {
    START_DATE: "2025-03-20"
  },
  DEFAULT_AVATAR: "https://via.placeholder.com/40",
  // Added compression and caching parameters
  COMPRESSION: true,
  CACHE_TTL: 300 // 5 minutes cache for GET requests
};

// Cache implementation
const responseCache = new Map();

export const apiService = {
  get: async (endpoint, token, params = {}, forceRefresh = false) => {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    const cacheKey = `${url}?${new URLSearchParams(params).toString()}`;
    
    // Return cached response if available and not forcing refresh
    if (!forceRefresh && responseCache.has(cacheKey)) {
      const { data, timestamp } = responseCache.get(cacheKey);
      if (Date.now() - timestamp < API_CONFIG.CACHE_TTL * 1000) {
        return data;
      }
    }

    const response = await axios.get(url, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Accept-Encoding': API_CONFIG.COMPRESSION ? 'gzip, deflate, br' : ''
      },
      params,
      // Enable response decompression
      decompress: API_CONFIG.COMPRESSION
    });

    // Cache the response
    responseCache.set(cacheKey, {
      data: response.data,
      timestamp: Date.now()
    });

    return response.data;
  },

  post: async (endpoint, token, data = {}) => {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    const response = await axios.post(url, data, {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Accept-Encoding': API_CONFIG.COMPRESSION ? 'gzip, deflate, br' : ''
      },
      // Enable response decompression
      decompress: API_CONFIG.COMPRESSION
    });
    return response.data;
  },

  // Modified methods with pagination and filtering
  getContestants: (eventId, token, options = {}) => 
    apiService.get(API_CONFIG.ENDPOINTS.CONTESTANTS, token, { 
      event_id: eventId,
      limit: options.limit || 100, 
      fields: options.fields || 'id,name,avatar' 
    }),
    
  getPaymentIntents: (eventId, token, options = {}) => 
    apiService.get(API_CONFIG.ENDPOINTS.PAYMENT_INTENTS, token, { 
      event_id: eventId,
      status: 'S', // Filter successful payments only
      limit: options.limit || 500,
      fields: options.fields || 'intent_id,amount,currency,processor,status'
    }),
    
  getQrIntents: (eventId, token, options = {}) => 
    apiService.get(API_CONFIG.ENDPOINTS.QR_INTENTS, token, { 
      event_id: eventId,
      status: 'S', // Filter successful payments only
      processor: 'QR',
      limit: options.limit || 500,
      fields: options.fields || 'intent_id,amount,currency,processor,status'
    }),
    
  getNqrTransactions: (token, endDate, options = {}) => 
    apiService.post(API_CONFIG.ENDPOINTS.NQR_TRANSACTIONS, token, {
      start_date: API_CONFIG.DEFAULT_DATES.START_DATE,
      end_date: endDate,
      debit_status: '000',
      fields: options.fields || 'amount,addenda1,addenda2,debitStatus'
    }),
    
  clearCache: () => {
    responseCache.clear();
  }
};

// Helper functions remain the same
export const getIntentIdFromNQR = (addenda1, addenda2) => {
  const match = `${addenda1}-${addenda2}`.match(/vnpr-([a-f0-9]+)/i);
  return match?.[1] ? parseInt(match[1], 16) : null;
};

export const formatDisplayDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
  });
};

export const DEFAULT_AVATAR = API_CONFIG.DEFAULT_AVATAR;