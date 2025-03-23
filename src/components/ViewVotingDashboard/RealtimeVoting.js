import React, { useState, useEffect } from 'react';
import { FaDownload } from 'react-icons/fa';
import ReactCountryFlag from 'react-country-flag';
import { useToken } from '../../context/TokenContext';
import { calculateVotes } from '../AmountCalculator';

const RealtimeVoting = ({ id: event_id }) => {
  const { token } = useToken();
  const [data, setData] = useState([]);
  const [eventData, setEventData] = useState(null);
  const [contestants, setContestants] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Currency to country code mapping
  const currencyToCountry = {
    USD: 'US', // United States Dollar
    AUD: 'AU', // Australian Dollar
    GBP: 'GB', // British Pound
    CAD: 'CA', // Canadian Dollar
    EUR: 'EU', // Euro (European Union)
    AED: 'AE', // UAE Dirham
    QAR: 'QA', // Qatari Riyal
    MYR: 'MY', // Malaysian Ringgit
    KWD: 'KW', // Kuwaiti Dinar
    HKD: 'HK', // Hong Kong Dollar
    CNY: 'CN', // Chinese Yuan
    SAR: 'SA', // Saudi Riyal
    OMR: 'OM', // Omani Rial
    SGD: 'SG', // Singapore Dollar
    NOK: 'NO', // Norwegian Krone
    KRW: 'KR', // South Korean Won
    JPY: 'JP', // Japanese Yen
    THB: 'TH', // Thai Baht
    INR: 'IN', // Indian Rupee
    NPR: 'NP', // Nepalese Rupee
  };

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
        case 1:
          return 'st';
        case 2:
          return 'nd';
        case 3:
          return 'rd';
        default:
          return 'th';
      }
    };

    return `${day}${ordinalSuffix(day)} ${month} ${year}, ${formattedHours}:${minutes} ${period}`;
  };

  // Status labels and colors
  const statusLabel = {
    P: { label: 'Pending', color: '#FFA500' },
    S: { label: 'Success', color: '#28A745' },
    F: { label: 'Failed', color: '#DC3545' },
    C: { label: 'Cancelled', color: '#6C757D' },
  };

  // Fetch event data to get payment_info
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

  // Fetch payment intents data
  useEffect(() => {
    const fetchData = async () => {
      if (!eventData) return;

      try {
        // Fetch data for non-QR/NQR processors
        const response = await fetch(`https://auth.zeenopay.com/payments/intents/?event_id=${event_id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch data');
        }

        const result = await response.json();

        // Fetch data for QR/NQR processors
        const qrResponse = await fetch(`https://auth.zeenopay.com/payments/qr/intents?event_id=${event_id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!qrResponse.ok) {
          throw new Error('Failed to fetch QR/NQR data');
        }

        const qrResult = await qrResponse.json();

        // Combine both results
        const combinedData = [...result, ...qrResult];

        // Filter and map the data
        const filteredData = combinedData
          .filter((item) => item.event_id == event_id && item.status === 'S')
          .map((item) => {
            let currency = 'USD';
            const processor = item.processor?.toUpperCase();

            if (['ESEWA', 'KHALTI', 'FONEPAY', 'PRABHUPAY', 'NQR', 'QR'].includes(processor)) {
              currency = 'NPR';
            } else if (['PHONEPE', 'PAYU'].includes(processor)) {
              currency = 'INR';
            } else if (processor === 'STRIPE') {
              currency = item.currency?.toUpperCase() || 'USD';
            }

            // Use the imported utility function to calculate votes
            const votes = calculateVotes(item.amount, currency);

            // Determine payment type display value
            let paymentType;
            if (processor === 'NQR') {
              paymentType = 'NepalPayQR';
            } else if (processor === 'QR') {
              paymentType = 'FonePayQR';
            } else if (processor === 'FONEPAY') {
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

            // Find the contestant name
            const contestant = contestants.find((contestant) => contestant.id === item.intent_id);
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

        const sortedData = filteredData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        setData(sortedData);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, [token, event_id, eventData, contestants]);

  // Handle CSV export (Frontend-only)
  const handleExport = () => {
    try {
      // Prepare the CSV headers
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

      // Prepare the CSV rows
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

      // Combine headers and rows into a CSV string
      const csvContent =
        headers.join(',') + '\n' + rows.map((row) => row.join(',')).join('\n');

      // Create a Blob and download the CSV file
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
          <button className="export-btn" onClick={handleExport}>
            <FaDownload className="export-icon" /> Export
          </button>
        </div>
      </div>

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
                  No data available for this event.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="pagination">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="pagination-btn"
        >
          Prev
        </button>

        <span className="page-info">
          Page {currentPage} of {totalPages}
        </span>

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="pagination-btn"
        >
          Next
        </button>
      </div>

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