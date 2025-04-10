import React, { useState, useEffect } from "react";
import Chart from "react-apexcharts";
import { FaDownload } from "react-icons/fa";
import { useParams } from "react-router-dom";
import { useToken } from "../../context/TokenContext";
import { calculateVotes } from "../AmountCalculator";

// API Configuration
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
  }
};

// API Service
const apiService = {
  get: async (endpoint, token, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = `${API_CONFIG.BASE_URL}${endpoint}${queryString ? `?${queryString}` : ''}`;
    const response = await fetch(url, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) throw new Error(`API request failed: ${response.status}`);
    return response.json();
  },

  post: async (endpoint, token, data = {}) => {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`API request failed: ${response.status}`);
    return response.json();
  }
};

const VoteByCountry = () => {
  const { event_id } = useParams();
  const { token } = useToken();
  const [nepalVotes, setNepalVotes] = useState([]);
  const [globalVotes, setGlobalVotes] = useState([]);
  const [totalVotesNepal, setTotalVotesNepal] = useState(0);
  const [totalVotesGlobal, setTotalVotesGlobal] = useState(0);
  const [paymentInfo, setPaymentInfo] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const nepalProcessors = ["ESEWA", "KHALTI", "FONEPAY", "PRABHUPAY", "NQR", "QR"];
  const indiaProcessors = ["PHONEPE"];
  const internationalProcessors = ["PAYU", "STRIPE"];

  // Enhanced function to extract intent_id from NQR transaction
  const getIntentIdFromNQR = (addenda1, addenda2) => {
    try {
      // Combine both addenda fields
      const combined = `${addenda1 || ''}-${addenda2 || ''}`;
      
      // Try to find hex pattern
      const hexMatch = combined.match(/vnpr-([a-f0-9]+)/i);
      if (hexMatch?.[1]) {
        return parseInt(hexMatch[1], 16);
      }
      
      // Alternative pattern matching if the above fails
      const altMatch = combined.match(/(\d+)/);
      if (altMatch?.[1]) {
        return parseInt(altMatch[1], 10);
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting intent_id from NQR:', error);
      return null;
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch all required data
        const [events, contestants, regularPayments, qrPayments] = await Promise.all([
          apiService.get(API_CONFIG.ENDPOINTS.EVENTS, token),
          apiService.get(API_CONFIG.ENDPOINTS.CONTESTANTS, token, { event_id }),
          apiService.get(API_CONFIG.ENDPOINTS.PAYMENT_INTENTS, token, { event_id }),
          apiService.get(API_CONFIG.ENDPOINTS.QR_INTENTS, token, { event_id })
        ]);

        // Set payment info from event data
        const event = events.find(e => e.id === parseInt(event_id));
        if (event) setPaymentInfo(event.payment_info);

        // Create contestant map for quick lookup
        const contestantMap = contestants.reduce((map, contestant) => {
          map[contestant.id] = contestant;
          return map;
        }, {});

        // Filter and process regular payments
        const filteredRegularPayments = regularPayments
          .filter(payment => payment.intent_id && contestantMap[payment.intent_id])
          .map(payment => ({
            ...payment,
            currency: payment.currency || 'USD' // Default currency
          }));

        // Filter and process QR payments (excluding NQR)
        const filteredQRPayments = qrPayments
          .filter(payment => 
            payment.processor?.toUpperCase() === "QR" && 
            payment.intent_id && 
            contestantMap[payment.intent_id]
          )
          .map(payment => ({
            ...payment,
            currency: 'NPR' // QR payments are always NPR
          }));

        // Try to fetch NQR transactions if needed
        let nqrTransactions = [];
        try {
          const today = new Date().toISOString().split('T')[0];
          const nqrData = await apiService.post(
            API_CONFIG.ENDPOINTS.NQR_TRANSACTIONS, 
            token, 
            {
              'start_date': API_CONFIG.DEFAULT_DATES.START_DATE,
              'end_date': today
            }
          );

          nqrTransactions = (nqrData.transactions?.responseBody || [])
            .filter(txn => txn.debitStatus === '000') // Successful transactions only
            .map(txn => {
              const intent_id = getIntentIdFromNQR(txn.addenda1, txn.addenda2);
              return {
                ...txn,
                intent_id,
                contestant: intent_id ? contestantMap[intent_id] : null
              };
            })
            .filter(txn => txn.intent_id && txn.contestant)
            .map(txn => ({
              intent_id: txn.intent_id,
              amount: txn.amount,
              processor: 'NQR',
              status: 'S',
              currency: 'NPR'
            }));
        } catch (error) {
          console.error("Error fetching NQR transactions:", error);
        }

        // Combine all payment sources
        const allPaymentIntents = [
          ...filteredRegularPayments,
          ...filteredQRPayments,
          ...nqrTransactions
        ];

        // Process the voting data
        processVotingData(allPaymentIntents);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    const processVotingData = (paymentIntents) => {
      // Filter successful transactions only
      const successfulPaymentIntents = paymentIntents.filter(
        (item) => item.status === 'S'
      );

      // Process Nepal payments
      const nepalData = successfulPaymentIntents.filter((item) =>
        nepalProcessors.includes(item.processor?.toUpperCase())
      );

      const nepalVotesData = nepalProcessors.map((processor) => {
        const processorData = nepalData.filter(
          (item) => item.processor?.toUpperCase() === processor
        );
        return processorData.reduce(
          (sum, item) => sum + calculateVotes(item.amount, item.currency), 
          0
        );
      });

      // Process Global payments
      const indiaData = successfulPaymentIntents.filter((item) =>
        indiaProcessors.includes(item.processor?.toUpperCase())
      );
      const internationalData = successfulPaymentIntents.filter((item) =>
        internationalProcessors.includes(item.processor?.toUpperCase())
      );

      const indiaVotes = indiaData.reduce(
        (sum, item) => sum + calculateVotes(item.amount, "INR"), 
        0
      );

      const internationalVotes = internationalData.reduce(
        (sum, item) => {
          const currency = item.currency || 'USD';
          return sum + calculateVotes(item.amount, currency);
        }, 0
      );

      // Update state
      setNepalVotes(nepalVotesData);
      setTotalVotesNepal(nepalVotesData.reduce((a, b) => a + b, 0));
      setGlobalVotes([indiaVotes, internationalVotes]);
      setTotalVotesGlobal(indiaVotes + internationalVotes);
    };

    if (token) {
      fetchData();
    }
  }, [event_id, token]);

  // Update labels for Nepal chart
  const nepalLabels = nepalProcessors.map((processor) => {
    if (processor === "NQR") return "NepalPayQR";
    if (processor === "QR") return "FonePayQR";
    if (processor === "FONEPAY") return "iMobile Banking";
    return processor;
  });

  const pieOptionsNepal = {
    chart: {
      type: "pie",
      height: 350,
    },
    labels: nepalLabels,
    colors: ["green", "#200a69", "red", "orange", "skyblue", "blue"],
    legend: { position: "bottom" },
    tooltip: {
      y: {
        formatter: function(value) {
          return value.toLocaleString();
        }
      }
    }
  };

  const pieOptionsGlobal = {
    chart: {
      type: "pie",
      height: 350,
    },
    labels: ["Votes by Residents Within India", "International Votes"],
    colors: ["#5F259F", "#FF5722"],
    legend: { position: "bottom" },
    tooltip: {
      y: {
        formatter: function(value) {
          return value.toLocaleString();
        }
      }
    }
  };

  // Check if there is no data
  const hasNoData = nepalVotes.length === 0 && globalVotes.length === 0;
  const hasNoNepalVotes = nepalVotes.every((vote) => vote === 0);
  const hasNoGlobalVotes = globalVotes.every((vote) => vote === 0);

  return (
    <div className="chart-container">
      <div className="header">
        <h3>Vote Breakdown</h3>
        <button className="export-btn">
          <FaDownload className="export-icon" /> Export
        </button>
      </div>

      {isLoading ? (
        <div className="loading">Loading...</div>
      ) : hasNoData ? (
        <div className="no-data">No any vote data</div>
      ) : (
        <div className="charts">
          <div className="report">
            <div className="chart-header">
              <h3>Votes from Nepal</h3>
            </div>
            {hasNoNepalVotes ? (
              <div className="no-nepal-votes">No any Votes from Nepal</div>
            ) : (
              <>
                <Chart
                  options={pieOptionsNepal}
                  series={nepalVotes}
                  type="pie"
                  height={350}
                />
                <div className="total-votes">Total Votes: {totalVotesNepal.toLocaleString()}</div>
              </>
            )}
          </div>

          <div className="report">
            <div className="chart-header">
              <h3>Votes from Global</h3>
            </div>
            {hasNoGlobalVotes ? (
              <div className="no-global-votes">No any Global Votes</div>
            ) : (
              <>
                <Chart
                  options={pieOptionsGlobal}
                  series={globalVotes}
                  type="pie"
                  height={350}
                />
                <div className="total-votes">Total Votes: {totalVotesGlobal.toLocaleString()}</div>
              </>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .chart-container {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          width: 100%;
          padding-bottom: 20px;
        }

        .header {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          margin-top: 30px;
        }

        .header h3 {
          margin: 0;
          font-size: 24px;
          color: #333;
        }

        .export-btn {
          background-color: #028248;
          color: white;
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 16px;
          transition: background-color 0.3s;
        }

        .export-btn:hover {
          background-color: #026e3d;
        }

        .charts {
          display: flex;
          justify-content: space-between;
          width: 100%;
          gap: 20px;
          margin-top: 20px;
        }

        .report {
          background-color: white;
          padding: 20px;
          border-radius: 8px;
          width: 48%;
          box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
        }

        .chart-header {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          margin-bottom: 15px;
        }

        .chart-header h3 {
          margin: 0;
          font-size: 18px;
          color: #444;
        }

        .total-votes {
          text-align: center;
          font-size: 18px;
          margin-top: 20px;
          padding: 10px;
          width: 100%;
          box-sizing: border-box;
          font-weight: bold;
          color: #333;
          background-color: #f8f9fa;
          border-radius: 4px;
        }

        .loading,
        .no-data,
        .no-nepal-votes,
        .no-global-votes {
          text-align: center;
          font-size: 18px;
          margin-top: 20px;
          width: 100%;
          color: #666;
          padding: 20px;
          background-color: #f8f9fa;
          border-radius: 8px;
        }

        /* Mobile responsiveness */
        @media (max-width: 768px) {
          .header {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }

          .header h3 {
            font-size: 20px;
          }

          .export-btn {
            width: 100%;
            justify-content: center;
          }

          .charts {
            flex-direction: column;
            gap: 20px;
          }

          .report {
            width: 100%;
            margin-bottom: 20px;
          }

          .total-votes {
            font-size: 16px;
          }
        }

        @media (max-width: 480px) {
          .header h3 {
            font-size: 18px;
          }

          .total-votes {
            font-size: 14px;
          }
        }
      `}</style>
    </div>
  );
};

export default VoteByCountry;