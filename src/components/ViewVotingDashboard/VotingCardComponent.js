import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useToken } from "../../context/TokenContext";
import { calculateVotes } from '../AmountCalculator';

// API Service Configuration
const API_CONFIG = {
  BASE_URL: "https://auth.zeenopay.com",
  ENDPOINTS: {
    CONTESTANTS: "/events/contestants/",
    PAYMENT_INTENTS: "/payments/intents/",
    QR_INTENTS: "/payments/qr/intents",
    NQR_TRANSACTIONS: "/payments/qr/transactions/static"
  },
  IMAGES: {
    TOTAL_VOTES: "https://i.ibb.co/SwHs5b7g/IMG-2417.png",
    TOP_PERFORMER: "https://i.ibb.co/by04tPM/IMG-2418.png"
  },
  DEFAULT_DATES: {
    START_DATE: "2025-03-20"
  }
};

// Optimized API service with cache
const apiService = {
  cache: new Map(),

  fetch: async (endpoint, token, options = {}) => {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    const cacheKey = `${endpoint}-${JSON.stringify(options)}`;
    
    // Return cached data if available
    if (apiService.cache.has(cacheKey)) {
      return apiService.cache.get(cacheKey).data;
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      }
    });
    
    if (!response.ok) throw new Error(`API request failed: ${response.status}`);
    
    const data = await response.json();
    apiService.cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  },

  getContestants: (eventId, token) => apiService.fetch(
    `${API_CONFIG.ENDPOINTS.CONTESTANTS}?event_id=${eventId}`, 
    token
  ),
  getPaymentIntents: (eventId, token) => apiService.fetch(
    `${API_CONFIG.ENDPOINTS.PAYMENT_INTENTS}?event_id=${eventId}`, 
    token
  ),
  getQrIntents: (eventId, token) => apiService.fetch(
    `${API_CONFIG.ENDPOINTS.QR_INTENTS}?event_id=${eventId}`, 
    token
  ),
  getNqrTransactions: (token, endDate) => apiService.fetch(
    API_CONFIG.ENDPOINTS.NQR_TRANSACTIONS, 
    token, 
    {
      method: 'POST',
      body: JSON.stringify({
        'start_date': API_CONFIG.DEFAULT_DATES.START_DATE,
        'end_date': endDate
      })
    }
  )
};

// Skeleton Loader Component
const SkeletonLoader = () => (
  <div className="cards-container">
    {[1, 2].map(i => (
      <div key={i} className="card">
        <div className="card-row">
          <div className="card-icon skeleton-icon"></div>
          <div className="card-content">
            <div className="card-title skeleton-text"></div>
            <div className="card-value skeleton-text"></div>
          </div>
        </div>
        <div className="card-subtext skeleton-text"></div>
      </div>
    ))}
  </div>
);

// Error Display Component
const ErrorDisplay = ({ error }) => (
  <div className="error-container">
    <div className="error-message">Error: {error}</div>
    <button onClick={() => window.location.reload()}>Retry</button>
  </div>
);

// Loading Placeholder Component
const LoadingPlaceholder = ({ width = '100%', height = '1em' }) => (
  <div 
    className="skeleton-placeholder" 
    style={{ width, height }}
  ></div>
);

// Memoized Card Component
const Card = React.memo(({ image, title, value, subtext, subtextColor, isLoading }) => (
  <div className="card">
    <div className="card-row">
      <div className="card-icon">
        <img 
          src={image} 
          alt={title} 
          className="icon-img" 
          loading="eager"
          width="30"
          height="30"
          decoding="async"
        />
      </div>
      <div className="card-content">
        <h4 className="card-title">{title}</h4>
        <h2 className="card-value">
          {isLoading ? <LoadingPlaceholder width="80%" height="36px" /> : value}
        </h2>
      </div>
    </div>
    <p className={`card-subtext ${subtextColor}`}>
      {isLoading ? <LoadingPlaceholder width="60%" /> : subtext}
    </p>
  </div>
));

const VotingCardComponent = () => {
  const { token } = useToken();
  const { event_id } = useParams();
  const [data, setData] = useState({
    contestants: [],
    paymentIntents: [],
    qrIntents: [],
    nqrTransactions: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [initialRender, setInitialRender] = useState(false);

  // Staggered data fetching with useCallback
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // 1. Load critical data first
      const contestantsData = await apiService.getContestants(event_id, token);
      
      // 2. Immediate render with partial data
      setData({
        contestants: contestantsData,
        paymentIntents: [],
        qrIntents: [],
        nqrTransactions: []
      });

      // 3. Load secondary data
      const [paymentIntents, qrIntentsData, nqrData] = await Promise.all([
        apiService.getPaymentIntents(event_id, token),
        apiService.getQrIntents(event_id, token),
        apiService.getNqrTransactions(token, today)
      ]);

      // 4. Update with complete data
      setData(prev => ({
        ...prev,
        paymentIntents,
        qrIntents: qrIntentsData.filter(intent => intent.processor?.toUpperCase() === 'QR'),
        nqrTransactions: nqrData.transactions?.responseBody?.filter(txn => txn.debitStatus === '000') || []
      }));

    } catch (err) {
      setError(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [event_id, token]);

  // Calculate votes - only include transactions with 10+ votes
  const successfulIntents = useMemo(() => {
    const { paymentIntents, qrIntents, nqrTransactions } = data;
    
    const getIntentIdFromNQR = (addenda1, addenda2) => {
      const combined = `${addenda1}-${addenda2}`;
      const hexMatch = combined.match(/vnpr-([a-f0-9]+)/i);
      return hexMatch?.[1] ? parseInt(hexMatch[1], 16) : null;
    };

    // Process all transactions first
    const allIntents = [
      ...paymentIntents.filter(intent => intent.status === 'S'),
      ...qrIntents.filter(intent => intent.status === 'S'),
      ...nqrTransactions.map(txn => ({
        intent_id: getIntentIdFromNQR(txn.addenda1, txn.addenda2),
        amount: txn.amount,
        currency: 'NPR',
        processor: 'NQR',
        status: 'S'
      }))
    ];

    // Filter out intents with less than 10 votes
    return allIntents.filter(intent => {
      let currency = 'USD';
      const processor = intent.processor?.toUpperCase();

      if (["ESEWA", "KHALTI", "FONEPAY", "PRABHUPAY", "QR", "NQR"].includes(processor)) {
        currency = 'NPR';
      } else if (["PHONEPE", "PAYU"].includes(processor)) {
        currency = 'INR';
      } else if (processor === "STRIPE") {
        currency = intent.currency?.toUpperCase() || 'USD';
      }

      return calculateVotes(intent.amount, currency) >= 10;
    });
  }, [data]);

  const contestantsWithVotes = useMemo(() => {
    return data.contestants.map(contestant => {
      const votes = successfulIntents
        .filter(intent => intent.intent_id?.toString() === contestant.id.toString())
        .reduce((sum, intent) => {
          let currency = 'USD';
          const processor = intent.processor?.toUpperCase();

          if (["ESEWA", "KHALTI", "FONEPAY", "PRABHUPAY", "QR", "NQR"].includes(processor)) {
            currency = 'NPR';
          } else if (["PHONEPE", "PAYU"].includes(processor)) {
            currency = 'INR';
          } else if (processor === "STRIPE") {
            currency = intent.currency?.toUpperCase() || 'USD';
          }

          return sum + calculateVotes(intent.amount, currency);
        }, 0);

      return { ...contestant, votes };
    });
  }, [data.contestants, successfulIntents]);

  const voteData = useMemo(() => {
    const totalVotes = contestantsWithVotes.reduce((sum, c) => sum + c.votes, 0);
    const sorted = [...contestantsWithVotes].sort((a, b) => b.votes - a.votes);
    const topPerformer = sorted[0];
    
    return {
      totalVotes,
      topPerformer,
      hasTopPerformer: topPerformer && topPerformer.votes >= 10,
      contestants: contestantsWithVotes
    };
  }, [contestantsWithVotes]);

  useEffect(() => {
    setInitialRender(true);
    fetchData();
  }, [fetchData]);

  const cards = useMemo(() => [
    {
      image: API_CONFIG.IMAGES.TOTAL_VOTES,
      title: "Total Votes",
      value: loading 
        ? "" 
        : voteData.totalVotes > 0 
          ? voteData.totalVotes.toLocaleString() 
          : "No qualifying votes",
      subtext: loading ? "" : (
        voteData.totalVotes > 0 ? (
          <div className="live-container">
            <span className="live-dot"></span>
            <span className="live-text">Live</span>
          </div>
        ) : "Minimum 10 votes required"
      ),
      subtextColor: voteData.totalVotes > 0 ? "green" : "red",
      isLoading: loading
    },
    {
      image: API_CONFIG.IMAGES.TOP_PERFORMER,
      title: "Top Performer",
      value: loading 
        ? "" 
        : voteData.hasTopPerformer 
          ? voteData.topPerformer.name 
          : "No qualifying performer",
      subtext: loading 
        ? "" 
        : voteData.hasTopPerformer 
          ? `${voteData.topPerformer.votes.toLocaleString()} Votes` 
          : "Needs 10+ votes",
      subtextColor: voteData.hasTopPerformer ? "green" : "red",
      isLoading: loading
    }
  ], [loading, voteData]);

  // Initial render before any data
  if (!initialRender) return <SkeletonLoader />;

  // Error state
  if (error) return <ErrorDisplay error={error} />;

  return (
    <div className="cards-container">
      {/* Resource Preloading */}
      <link rel="preconnect" href="https://auth.zeenopay.com" />
      <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
      <link
        rel="preload"
        href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap"
        as="style"
        onLoad={() => {
          const el = document.querySelector('link[rel="preload"][as="style"]');
          if (el) el.rel = 'stylesheet';
        }}
      />
      <link rel="preload" href={API_CONFIG.IMAGES.TOTAL_VOTES} as="image" />
      <link rel="preload" href={API_CONFIG.IMAGES.TOP_PERFORMER} as="image" />

      {/* Inline Critical CSS */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .card-value {
            font-size: 36px;
            font-weight: 700;
            margin: 0;
            font-family: 'Poppins', sans-serif;
            color: #000;
          }
          .card {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            width: 100%;
            max-width: 400px;
            padding: 15px;
            border: 1px solid #e5e5e5;
            border-radius: 8px;
            background-color: #ffffff;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
          }
          .card-row {
            display: flex;
            align-items: center;
          }
          .skeleton-placeholder {
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
            border-radius: 4px;
          }
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `
      }} />

      {cards.map((card, index) => (
        <Card key={index} {...card} />
      ))}
      <hr className="horizontal-line" />

      <style jsx>{`
        .cards-container {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: space-between;
          margin: 0px 0;
          animation: fadeIn 0.6s ease-in-out;
          font-family: 'Poppins', sans-serif;
        }
        .live-container {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .live-dot {
          width: 8px;
          height: 8px;
          background-color: red;
          border-radius: 50%;
          animation: blink 1s infinite;
        }
        .live-text {
          font-size: 12px;
          font-weight: bold;
          color: red;
        }
        @keyframes blink {
          0% { opacity: 1; }
          50% { opacity: 0; }
          100% { opacity: 1; }
        }
        .card-subtext {
          font-size: 12px;
          margin-top: 8px;
          font-weight: bold;
        }
        .card-subtext.green {
          color: #28a745;
        }
        .card-subtext.red {
          color: #dc3545;
        }
        .card {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          width: 100%;
          max-width: 400px;
          padding: 15px;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          background-color: #ffffff;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
          transform: translateY(20px);
          opacity: 0;
          animation: cardAppear 0.6s ease-in-out forwards;
        }
        .card:hover {
          transform: translateY(-5px);
        }
        .card-row {
          display: flex;
          align-items: center;
        }
        .card-icon {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background-color: #f0f4ff;
          margin-right: 15px;
        }
        .icon-img {
          width: 30px;
          height: 30px;
        }
        .card-content {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 5px;
        }
        .card-title {
          font-size: 16px;
          font-weight: 600;
          color: #4f4f4f;
          margin: 0;
        }
        .card-value {
          font-size: 36px;
          font-weight: 700;
          margin: 0;
          min-height: 42px;
          display: flex;
          align-items: center;
        }
        .horizontal-line {
          width: 100%;
          border: 0;
          border-top: 2px solid #f4f4f4;
          margin: 20px 0 25px;
        }
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes cardAppear {
          0% { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .loading, .error {
          padding: 20px;
          text-align: center;
          font-family: 'Poppins', sans-serif;
        }
        .error {
          color: #dc3545;
        }
        @media (max-width: 768px) {
          .cards-container {
            justify-content: space-between;
            margin-top: 70px;
          }
          .card {
            flex: 1 1 calc(40% - 10px);
            max-width: calc(40% - 10px);
            padding: 15px;
          }
          .card-title { font-size: 12px; }
          .card-value { font-size: 20px; min-height: 24px; }
        }
        @media (max-width: 480px) {
          .card {
            flex: 1 1 calc(40% - 10px);
            max-width: calc(40% - 10px);
          }
          .card-row {
            flex-direction: column;
            align-items: flex-start;
          }
          .card-icon {
            margin-bottom: 10px;
            width: 40px;
            height: 40px;
          }
          .icon-img {
            width: 20px;
            height: 20px;
          }
          .card-content { align-items: flex-start; }
        }
      `}</style>
    </div>
  );
};

export default VotingCardComponent;