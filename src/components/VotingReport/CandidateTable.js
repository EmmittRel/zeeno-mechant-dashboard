import React, { useState, useEffect, useCallback } from "react";
import "../../assets/table.css";
import { useToken } from "../../context/TokenContext";
import { useParams } from "react-router-dom";
import { FaEye, FaEdit, FaTrash, FaDownload, FaSort, FaSortAmountDown, FaSortUp, FaSortDown } from "react-icons/fa";
import * as XLSX from "xlsx";
import CandidateModel from "./CandidateModal";
import { calculateVotes } from '../AmountCalculator';

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
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    const queryParams = new URLSearchParams(params).toString();
    const fullUrl = queryParams ? `${url}?${queryParams}` : url;
    
    const response = await fetch(fullUrl, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
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
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`API request failed: ${response.status}`);
    return response.json();
  },

  put: async (endpoint, token, data = {}) => {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`API request failed: ${response.status}`);
    return response.json();
  },

  delete: async (endpoint, token) => {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    if (!response.ok) throw new Error(`API request failed: ${response.status}`);
    return response.json();
  },

  // Helper methods specific to our needs
  getContestants: async (event_id, token) => {
    return apiService.get(API_CONFIG.ENDPOINTS.CONTESTANTS, token, { event_id });
  },

  getPaymentIntents: async (event_id, token) => {
    return apiService.get(API_CONFIG.ENDPOINTS.PAYMENT_INTENTS, token, { event_id });
  },

  getQrIntents: async (event_id, token) => {
    return apiService.get(API_CONFIG.ENDPOINTS.QR_INTENTS, token, { event_id });
  },

  getNqrTransactions: async (token, end_date, start_date = API_CONFIG.DEFAULT_DATES.START_DATE) => {
    return apiService.post(
      API_CONFIG.ENDPOINTS.NQR_TRANSACTIONS, 
      token, 
      { start_date, end_date }
    );
  }
};

// Helper function to extract intent_id from NQR transaction
const getIntentIdFromNQR = (addenda1, addenda2) => {
  try {
    const combined = `${addenda1}-${addenda2}`;
    const hexMatch = combined.match(/vnpr-([a-f0-9]+)/i);
    return hexMatch?.[1] ? parseInt(hexMatch[1], 16) : null;
  } catch (error) {
    console.error('Error extracting intent_id from NQR:', error);
    return null;
  }
};

const CandidateTable = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    period: "",
    status: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [sortConfig, setSortConfig] = useState({
    key: "misc_kv",  // Default sort by C.No.
    direction: "asc", // Default ascending order
    numeric: true     // Treat as numeric for proper sorting
  });
  const itemsPerPage = 10;

  const { token } = useToken();
  const { event_id } = useParams();

  const fetchAllPayments = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    try {
      const [regularPayments, qrPayments, nqrData] = await Promise.all([
        apiService.getPaymentIntents(event_id, token),
        apiService.getQrIntents(event_id, token),
        apiService.getNqrTransactions(token, today)
      ]);

      return [
        ...regularPayments.filter(p => p.status === 'S'),
        ...qrPayments.filter(p => p.status === 'S' && p.processor?.toUpperCase() === "QR"),
        ...(nqrData.transactions?.responseBody?.filter(txn => txn.debitStatus === '000') || []).map(txn => ({
          intent_id: getIntentIdFromNQR(txn.addenda1, txn.addenda2),
          amount: txn.amount,
          currency: 'NPR',
          processor: 'NQR',
          status: 'S'
        }))
      ];
    } catch (error) {
      console.error('Error fetching payments:', error);
      throw error;
    }
  }, [event_id, token]);

  const processCandidates = useCallback((contestants, payments) => {
    return contestants.map(contestant => {
      const totalVotes = payments
        .filter(p => p.intent_id?.toString() === contestant.id.toString())
        .reduce((sum, payment) => {
          const processor = payment.processor?.toUpperCase();
          let currency = payment.currency?.toUpperCase() || 'USD';

          if (["ESEWA", "KHALTI", "FONEPAY", "PRABHUPAY", "QR", "NQR"].includes(processor)) {
            currency = 'NPR';
          } else if (["PHONEPE", "PAYU"].includes(processor)) {
            currency = 'INR';
          } else if (processor === "STRIPE") {
            currency = payment.currency?.toUpperCase() || 'USD';
          }

          return sum + calculateVotes(payment.amount, currency);
        }, 0);

      return { 
        ...contestant, 
        votes: totalVotes,
        formattedVotes: totalVotes.toLocaleString()
      };
    });
  }, []);

  const fetchData = useCallback(async () => {
    if (!event_id || !token) {
      setError(!event_id ? "Event ID is missing" : "Token not found");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [contestants, payments, events] = await Promise.all([
        apiService.getContestants(event_id, token),
        fetchAllPayments(),
        apiService.get(API_CONFIG.ENDPOINTS.EVENTS, token)
      ]);

      // Set payment info from event data
      const event = events.find(e => e.id === parseInt(event_id));
      if (!event) throw new Error("Event not found");
      setPaymentInfo(event.payment_info);

      // Process candidates and apply initial sorting
      const processed = processCandidates(contestants, payments);
      setData(processed);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [event_id, token, fetchAllPayments, processCandidates]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Enhanced sorting logic
  const sortedData = React.useMemo(() => {
    let sortableData = [...data];
    if (sortConfig.key) {
      sortableData.sort((a, b) => {
        // Handle numeric sorting for specific keys
        if (sortConfig.numeric) {
          const numA = parseFloat(a[sortConfig.key]) || 0;
          const numB = parseFloat(b[sortConfig.key]) || 0;
          return sortConfig.direction === "asc" ? numA - numB : numB - numA;
        }
        
        // Default string comparison
        const valueA = String(a[sortConfig.key] || "").toLowerCase();
        const valueB = String(b[sortConfig.key] || "").toLowerCase();
        
        if (valueA < valueB) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (valueA > valueB) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableData;
  }, [data, sortConfig]);

  // Handle sorting
  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    
    // Determine if this should be numeric sorting
    const numericKeys = ["misc_kv", "votes"];
    setSortConfig({ 
      key, 
      direction,
      numeric: numericKeys.includes(key)
    });
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setSelectedCandidate(null);
    setIsEditMode(false);
  };

  const handleView = (candidate) => {
    setSelectedCandidate(candidate);
    setIsModalVisible(true);
    setIsEditMode(false);
  };

  const handleEdit = (candidate) => {
    setSelectedCandidate(candidate);
    setIsModalVisible(true);
    setIsEditMode(true);
  };

  const handleUpdateCandidate = async (updatedCandidate) => {
    try {
      await apiService.put(
        `${API_CONFIG.ENDPOINTS.CONTESTANTS}${updatedCandidate.id}/`,
        token,
        updatedCandidate
      );

      setData(data.map((candidate) =>
        candidate.id === updatedCandidate.id ? updatedCandidate : candidate
      ));
      alert("Candidate updated successfully.");
      handleCloseModal();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this candidate?")) return;

    try {
      await apiService.delete(
        `${API_CONFIG.ENDPOINTS.CONTESTANTS}${id}/`,
        token
      );

      setData(data.filter((candidate) => candidate.id !== id));
      alert("Candidate deleted successfully.");
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredData = Array.isArray(sortedData)
    ? sortedData.filter((candidate) => {
        const isPeriodMatch =
          filters.period === "" || candidate.period === filters.period;
        const isStatusMatch =
          filters.status === "" || candidate.status === filters.status;

        return isPeriodMatch && isStatusMatch;
      })
    : [];

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleExport = () => {
    const dataForExport = filteredData.map((candidate) => ({
      ID: candidate.misc_kv,
      Avatar: candidate.avatar,
      Name: candidate.name,
      Status: candidate.status,
      Votes: candidate.votes,
      Bio: candidate.bio,
    }));

    const ws = XLSX.utils.json_to_sheet(dataForExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Candidates");
    XLSX.writeFile(wb, "candidates_data.xlsx");
  };

  const statusMapping = {
    O: "Ongoing",
    E: "Eliminated",
    H: "Hidden",
    C: "Closed",
  };

  if (loading)
    return (
      <div className="loader">
        <p>Loading...</p>
      </div>
    );
  if (error)
    return (
      <div className="error">
        <p>{error}</p>
      </div>
    );

  return (
    <div className="table-container">
      <div className="table-header">
        <div className="search-bar">
          <h3>Candidate List</h3>
        </div>
        <div
          className="actions"
          style={{
            display: "flex",
            flexWrap: "wrap", 
            alignItems: "center",
            gap: "15px",
            backgroundColor: "#f8f9fa",
            padding: "10px",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
          }}
        >
          <div style={{
            display: "flex",
            flexWrap: "nowrap", 
            gap: "15px",
            alignItems: "center",
            minWidth: "fit-content" 
          }}>
            {/* Sort by Dropdown */}
            <div style={{ position: "relative", minWidth: "120px" }}>
              <select
                id="sort-by"
                onChange={(e) => requestSort(e.target.value)}
                value={sortConfig.key || ""}
                style={{
                  padding: "8px 12px",
                  paddingRight: "32px",
                  borderRadius: "6px",
                  border: "1px solid #ced4da",
                  backgroundColor: "#fff",
                  fontSize: "14px",
                  color: "#495057",
                  cursor: "pointer",
                  outline: "none",
                  transition: "border-color 0.3s ease",
                  appearance: "none",
                  WebkitAppearance: "none",
                  MozAppearance: "none",
                  width: "100%",
                }}
              >
                <option value="">Sort By</option>
                <option value="name">Name</option>
                <option value="misc_kv">C.No.</option>
                <option value="votes">Votes</option>
              </select>
              <FaSortAmountDown 
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "14px",
                  color: "#495057",
                  pointerEvents: "none",
                }}
              />
            </div>

            {/* Ascending/Descending Button */}
            <button
              onClick={() =>
                setSortConfig({
                  ...sortConfig,
                  direction: sortConfig.direction === "asc" ? "desc" : "asc",
                })
              }
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #ced4da",
                backgroundColor: "#fff",
                fontSize: "14px",
                color: "#495057",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "background-color 0.3s ease, border-color 0.3s ease",
                whiteSpace: "nowrap",
              }}
            >
              {sortConfig.direction === "asc" ? <FaSortUp /> : <FaSortDown />}
              {sortConfig.direction === "asc" ? "Ascending" : "Descending"}
            </button>
          </div>
        </div>

        <button
          onClick={handleExport}
          title="Export"
          className="icon-btn export-btn"
          style={{
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid #ced4da",
            backgroundColor: "#028248",
            color: "white",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "background-color 0.3s ease",
            whiteSpace: "nowrap",
            marginLeft: "30px",
          }}
        >
          <FaDownload style={{ fontSize: "14px" }} />
          Export
        </button>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>S.No.</th>
              <th>Avatar</th>
              <th>
                <button 
                  onClick={() => requestSort("name")}
                  style={{ all: 'unset', cursor: 'pointer' }}
                >
                  Name 
                  {sortConfig.key === "name" && (sortConfig.direction === "asc" ? <FaSortUp /> : <FaSortDown />)}
                </button>
              </th>
              <th>
                <button 
                  onClick={() => requestSort("misc_kv")}
                  style={{ all: 'unset', cursor: 'pointer'}}
                >
                  C.No.
                  {sortConfig.key === "misc_kv" && (sortConfig.direction === "asc" ? <FaSortUp /> : <FaSortDown />)}
                </button>
              </th>
              <th>Status</th>
              <th>
                <button 
                  onClick={() => requestSort("votes")}
                  style={{ all: 'unset', cursor: 'pointer'}}
                >
                  Votes
                  {sortConfig.key === "votes" && (sortConfig.direction === "asc" ? <FaSortUp /> : <FaSortDown />)}
                </button>
              </th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: "center" }}>
                  No candidates found.
                </td>
              </tr>
            ) : (
              paginatedData.map((candidate, index) => (
                <tr key={candidate.id}>
                  <td>{startIndex + index + 1}</td>
                  <td>
                    <img
                      src={candidate.avatar}
                      alt={`${candidate.name}'s avatar`}
                      style={{
                        width: "50px",
                        height: "50px",
                        borderRadius: "50%",
                      }}
                    />
                  </td>
                  <td>{candidate.name}</td>
                  <td>{candidate.misc_kv}</td>
                  <td>
                    <span
                      className={`status-badge 
                        ${candidate.status === "O" ? "status-ongoing" :
                        candidate.status === "E" ? "status-eliminated" :
                        candidate.status === "H" ? "status-hidden" :
                        candidate.status === "C" ? "status-closed" : ""}`}
                    >
                      {statusMapping[candidate.status] || "Unknown"}
                    </span>
                  </td>
                  <td>{candidate.formattedVotes || candidate.votes.toLocaleString()}</td>
                  <td>
                    <div className="action-icons">
                      <button
                        onClick={() => handleView(candidate)}
                        title="View"
                        className="icon-btn view-btn"
                      >
                        <FaEye />
                      </button>
                      <button
                        onClick={() => handleEdit(candidate)}
                        title="Edit"
                        className="icon-btn edit-btn"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => handleDelete(candidate.id)}
                        title="Delete"
                        className="icon-btn delete-btn"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="pagination">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <button
            key={page}
            className={`pagination-btn ${
              page === currentPage ? "active" : ""
            }`}
            onClick={() => handlePageChange(page)}
          >
            {page}
          </button>
        ))}
      </div>

      {/* Modal */}
      <CandidateModel
        visible={isModalVisible}
        onClose={handleCloseModal}
        title={isEditMode ? "Edit Candidate" : "Candidate Details"}
        candidate={selectedCandidate}
        isEditMode={isEditMode}
        onUpdate={handleUpdateCandidate}
      />
    </div>
  );
};

export default CandidateTable;