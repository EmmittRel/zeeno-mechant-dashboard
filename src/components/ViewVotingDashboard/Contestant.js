import React, { useState, useEffect } from "react";
import { calculateVotes } from '../AmountCalculator';

// API configuration
const API_CONFIG = {
  BASE_URL: "https://auth.zeenopay.com",
  ENDPOINTS: {
    CONTESTANTS: "/events/contestants/",
    PAYMENT_INTENTS: "/payments/intents/",
    QR_INTENTS: "/payments/qr/intents",
    NQR_TRANSACTIONS: "/payments/qr/transactions/static"
  },
  DEFAULT_AVATAR: "https://via.placeholder.com/40",
  REFRESH_INTERVAL: 30000 
};

const Contestant = ({ event_id, token }) => {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Helper function for API calls
  const apiCall = async (endpoint, method = 'GET', body = null, signal) => {
    try {
      const url = `${API_CONFIG.BASE_URL}${endpoint}${method === 'GET' ? `?event_id=${event_id}` : ''}`;
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        signal
      };
      if (body) options.body = JSON.stringify(body);

      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

      return await response.json();
    } catch (err) {
      if (err.name !== 'AbortError') console.error(`Error fetching ${endpoint}:`, err);
      throw err;
    }
  };

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    const { signal } = controller;

    const fetchData = async () => {
      try {
        setLoading(true);
        setLoadingProgress(0);
        
        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setLoadingProgress(prev => Math.min(prev + 10, 90));
        }, 500);

        const today = new Date().toISOString().split('T')[0];

        const [contestants, paymentIntents, qrPaymentIntents, nqrData] = await Promise.all([
          apiCall(API_CONFIG.ENDPOINTS.CONTESTANTS, 'GET', null, signal),
          apiCall(API_CONFIG.ENDPOINTS.PAYMENT_INTENTS, 'GET', null, signal),
          apiCall(API_CONFIG.ENDPOINTS.QR_INTENTS, 'GET', null, signal),
          apiCall(API_CONFIG.ENDPOINTS.NQR_TRANSACTIONS, 'POST', { start_date: "2025-03-20", end_date: today }, signal)
        ]);

        clearInterval(progressInterval);
        setLoadingProgress(100);

        if (!isMounted) return;

        // Process NQR transactions
        const extractIntentId = (addenda1, addenda2) => {
          const match = `${addenda1}-${addenda2}`.match(/vnpr-([a-f0-9]+)/i);
          return match?.[1] ? parseInt(match[1], 16) : null;
        };

        const successfulNqrTransactions = nqrData.transactions?.responseBody?.filter(txn => txn.debitStatus === '000') || [];

        // Combine all successful payments
        const successfulPayments = [
          ...paymentIntents.filter(intent => intent.status === 'S'),
          ...qrPaymentIntents.filter(intent => intent.status === 'S' && intent.processor?.toUpperCase() === "QR"),
          ...successfulNqrTransactions.map(txn => ({
            intent_id: extractIntentId(txn.addenda1, txn.addenda2),
            amount: txn.amount,
            currency: 'NPR',
            processor: 'NQR',
            status: 'S'
          }))
        ];

        // Calculate votes for each contestant
        const updatedCandidates = contestants.map(contestant => {
          const totalVotes = successfulPayments
            .filter(intent => intent.intent_id?.toString() === contestant.id.toString())
            .reduce((sum, intent) => {
              let currency = intent.currency?.toUpperCase() || 'USD';
              const processor = intent.processor?.toUpperCase();

              if (["ESEWA", "KHALTI", "FONEPAY", "PRABHUPAY", "QR", "NQR"].includes(processor)) {
                currency = 'NPR';
              } else if (["PHONEPE", "PAYU"].includes(processor)) {
                currency = 'INR';
              }

              return sum + calculateVotes(intent.amount, currency);
            }, 0);

          return { ...contestant, votes: totalVotes };
        });

        // Sort and take top 5
        setCandidates(updatedCandidates.sort((a, b) => b.votes - a.votes).slice(0, 5));
      } catch (err) {
        if (isMounted && err.name !== 'AbortError') {
          setError("Failed to fetch data. Please try again.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, API_CONFIG.REFRESH_INTERVAL);

    return () => {
      isMounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [event_id, token]);

  if (error) return (
    <div className="error-message">
      {error}
      <button 
        onClick={() => window.location.reload()}
        className="retry-button"
      >
        Retry
      </button>
    </div>
  );

  if (loading) return (
    <div className="loading-container">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
          
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            min-height: 300px;
            background: #f7f9fc;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            font-family: 'Poppins', sans-serif;
          }
          
          .trophy-loader {
            width: 80px;
            height: 80px;
            position: relative;
            margin-bottom: 20px;
          }
          
          .trophy-base {
            width: 60px;
            height: 20px;
            background: #FFD700;
            border-radius: 4px;
            position: absolute;
            bottom: 0;
            left: 10px;
          }
          
          .trophy-cup {
            width: 40px;
            height: 50px;
            background: #FFD700;
            border-radius: 0 0 20px 20px;
            position: absolute;
            bottom: 20px;
            left: 20px;
          }
          
          .trophy-handle {
            width: 10px;
            height: 30px;
            background: #FFD700;
            border-radius: 5px;
            position: absolute;
            bottom: 30px;
            left: 15px;
            transform: rotate(-30deg);
          }
          
          .trophy-handle.right {
            left: 55px;
            transform: rotate(30deg);
          }
          
          .trophy-star {
            width: 15px;
            height: 15px;
            background: #FFFFFF;
            clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
            position: absolute;
            top: 10px;
            left: 32.5px;
            animation: pulse 1.5s infinite ease-in-out;
          }
          
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.2); opacity: 0.8; }
          }
          
          .loading-text {
            margin-top: 20px;
            font-size: 18px;
            color: #333;
            font-weight: 500;
          }
          
          .loading-progress {
            width: 80%;
            height: 8px;
            background: #e0e0e0;
            border-radius: 4px;
            margin-top: 20px;
            overflow: hidden;
          }
          
          .loading-progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #FFD700, #FFA500);
            border-radius: 4px;
            transition: width 0.3s ease;
          }
          
          .loading-caption {
            font-size: 14px;
            color: #666;
            margin-top: 10px;
            font-style: italic;
          }
          
          .error-message {
            text-align: center;
            padding: 40px;
            color: #ff4444;
            font-size: 18px;
            font-weight: bold;
            background: #fff8f8;
            border-radius: 10px;
            border: 1px solid #ffdddd;
            font-family: 'Poppins', sans-serif;
          }
          
          .retry-button {
            margin-top: 20px;
            padding: 10px 20px;
            background: #FF6B95;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-family: 'Poppins', sans-serif;
            font-weight: 500;
          }
        `}
      </style>
      <div className="trophy-loader">
        <div className="trophy-base"></div>
        <div className="trophy-cup"></div>
        <div className="trophy-handle"></div>
        <div className="trophy-handle right"></div>
        <div className="trophy-star"></div>
      </div>
      <div className="loading-text">Loading Top Candidates...</div>
      <div className="loading-progress">
        <div 
          className="loading-progress-bar" 
          style={{ width: `${loadingProgress}%` }}
        ></div>
      </div>
      <div className="loading-caption">
        {loadingProgress < 30 && "Checking contestant profiles..."}
        {loadingProgress >= 30 && loadingProgress < 60 && "Calculating votes..."}
        {loadingProgress >= 60 && loadingProgress < 90 && "Determining leaders..."}
        {loadingProgress >= 90 && "Almost ready to announce!"}
      </div>
    </div>
  );

  return (
    <div className="candidate-card">
      <h3 className="top-h3">Top Performing Candidates</h3>
      <ul className="candidate-list">
        {candidates.map((candidate, index) => (
          <li key={candidate.id} className="candidate-item">
            <div className="candidate-info">
              <div className="rank-badge">
                {index + 1}
              </div>
              <img
                src={candidate.avatar || API_CONFIG.DEFAULT_AVATAR}
                alt={candidate.name}
                className="candidate-image"
                loading="lazy"
                width="40"
                height="40"
              />
              <div className="name-container">
                <span className="candidate-name">{candidate.name}</span>
                <span className="mobile-votes">{candidate.votes.toLocaleString()} Votes</span>
              </div>
            </div>
            <span className="desktop-votes">{candidate.votes.toLocaleString()} Votes</span>
          </li>
        ))}
      </ul>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
          
          .candidate-card {
            background-color: #f7f9fc;
            border-radius: 10px;
            padding: 20px;
            flex: 1;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            font-family: 'Poppins', sans-serif;
            height: 100%;
            box-sizing: border-box;
          }
          
          .top-h3 {
            font-size: 1.2rem;
            margin-bottom: 20px;
            color: #333;
            font-weight: 600;
            text-align: left;
          }
          
          .candidate-list {
            list-style-type: none;
            padding: 0;
            margin: 0;
          }
          
          .candidate-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: #fff;
            border: 1px solid #e0e0e0;
            color: #333;
            font-weight: 500;
            border-radius: 8px;
            padding: 12px 15px;
            margin-bottom: 10px;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }
          
          .candidate-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
          }
          
          .candidate-info {
            display: flex;
            align-items: center;
            flex: 1;
            min-width: 0;
          }
          
          .rank-badge {
            background: #FFD700;
            color: #000;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 10px;
            font-weight: bold;
            font-size: 14px;
            flex-shrink: 0;
          }
          
          .rank-badge:nth-child(1) { background: #FFD700; }
          .rank-badge:nth-child(2) { background: #C0C0C0; }
          .rank-badge:nth-child(3) { background: #CD7F32; }
          
          .candidate-image {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            margin-right: 12px;
            object-fit: cover;
            border: 2px solid #e0e0e0;
            flex-shrink: 0;
          }
          
          .name-container {
            display: flex;
            flex-direction: column;
            min-width: 0;
          }
          
          .candidate-name {
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 150px;
          }
          
          .mobile-votes {
            display: none;
            font-size: 12px;
            color: #2e7d32;
            font-weight: 600;
            margin-top: 2px;
          }
          
          .desktop-votes {
            font-weight: 600;
            color: #2e7d32;
            margin-left: 10px;
            flex-shrink: 0;
          }
          
          @media (max-width: 768px) {
            .candidate-card {
              padding: 15px;
            }
            
            .top-h3 {
              font-size: 1.1rem;
              margin-bottom: 15px;
            }
            
            .candidate-item {
              padding: 10px;
              flex-direction: column;
              align-items: flex-start;
            }
            
            .candidate-info {
              width: 100%;
            }
            
            .candidate-name {
              max-width: 100%;
              font-size: 14px;
            }
            
            .mobile-votes {
              display: block;
            }
            
            .desktop-votes {
              display: none;
            }
            
            .candidate-image {
              width: 36px;
              height: 36px;
              margin-right: 8px;
            }
            
            .rank-badge {
              width: 20px;
              height: 20px;
              font-size: 12px;
              margin-right: 8px;
            }
          }
          
          @media (max-width: 480px) {
            .candidate-name {
              font-size: 13px;
            }
            
            .mobile-votes {
              font-size: 11px;
            }
          }
        `}
      </style>
    </div>
  );
};

export default Contestant;