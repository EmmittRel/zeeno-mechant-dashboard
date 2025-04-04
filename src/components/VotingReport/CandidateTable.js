import React, { useState, useEffect } from "react";
import "../../assets/table.css";
import { useToken } from "../../context/TokenContext";
import { useParams } from "react-router-dom";
import { FaEye, FaEdit, FaTrash, FaDownload, FaSort, FaSortAmountDown } from "react-icons/fa";
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
    const response = await fetch(url, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      ...(Object.keys(params).length && { params })
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
    key: null,
    direction: "asc",
  });
  const [nqrTransactions, setNqrTransactions] = useState([]);
  const itemsPerPage = 10;

  const { token } = useToken();
  const { event_id } = useParams();

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

  useEffect(() => {
    const fetchData = async () => {
      if (!event_id) {
        setError("Event ID is missing. Please provide a valid event ID.");
        setLoading(false);
        return;
      }

      if (!token) {
        setError("Token not found. Please log in again.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch all data in parallel
        const [events, nqrData, contestants, paymentIntents, qrPaymentIntents] = await Promise.all([
          apiService.get(API_CONFIG.ENDPOINTS.EVENTS, token),
          apiService.post(
            API_CONFIG.ENDPOINTS.NQR_TRANSACTIONS, 
            token, 
            {
              'start_date': API_CONFIG.DEFAULT_DATES.START_DATE,
              'end_date': new Date().toISOString().split('T')[0]
            }
          ),
          apiService.get(API_CONFIG.ENDPOINTS.CONTESTANTS, token, { event_id }),
          apiService.get(API_CONFIG.ENDPOINTS.PAYMENT_INTENTS, token, { event_id }),
          apiService.get(API_CONFIG.ENDPOINTS.QR_INTENTS, token, { event_id })
        ]);

        // Set payment info from event data
        const event = events.find(e => e.id === parseInt(event_id));
        if (!event) throw new Error("Event not found");
        setPaymentInfo(event.payment_info);

        // Filter QR payments to exclude NQR
        const filteredQrPaymentIntents = qrPaymentIntents.filter(
          intent => intent.processor?.toUpperCase() === "QR"
        );

        // Set NQR transactions
        setNqrTransactions(nqrData.transactions?.responseBody?.filter(txn => txn.debitStatus === '000') || []);

        // Combine all payment sources
        const allPaymentIntents = [
          ...paymentIntents,
          ...filteredQrPaymentIntents,
          ...nqrTransactions.map(txn => ({
            intent_id: getIntentIdFromNQR(txn.addenda1, txn.addenda2),
            amount: txn.amount,
            currency: 'NPR',
            processor: 'NQR',
            status: 'S'
          }))
        ];

        // Filter successful transactions
        const successfulPaymentIntents = allPaymentIntents.filter(
          (intent) => intent.status === 'S'
        );

        // Calculate votes for each contestant
        const candidatesWithVotes = contestants.map((contestant) => {
          let totalVotes = 0;

          successfulPaymentIntents.forEach((intent) => {
            if (intent.intent_id?.toString() === contestant.id.toString()) {
              let currency = 'USD';
              const processor = intent.processor?.toUpperCase();

              if (["ESEWA", "KHALTI", "FONEPAY", "PRABHUPAY", "QR", "NQR"].includes(processor)) {
                currency = 'NPR';
              } else if (["PHONEPE", "PAYU"].includes(processor)) {
                currency = 'INR';
              } else if (processor === "STRIPE") {
                currency = intent.currency?.toUpperCase() || 'USD';
              }

              totalVotes += calculateVotes(intent.amount, currency);
            }
          });

          return {
            ...contestant,
            votes: totalVotes,
          };
        });

        setData(candidatesWithVotes);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [event_id, token, paymentInfo]);

  // Sorting logic
  const sortedData = React.useMemo(() => {
    let sortableData = [...data];
    if (sortConfig.key) {
      sortableData.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
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
    setSortConfig({ key, direction });
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

      const updatedData = data.map((candidate) =>
        candidate.id === updatedCandidate.id ? updatedCandidate : candidate
      );
      setData(updatedData);
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
      <FaSort style={{ fontSize: "14px" }} />
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
              <th>Name</th>
              <th>C.No.</th>
              <th>Status</th>
              <th>Votes</th>
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
                  <td>{candidate.votes.toLocaleString()}</td>
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