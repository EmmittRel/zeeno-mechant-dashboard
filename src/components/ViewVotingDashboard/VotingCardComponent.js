import React, { useEffect, useState, useMemo } from "react";
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
  REFRESH_INTERVAL: 30000, 
  DEFAULT_DATES: {
    START_DATE: "2025-03-20"
  }
};

// Reusable API service
const apiService = {
  fetch: async (endpoint, token, options = {}) => {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      }
    });
    if (!response.ok) throw new Error(`API request failed: ${response.status}`);
    return response.json();
  },

  getContestants: (eventId, token) => {
    return apiService.fetch(`${API_CONFIG.ENDPOINTS.CONTESTANTS}?event_id=${eventId}`, token);
  },

  getPaymentIntents: (eventId, token) => {
    return apiService.fetch(`${API_CONFIG.ENDPOINTS.PAYMENT_INTENTS}?event_id=${eventId}`, token);
  },

  getQrIntents: (eventId, token) => {
    return apiService.fetch(`${API_CONFIG.ENDPOINTS.QR_INTENTS}?event_id=${eventId}`, token);
  },

  getNqrTransactions: (token, endDate) => {
    return apiService.fetch(API_CONFIG.ENDPOINTS.NQR_TRANSACTIONS, token, {
      method: 'POST',
      body: JSON.stringify({
        'start_date': API_CONFIG.DEFAULT_DATES.START_DATE,
        'end_date': endDate
      })
    });
  }
};

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

  const fetchData = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const [contestantsData, paymentIntents, qrIntentsData, nqrData] = await Promise.all([
        apiService.getContestants(event_id, token),
        apiService.getPaymentIntents(event_id, token),
        apiService.getQrIntents(event_id, token),
        apiService.getNqrTransactions(token, today)
      ]);

      setData({
        contestants: contestantsData,
        paymentIntents,
        qrIntents: qrIntentsData.filter(intent => intent.processor?.toUpperCase() === 'QR'),
        nqrTransactions: nqrData.transactions?.responseBody?.filter(txn => txn.debitStatus === '000') || []
      });

    } catch (err) {
      setError(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const voteData = useMemo(() => {
    const { contestants, paymentIntents, qrIntents, nqrTransactions } = data;

    const getIntentIdFromNQR = (addenda1, addenda2) => {
      const combined = `${addenda1}-${addenda2}`;
      const hexMatch = combined.match(/vnpr-([a-f0-9]+)/i);
      return hexMatch?.[1] ? parseInt(hexMatch[1], 16) : null;
    };

    const successfulIntents = [
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

    const contestantsWithVotes = contestants.map(contestant => {
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

    const totalVotes = contestantsWithVotes.reduce((sum, c) => sum + c.votes, 0);
    const sorted = [...contestantsWithVotes].sort((a, b) => b.votes - a.votes);
    
    return {
      totalVotes,
      topPerformer: sorted[0],
      contestants: contestantsWithVotes
    };
  }, [data]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, API_CONFIG.REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [token, event_id]);

  const cards = [
    {
      image: API_CONFIG.IMAGES.TOTAL_VOTES,
      title: "Total Votes",
      value: voteData.totalVotes.toLocaleString(),
      subtext: (
        <div className="live-container">
          <span className="live-dot"></span>
          <span className="live-text">Live</span>
        </div>
      ),
      subtextColor: voteData.totalVotes > 0 ? "green" : "red",
    },
    {
      image: API_CONFIG.IMAGES.TOP_PERFORMER,
      title: "Top Performer",
      value: voteData.topPerformer ? voteData.topPerformer.name : "No data",
      subtext: voteData.topPerformer?.votes !== undefined ? 
        `${voteData.topPerformer.votes.toLocaleString()} Votes` : "No votes yet",
      subtextColor: "green",
    }
  ];

  if (loading) return <div className="loading">Loading voting data...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="cards-container">
      <link
        href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap"
        rel="stylesheet"
        crossOrigin="anonymous"
      />
      {cards.map((card, index) => (
        <div key={index} className="card">
          <div className="card-row">
            <div className="card-icon">
              <img 
                src={card.image} 
                alt={card.title} 
                className="icon-img" 
                loading="lazy"
                width="30"
                height="30"
              />
            </div>
            <div className="card-content">
              <h4 className="card-title">{card.title}</h4>
              <h2 className="card-value">{card.value}</h2>
            </div>
          </div>
          <p className={`card-subtext ${card.subtextColor === "green" ? "green" : "red"}`}>
            {card.subtext}
          </p>
        </div>
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
          .card-value { font-size: 20px; }
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