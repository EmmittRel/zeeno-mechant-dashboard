import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FaDownload, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { FiLoader } from 'react-icons/fi';
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
  INR: 'IN', NPR: 'NP', ILS: 'IL'
};

const statusLabel = {
  P: { label: 'Pending', color: '#FFA500', icon: '⏳' },
  S: { label: 'Success', color: '#28A745', icon: '✓' },
  F: { label: 'Failed', color: '#DC3545', icon: '✗' },
  C: { label: 'Cancelled', color: '#6C757D', icon: '⊘' },
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
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const period = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;

    return `${month} ${day}, ${formattedHours}:${minutes} ${period}`;
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
          status: statusLabel[item.status] || { label: item.status, color: '#6C757D', icon: '?' },
          paymentType,
          votes,
          currency,
          contestantName,
          id: `${item.created_at}-${Math.random().toString(36).substr(2, 9)}`
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

  // Loading skeleton rows
  const renderLoadingRows = () => {
    return Array(rowsPerPage).fill(0).map((_, index) => (
      <tr key={`loading-${index}`} className="loading-row">
        <td><div className="loading-skeleton"></div></td>
        <td><div className="loading-skeleton"></div></td>
        <td><div className="loading-skeleton"></div></td>
        <td><div className="loading-skeleton"></div></td>
        <td><div className="loading-skeleton"></div></td>
        <td><div className="loading-skeleton"></div></td>
        <td><div className="loading-skeleton"></div></td>
        <td><div className="loading-skeleton"></div></td>
      </tr>
    ));
  };

  return (
    <div className="table-container">
      <div className="table-header">
        <div className="top-h3">Realtime Voting Data</div>
        <button 
          className="export-btn" 
          onClick={handleExport} 
          disabled={loading || data.length === 0}
        >
          <FaDownload className="export-icon" /> Export CSV
        </button>
      </div>

      {/* <div className="stats-summary">
        <div className="stat-card">
          <div className="stat-value">{data.length}</div>
          <div className="stat-label">Total Votes</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {data.reduce((sum, item) => sum + item.votes, 0).toLocaleString()}
          </div>
          <div className="stat-label">Total Vote Count</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {new Set(data.map(item => item.currency)).size}
          </div>
          <div className="stat-label">Currencies</div>
        </div>
      </div> */}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Voter</th>
              <th>Contestant</th>
              <th>Contact</th>
              <th>Votes</th>
              <th>Status</th>
              <th>Method</th>
              <th>Currency</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {(loading || nqrLoading) ? (
              renderLoadingRows()
            ) : paginationData.currentData.length > 0 ? (
              paginationData.currentData.map((row) => (
                <tr key={row.id}>
                  <td data-label="Voter">
                    <div className="voter-info">
                      <div className="voter-name">{row.name}</div>
                      {/* <div className="voter-email">{row.email}</div> */}
                    </div>
                  </td>
                  <td data-label="Contestant">{row.contestantName}</td>
                  <td data-label="Contact">{row.phone}</td>
                  <td data-label="Votes" className="votes-cell">
                    <span className="vote-count">{row.votes}</span>
                  </td>
                  <td data-label="Status">
                    <span className="status-badge" style={{ 
                      backgroundColor: `${row.status.color}20`,
                      border: `1px solid ${row.status.color}`,
                      color: row.status.color
                    }}>
                      <span className="status-icon">{row.status.icon}</span>
                      {row.status.label}
                    </span>
                  </td>
                  <td data-label="Method">{row.paymentType}</td>
                  <td data-label="Currency">
                    <div className="currency-cell">
                      <ReactCountryFlag
                        countryCode={currencyToCountry[row.currency]}
                        svg
                        style={{ width: '20px', height: '15px' }}
                        title={row.currency}
                      />
                      <span>{row.currency}</span>
                    </div>
                  </td>
                  <td data-label="Time">
                    <div className="time-cell">
                      <div className="time-text">{row.formattedCreatedAt}</div>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="no-data">
                  <div className="no-data-content">
                    <FiLoader className="no-data-icon" />
                    <div>No voting data available for this event</div>
                  </div>
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
            className="pagination-btn prev"
          >
            <FaChevronLeft />
          </button>
          
          {Array.from({ length: Math.min(5, paginationData.totalPages) }, (_, i) => {
            let pageNum;
            if (paginationData.totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= paginationData.totalPages - 2) {
              pageNum = paginationData.totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }
            
            return (
              <button
                key={pageNum}
                onClick={() => handlePageChange(pageNum)}
                disabled={loading}
                className={`pagination-btn ${currentPage === pageNum ? 'active' : ''}`}
              >
                {pageNum}
              </button>
            );
          })}
          
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === paginationData.totalPages || loading}
            className="pagination-btn next"
          >
            <FaChevronRight />
          </button>
        </div>
      )}

      <style jsx>{`
        .table-container {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          padding: 20px;
          background: #fff;
          border-radius: 12px;
          // box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
        }
        
        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 5px;
          flex-wrap: wrap;
          gap: 16px;
        }
        
        .table-header h3 {
          font-size: 1.5rem;
          font-weight: 600;
          color: #1a1a1a;
          margin: 0;
        }
        
        .export-btn {
          padding: 10px 16px;
          border: none;
          background-color: #4CAF50;
          color: white;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.9rem;
          transition: all 0.2s ease;
        }
        
        .export-btn:hover:not(:disabled) {
          background-color: #3d8b40;
          transform: translateY(-1px);
        }
        
        .export-btn:disabled {
          background-color: #a5d6a7;
          cursor: not-allowed;
          opacity: 0.7;
        }
        
        .stats-summary {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        
        .stat-card {
          flex: 1;
          min-width: 150px;
          background: #f8f9fa;
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #2c3e50;
          margin-bottom: 4px;
        }
        
        .stat-label {
          font-size: 0.85rem;
          color: #7f8c8d;
          font-weight: 500;
        }
        
        .table-wrapper {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          border-radius: 8px;
          // border: 1px solid #e0e0e0;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          min-width: 800px;
        }
        
        th, td {
          padding: 14px 16px;
          border-bottom: 1px solid #e0e0e0;
        }
        
        th {
          background-color: #f5f7fa;
          font-weight: 600;
          color: #4a5568;
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        td {
          color: #2d3748;
          font-size: 0.95rem;
          vertical-align: middle;
        }
        
        .voter-info {
          display: flex;
          flex-direction: column;
        }
        
        .voter-name {
          font-weight: 500;
        }
        
        .voter-email {
          font-size: 0.8rem;
          color: #718096;
          margin-top: 2px;
        }
        
        .votes-cell {
          font-weight: 600;
          color: #2b6cb0;
        }
        
        .status-badge {
          padding: 6px 10px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        
        .status-icon {
          font-size: 0.9rem;
        }
        
        .currency-cell {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .time-cell {
          display: flex;
          flex-direction: column;
        }
        
        .time-text {
          font-size: 0.85rem;
          color: #4a5568;
        }
        
        .pagination {
          margin-top: 24px;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        
        .pagination-btn {
          padding: 8px 12px;
          border: 1px solid #e2e8f0;
          background: white;
          color: #4a5568;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 36px;
          height: 36px;
          transition: all 0.2s ease;
        }
        
        .pagination-btn:hover:not(:disabled) {
          background: #edf2f7;
          border-color: #cbd5e0;
        }
        
        .pagination-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .pagination-btn.active {
          background: #4299e1;
          border-color: #4299e1;
          color: white;
        }
        
        .loading-row td {
          padding: 12px 16px;
        }
        
        .loading-skeleton {
          height: 20px;
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          border-radius: 4px;
          animation: shimmer 1.5s infinite linear;
        }
        
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        
        .no-data {
          padding: 40px 20px;
          text-align: center;
        }
        
        .no-data-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          color: #718096;
        }
        
        .no-data-icon {
          font-size: 2rem;
          color: #cbd5e0;
          animation: spin 1s linear infinite;
        }
        
         .top-h3 {
            font-size: 1.2rem;
            // margin-bottom: 20px;
            color: #333;
            font-weight: 600;
            text-align: left;
          }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        /* Mobile responsiveness */
        @media (max-width: 768px) {
          .table-container {
            // padding: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
          margin-top: 30px;
          }

           .top-h3 {
            font-size: 1.2rem;
         
            color: #333;
            font-weight: 600;
            text-align: left;
          }
          
          .table-header {
            flex-direction: column;
            align-items: flex-start;
            
          }
          
          .export-btn {
            display: none;
          }
          
          .stats-summary {
            flex-direction: column;
            gap: 12px;
          }
          
          .stat-card {
            min-width: 100%;
          }
          
          table {
            min-width: 100%;
            border: none;
          }

          
          
          thead {
            display: none;
          }
          
          tr {
            display: block;
            margin-bottom: 16px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px;
          }
          
          td {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #f0f0f0;
          }
          
          td:last-child {
            border-bottom: none;
          }
          
          td::before {
            content: attr(data-label);
            font-weight: 600;
            color: #4a5568;
            margin-right: 12px;
            font-size: 0.85rem;
          }
          
          .status-badge, .currency-cell {
            justify-content: flex-end;
          }
          
          .pagination {
            gap: 4px;
          }
          
          .pagination-btn {
            min-width: 32px;
            height: 32px;
            padding: 4px 8px;
          }

        }
      `}</style>
    </div>
  );
};

export default RealtimeVoting;