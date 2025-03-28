import React, { useState, useEffect } from 'react';
import { FaDownload } from 'react-icons/fa';
import ReactCountryFlag from 'react-country-flag';
import { useToken } from '../../context/TokenContext';
import { calculateVotes } from '../AmountCalculator';
import useNQRProcessor from '../useNQRProcessor';

const RealtimeVoting = ({ id: event_id }) => {
  const { token } = useToken();
  const [data, setData] = useState([]);
  const [eventData, setEventData] = useState(null);
  const [contestants, setContestants] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const rowsPerPage = 10;

  // Currency to country code mapping
  const currencyToCountry = {
    USD: 'US',
    AUD: 'AU',
    GBP: 'GB',
    CAD: 'CA',
    EUR: 'EU',
    AED: 'AE',
    QAR: 'QA',
    MYR: 'MY',
    KWD: 'KW',
    HKD: 'HK',
    CNY: 'CN',
    SAR: 'SA',
    OMR: 'OM',
    SGD: 'SG',
    NOK: 'NO',
    KRW: 'KR',
    JPY: 'JP',
    THB: 'TH',
    INR: 'IN',
    NPR: 'NP',
  };

  // Status labels and colors
  const statusLabel = {
    P: { label: 'Pending', color: '#FFA500' },
    S: { label: 'Success', color: '#28A745' },
    F: { label: 'Failed', color: '#DC3545' },
    C: { label: 'Cancelled', color: '#6C757D' },
  };

  // Use the NQR processor hook
  const { nqrData: nqrTransactions, loading: nqrLoading } = useNQRProcessor(token, event_id, contestants);

  // Function to format date
  const formatDate = (dateString) => {
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
  };

  // Fetch event data
  useEffect(() => {
    const fetchEventData = async () => {
      try {
        const response = await fetch(`https://auth.zeenopay.com/events/${event_id}/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch event data');
        }

        const result = await response.json();
        setEventData(result);
      } catch (error) {
        console.error('Error fetching event data:', error);
      }
    };

    fetchEventData();
  }, [token, event_id]);

  // Fetch contestant data
  useEffect(() => {
    const fetchContestants = async () => {
      try {
        const response = await fetch(`https://auth.zeenopay.com/events/contestants/?event_id=${event_id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch contestant data');
        }

        const result = await response.json();
        setContestants(result);
      } catch (error) {
        console.error('Error fetching contestant data:', error);
      }
    };

    fetchContestants();
  }, [token, event_id]);

  // Fetch all payment data
  useEffect(() => {
    const fetchAllData = async () => {
      if (!eventData || !contestants.length) return;
      
      setLoading(true);
      try {
        // 1. Fetch regular payment intents (non-QR)
        const regularResponse = await fetch(`https://auth.zeenopay.com/payments/intents/?event_id=${event_id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!regularResponse.ok) {
          throw new Error('Failed to fetch regular payment data');
        }
        const regularPayments = await regularResponse.json();

        // 2. Fetch QR payments (only processor = 'QR')
        const qrResponse = await fetch(`https://auth.zeenopay.com/payments/qr/intents?event_id=${event_id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!qrResponse.ok) {
          throw new Error('Failed to fetch QR data');
        }
        const qrPayments = await qrResponse.json();

        // Process regular payments (non-QR)
        const processedRegularData = regularPayments
          .filter((item) => item.event_id == event_id && item.status === 'S')
          .map((item) => {
            let currency = 'USD';
            const processor = item.processor?.toUpperCase();

            if (['ESEWA', 'KHALTI', 'FONEPAY', 'PRABHUPAY'].includes(processor)) {
              currency = 'NPR';
            } else if (['PHONEPE', 'PAYU'].includes(processor)) {
              currency = 'INR';
            } else if (processor === 'STRIPE') {
              currency = item.currency?.toUpperCase() || 'USD';
            }

            const votes = calculateVotes(item.amount, currency);

            let paymentType;
            if (processor === 'FONEPAY') {
              paymentType = 'iMobile Banking';
            } else if (processor === 'PHONEPE') {
              paymentType = 'India';
            } else if (['PAYU', 'STRIPE'].includes(processor)) {
              paymentType = 'International';
            } else {
              paymentType = processor
                ? processor.charAt(0).toUpperCase() + processor.slice(1)
                : '';
            }

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
              paymentType: paymentType,
              votes: votes,
              currency: currency,
              contestantName: contestantName,
            };
          });

        // Process QR payments (only processor = 'QR')
        const processedQRData = qrPayments
          .filter((item) => 
            item.event_id == event_id && 
            item.status === 'S' && 
            item.processor?.toUpperCase() === 'QR'
          )
          .map((item) => {
            const currency = 'NPR';
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
              paymentType: 'FonePayQR',
              votes: votes,
              currency: currency,
              contestantName: contestantName,
            };
          });

        // Combine all data, filter out 0 votes, and sort by date
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
  }, [token, event_id, eventData, contestants, nqrTransactions]);

  // Handle CSV export
  const handleExport = () => {
    try {
      const headers = [
        'Vote By',
        'Vote To',
        'Phone',
        'Votes',
        'Status',
        'Payment Type',
        'Currency',
        'Transaction Time',
      ];

      const rows = data.map((row) => [
        row.name,
        row.contestantName,
        row.phone,
        row.votes,
        row.status.label,
        row.paymentType,
        row.currency,
        row.formattedCreatedAt,
      ]);

      const csvContent =
        headers.join(',') + '\n' + rows.map((row) => row.join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'realtime_voting_report.csv';
      link.click();
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  // Pagination logic
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentData = data.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(data.length / rowsPerPage);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  return (
    <div className="table-container">
      <div className="table-header">
        <div className="search-bar">
          <h3>Realtime Voting Data</h3>
        </div>
        <div className="actions">
          <button className="export-btn" onClick={handleExport} disabled={loading || data.length === 0}>
            <FaDownload className="export-icon" /> Export
          </button>
        </div>
      </div>

      {(loading || nqrLoading) && (
        <div className="loading-indicator">
          Loading data...
        </div>
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
            {currentData.length > 0 ? (
              currentData.map((row, index) => (
                <tr key={index}>
                  <td>{row.name}</td>
                  <td>{row.contestantName}</td>
                  <td>{row.phone}</td>
                  <td>{row.votes}</td>
                  <td>
                    <span
                      className="status"
                      style={{ backgroundColor: row.status.color, color: '#fff' }}
                    >
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

      {/* Pagination */}
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
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || loading}
            className="pagination-btn"
          >
            Next
          </button>
        </div>
      )}

      <style>{
        `@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');

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

        .actions {
          display: flex;
          gap: 15px;
          align-items: center;
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

        .export-icon {
          font-size: 16px;
          font-weight: normal;
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
          font-family: 'Poppins', sans-serif;
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

        .pagination-btn {
          padding: 8px 12px;
          border: 1px solid #ddd;
          background: #f5f5f5;
          border-radius: 4px;
          cursor: pointer;
          font-family: 'Poppins', sans-serif;
        }

        .pagination-btn:disabled {
          background: #ddd;
          cursor: not-allowed;
        }

        .page-info {
          font-family: 'Poppins', sans-serif;
          font-size: 14px;
          color: #333;
        }

        .status {
          padding: 5px 10px;
          border-radius: 5px;
          font-weight: bold;
          font-size: 12px;
        }

        .loading-indicator {
          padding: 10px;
          text-align: center;
          font-style: italic;
          color: #666;
        }

        @media screen and (max-width: 768px) {
          .table-container {
            margin-top: -10px;
            padding: 10px;
          }

          .table-header {
            margin-bottom: 0px;
          }

          table {
            font-size: 14px;
          }

          th, td {
            padding: 8px;
          }

          .table-wrapper {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
        }`
      }</style>
    </div>
  );
};

export default RealtimeVoting;