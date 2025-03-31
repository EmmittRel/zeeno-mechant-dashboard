import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FaDownload } from 'react-icons/fa';
import ReactCountryFlag from 'react-country-flag';
import { useToken } from '../../context/TokenContext';
import { calculateVotes } from '../AmountCalculator';
import useNQRProcessor from '../useNQRProcessor';

// API Configuration
const API_CONFIG = {
  BASE_URL: "https://auth.zeenopay.com",
  ENDPOINTS: {
    EVENTS: "/events",
    CONTESTANTS: "/events/contestants",
    PAYMENT_INTENTS: "/payments/intents",
    QR_INTENTS: "/payments/qr/intents",
    NQR_TRANSACTIONS: "/payments/qr/transactions/static"
  },
  DEFAULT_HEADERS: {
    "Content-Type": "application/json"
  }
};

// Static configuration objects
const currencyToCountry = {
  USD: 'US', AUD: 'AU', GBP: 'GB', CAD: 'CA', EUR: 'EU', AED: 'AE',
  QAR: 'QA', MYR: 'MY', KWD: 'KW', HKD: 'HK', CNY: 'CN', SAR: 'SA',
  OMR: 'OM', SGD: 'SG', NOK: 'NO', KRW: 'KR', JPY: 'JP', THB: 'TH',
  INR: 'IN', NPR: 'NP',
};

const statusLabel = {
  P: { label: 'Pending', color: '#FFA500' },
  S: { label: 'Success', color: '#28A745' },
  F: { label: 'Failed', color: '#DC3545' },
  C: { label: 'Cancelled', color: '#6C757D' },
};

const RealtimeVoting = ({ id: event_id }) => {
  const { token } = useToken();
  const [data, setData] = useState([]);
  const [eventData, setEventData] = useState(null);
  const [contestants, setContestants] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const rowsPerPage = 10;

  // Custom hook for NQR processing
  const { nqrData: nqrTransactions, loading: nqrLoading } = useNQRProcessor(token, event_id, contestants);

  // API call helper function
  const apiCall = useCallback(async (endpoint, method = 'GET', params = {}, body = null) => {
    const url = new URL(`${API_CONFIG.BASE_URL}${endpoint}`);
    
    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const options = {
      method,
      headers: {
        ...API_CONFIG.DEFAULT_HEADERS,
        'Authorization': `Bearer ${token}`
      }
    };
    
    if (body) options.body = JSON.stringify(body);
    
    const response = await fetch(url.toString(), options);
    if (!response.ok) throw new Error(`API request failed: ${response.status}`);
    return response.json();
  }, [token]);

  // Memoized date formatter
  const formatDate = useCallback((dateString) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const period = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;

    const ordinalSuffix = (d) => {
      if (d > 3 && d < 21) return 'th';
      switch (d % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };

    return `${day}${ordinalSuffix(day)} ${month} ${year}, ${formattedHours}:${minutes} ${period}`;
  }, []);

  // Fetch event data
  useEffect(() => {
    const fetchEventData = async () => {
      try {
        const event = await apiCall(`${API_CONFIG.ENDPOINTS.EVENTS}/${event_id}`);
        setEventData(event);
      } catch (error) {
        console.error('Error fetching event data:', error);
      }
    };

    fetchEventData();
  }, [apiCall, event_id]);

  // Fetch contestant data
  useEffect(() => {
    const fetchContestants = async () => {
      try {
        const contestants = await apiCall(API_CONFIG.ENDPOINTS.CONTESTANTS, 'GET', { event_id });
        setContestants(contestants);
      } catch (error) {
        console.error('Error fetching contestant data:', error);
      }
    };

    fetchContestants();
  }, [apiCall, event_id]);

  // Process payment data
  const processPaymentData = useCallback((payments, type) => {
    return payments
      .filter(item => item.event_id == event_id && item.status === 'S')
      .map((item) => {
        let currency = 'USD';
        const processor = item.processor?.toUpperCase();
        let paymentType = '';

        if (type === 'regular') {
          if (['ESEWA', 'KHALTI', 'FONEPAY', 'PRABHUPAY'].includes(processor)) {
            currency = 'NPR';
          } else if (['PHONEPE', 'PAYU'].includes(processor)) {
            currency = 'INR';
          } else if (processor === 'STRIPE') {
            currency = item.currency?.toUpperCase() || 'USD';
          }

          if (processor === 'FONEPAY') {
            paymentType = 'iMobile Banking';
          } else if (processor === 'PHONEPE') {
            paymentType = 'India';
          } else if (['PAYU', 'STRIPE'].includes(processor)) {
            paymentType = 'International';
          } else {
            paymentType = processor ? processor.charAt(0).toUpperCase() + processor.slice(1) : '';
          }
        } else if (type === 'qr') {
          currency = 'NPR';
          paymentType = 'FonePayQR';
        }

        const votes = calculateVotes(item.amount, currency);
        const contestant = contestants.find((c) => c.id === item.intent_id);
        const contestantName = contestant ? contestant.name : 'Unknown';

        return {
          name: item.name,
          email: item.email || 'N/A',
          phone: item.phone_no || 'N/A',
          createdAt: item.created_at,
          formattedCreatedAt: formatDate(item.created_at),
          amount: item.amount,
          status: statusLabel[item.status] || { label: item.status, color: '#6C757D' },
          paymentType,
          votes,
          currency,
          contestantName,
        };
      });
  }, [event_id, contestants, formatDate]);

  // Fetch and process all payment data
  useEffect(() => {
    const fetchAllData = async () => {
      if (!eventData || !contestants.length) return;
      
      setLoading(true);
      try {
        // Fetch all data in parallel
        const [regularPayments, qrPayments] = await Promise.all([
          apiCall(API_CONFIG.ENDPOINTS.PAYMENT_INTENTS, 'GET', { event_id }),
          apiCall(API_CONFIG.ENDPOINTS.QR_INTENTS, 'GET', { event_id })
        ]);

        // Process data in parallel
        const [processedRegularData, processedQRData] = await Promise.all([
          processPaymentData(regularPayments, 'regular'),
          processPaymentData(
            qrPayments.filter(item => item.processor?.toUpperCase() === 'QR'), 
            'qr'
          )
        ]);

        // Combine all data
        const combinedData = [
          ...processedRegularData,
          ...processedQRData,
          ...nqrTransactions
        ]
          .filter(item => item.votes > 0)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        setData(combinedData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [token, event_id, eventData, contestants, nqrTransactions, processPaymentData, apiCall]);

  // CSV export handler
  const handleExport = useCallback(() => {
    try {
      const headers = [
        'Vote By', 'Vote To', 'Phone', 'Votes', 'Status', 
        'Payment Type', 'Currency', 'Transaction Time'
      ];

      const rows = data.map(row => [
        row.name,
        row.contestantName,
        row.phone,
        row.votes,
        row.status.label,
        row.paymentType,
        row.currency,
        row.formattedCreatedAt,
      ]);

      const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = 'realtime_voting_report.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  }, [data]);

  // Pagination logic
  const paginationData = useMemo(() => {
    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;
    return {
      currentData: data.slice(indexOfFirstRow, indexOfLastRow),
      totalPages: Math.ceil(data.length / rowsPerPage)
    };
  }, [data, currentPage, rowsPerPage]);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
  }, []);

  return (
    <div className="table-container">
      <div className="table-header">
        <h3>Realtime Voting Data</h3>
        <button 
          className="export-btn" 
          onClick={handleExport} 
          disabled={loading || data.length === 0}
        >
          <FaDownload className="export-icon" /> Export
        </button>
      </div>

      {(loading || nqrLoading) && (
        <div className="loading-indicator">Loading data...</div>
      )}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Vote By</th>
              <th>Vote To</th>
              <th>Phone</th>
              <th>Votes</th>
              <th>Status</th>
              <th>Payment Type</th>
              <th>Currency</th>
              <th>Transaction Time</th>
            </tr>
          </thead>
          <tbody>
            {paginationData.currentData.length > 0 ? (
              paginationData.currentData.map((row, index) => (
                <tr key={`${row.createdAt}-${index}`}>
                  <td>{row.name}</td>
                  <td>{row.contestantName}</td>
                  <td>{row.phone}</td>
                  <td>{row.votes}</td>
                  <td>
                    <span className="status" style={{ 
                      backgroundColor: row.status.color, 
                      color: '#fff' 
                    }}>
                      {row.status.label}
                    </span>
                  </td>
                  <td>{row.paymentType}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <ReactCountryFlag
                        countryCode={currencyToCountry[row.currency]}
                        svg
                        style={{ width: '20px', height: '15px' }}
                      />
                      <span>{row.currency}</span>
                    </div>
                  </td>
                  <td>{row.formattedCreatedAt}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center' }}>
                  {loading || nqrLoading ? 'Loading data...' : 'No voting data available for this event.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data.length > 0 && (
        <div className="pagination">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || loading}
            className="pagination-btn"
          >
            Prev
          </button>
          <span className="page-info">
            Page {currentPage} of {paginationData.totalPages}
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === paginationData.totalPages || loading}
            className="pagination-btn"
          >
            Next
          </button>
        </div>
      )}

      <style jsx>{`
        .table-container {
          font-family: 'Poppins', sans-serif;
          padding: 20px;
        }
        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .export-btn {
          padding: 8px 20px;
          border: none;
          background-color: #028248;
          color: white;
          border-radius: 5px;
          cursor: pointer;
          font-weight: bold;
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: 'Poppins', sans-serif;
        }
        .export-btn:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }
        .table-wrapper {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          border: 1px solid #ddd;
          min-width: 800px;
        }
        th, td {
          padding: 12px;
          text-align: center;
          border-bottom: 1px solid #ddd;
        }
        th {
          background-color: #028248;
          font-weight: 600;
          color: #fff;
        }
        .pagination {
          margin-top: 20px;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
        }
        .status {
          padding: 5px 10px;
          border-radius: 5px;
          font-weight: bold;
          font-size: 12px;
        }
        @media (max-width: 768px) {
          .table-container {
            margin-top: -10px;
            padding: 10px;
          }
          table {
            font-size: 14px;
          }
          th, td {
            padding: 8px;
          }
        }
      `}</style>
    </div>
  );
};

export default RealtimeVoting;