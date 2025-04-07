import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useToken } from '../../context/TokenContext';
import {
  FaSearch,
  FaDownload,
  FaPhoneAlt,
  FaEye,
  FaTimes,
  FaSpinner,
  FaChevronLeft,
  FaChevronRight
} from "react-icons/fa";
import { FiLoader } from "react-icons/fi";
import PopupModal from "./popupmodal";
import html2pdf from "html2pdf.js";

const TableComponent = () => {
  const [data, setData] = useState([]);
  const [eventId, setFormId] = useState(null);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { token } = useToken();
  const [paymentIntents, setPaymentIntents] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRowData, setSelectedRowData] = useState(null);

  // Loading state for eventId
  const [isEventIdLoading, setIsEventIdLoading] = useState(true);

  const [filters, setFilters] = useState({
    period: "",
    paymentStatus: "",
    approvalStatus: "",
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  // Extract eventId from URL
  useEffect(() => {
    const pathSegments = window.location.pathname.split("/");
    const id = pathSegments[pathSegments.length - 1];
    setFormId(id);
    setIsEventIdLoading(false);
  }, []);

  // Transform API data with payment status check
  const transformApiData = (apiResponseArray, paymentIntentsArray) => {
    return apiResponseArray.map((apiResponse) => {
      try {
        if (!apiResponse.response) {
          console.error("Missing response in API response:", apiResponse);
          return {};
        }

        const response = apiResponse.response;
        
        // Check if action_id exists in payment intents
        const matchingPayment = paymentIntentsArray.find(
          intent => intent.action_id === apiResponse.action_id
        );

        // Determine payment status
        let paymentStatus = "Pending";
        if (matchingPayment) {
          // For Esewa payments, status 'S' means Success
          if (matchingPayment.processor === 'ESEWA' && matchingPayment.status === 'S') {
            paymentStatus = "Success";
          }
          // For regular payments
          else if (matchingPayment.status === 'success') {
            paymentStatus = "Success";
          } else if (matchingPayment.status === 'failed') {
            paymentStatus = "Failed";
          }
        }

        return {
          id: apiResponse.id, 
          name: response.name || "N/A",
          email: response.email || "N/A",
          phone: response.contactNumber || "N/A",
          paymentStatus: paymentStatus,
          status: "Pending",
          imageUrl: response.image || "",
          age: response.age || "N/A",
          location: response.temporaryAddress || response.permanentAddress || "N/A",
          parentName: response.guardianName || "N/A",
          category: response.reason || "N/A",
          dateOfBirth: response.dateOfBirth || "N/A",
          gender: response.gender || "N/A",
          weight: response.weight || "N/A",
          height: response.height || "N/A",
          optionalNumber: response.optionalNumber || "N/A",
          source: response.source || "N/A",
          temporaryAddress: response.temporaryAddress || "N/A",
          permanentAddress: response.permanentAddress || "N/A",
          action_id: apiResponse.action_id,
          schoolName: response.schoolName || "N/A",
          createdAt: apiResponse.created_at || new Date().toISOString()
        };
      } catch (error) {
        console.error("Error parsing response:", error);
        return {};
      }
    });
  };

  // Format date for display
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

  // Status styling
  const statusLabel = {
    Success: { label: 'Success', color: '#28A745', icon: '✓' },
    Pending: { label: 'Pending', color: '#FFA500', icon: '⏳' },
    Failed: { label: 'Failed', color: '#DC3545', icon: '✗' }
  };

  // Fetch data when eventId is available
  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        if (!eventId) return;

        // Fetch all data in parallel
        const [regularResponse, qrResponse, formResponse] = await Promise.all([
          fetch(`https://auth.zeenopay.com/payments/intents/?event_id=${eventId}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`https://auth.zeenopay.com/payments/qr/intents?event_id=${eventId}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`https://auth.zeenopay.com/events/form/responses/${eventId}/`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        const [regularData, qrData, apiData] = await Promise.all([
          regularResponse.ok ? regularResponse.json() : [],
          qrResponse.ok ? qrResponse.json() : [],
          formResponse.ok ? formResponse.json() : []
        ]);

        const combinedPaymentIntents = [...regularData, ...qrData];
        
        if (isMounted) {
          setPaymentIntents(combinedPaymentIntents);
          
          // Filter and transform data
          const eventIdNumber = Number(eventId);
          const filteredApiData = Array.isArray(apiData) 
            ? apiData.filter(item => Number(item.form) === eventIdNumber)
            : [];
          
          const transformedData = transformApiData(filteredApiData, combinedPaymentIntents);
          setData(transformedData);
          setFilteredData(transformedData);
        }
      } catch (error) {
        if (isMounted) {
          setError(error.message);
          setData([]);
          setFilteredData([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (eventId && !isEventIdLoading) {
      fetchData();
    }

    return () => {
      isMounted = false;
    };
  }, [eventId, token, isEventIdLoading]);

  // Apply filters and search when they change
  useEffect(() => {
    let result = [...data];

    // Apply search filter
    if (debouncedQuery) {
      result = result.filter((row) =>
        row.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        row.email.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        row.phone.toLowerCase().includes(debouncedQuery.toLowerCase())
      );
    }

    // Apply payment status filter
    if (filters.paymentStatus) {
      result = result.filter(row => row.paymentStatus === filters.paymentStatus);
    }

    // Apply approval status filter
    if (filters.approvalStatus) {
      result = result.filter(row => row.status === filters.approvalStatus);
    }

    setFilteredData(result);
    setCurrentPage(1);
  }, [data, debouncedQuery, filters.paymentStatus, filters.approvalStatus]);

  const handleDeleteClick = (id) => {
    setDeleteCandidate(id);
    setShowDeleteModal(true);
  };

  const handleDeleteResponse = async () => {
    if (!deleteCandidate) return;
    
    setDeletingId(deleteCandidate);
    setShowDeleteModal(false);
    
    try {
      const response = await fetch(
        `https://auth.zeenopay.com/events/form/response/${deleteCandidate}/`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete response: ${response.statusText}`);
      }

      // Optimistically update the state
      setData(prevData => prevData.filter(item => item.id !== deleteCandidate));
      setFilteredData(prevData => prevData.filter(item => item.id !== deleteCandidate));
      
    } catch (error) {
      console.error("Error deleting response:", error);
      alert(`Error deleting response: ${error.message}`);
    } finally {
      setDeletingId(null);
      setDeleteCandidate(null);
    }
  };

  const handleExport = useCallback(() => {
    try {
      const headers = [
        "Name", "Email", "Phone", "Age", "Location", "Guardian Name", 
        "Reason", "Date of Birth", "Gender", "Weight", "Height", 
        "Optional Number", "Source", "School Name", "Payment Status", "Status"
      ];

      const rows = filteredData.map(row => [
        row.name,
        row.email,
        row.phone,
        row.age,
        row.location,
        row.parentName,
        row.category,
        row.dateOfBirth,
        row.gender,
        row.weight,
        row.height,
        row.optionalNumber,
        row.source,
        row.schoolName,
        row.paymentStatus,
        row.status,
      ]);

      const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = 'registration_data.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  }, [filteredData]);

  const handleViewClick = (row) => {
    setSelectedRowData(row);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRowData(null);
  };

  const handleDownloadPDF = (row) => {
    const element = document.createElement("div");
    element.innerHTML = `
      <h2>Detailed Information</h2>
      <div>
        <p><strong>Name:</strong> ${row.name}</p>
        <p><strong>Email:</strong> ${row.email}</p>
        <p><strong>Phone:</strong> ${row.phone}</p>
        <p><strong>Optional Number:</strong> ${row.optionalNumber}</p>
        <p><strong>Age:</strong> ${row.age}</p>
        <p><strong>Date of Birth:</strong> ${row.dateOfBirth}</p>
        <p><strong>Gender:</strong> ${row.gender}</p>
        <p><strong>Weight:</strong> ${row.weight}</p>
        <p><strong>Height:</strong> ${row.height}</p>
        <p><strong>School Name:</strong> ${row.schoolName}</p>
        <p><strong>Temporary Address:</strong> ${row.temporaryAddress}</p>
        <p><strong>Permanent Address:</strong> ${row.permanentAddress}</p>
        <p><strong>Guardian Name:</strong> ${row.parentName}</p>
        <p><strong>Reason:</strong> ${row.category}</p>
        <p><strong>Source:</strong> ${row.source}</p>
        <p><strong>Payment Status:</strong> ${row.paymentStatus}</p>
        <p><strong>Status:</strong> ${row.status}</p>
        ${row.imageUrl ? `<img src="${row.imageUrl}" alt="${row.name}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; margin-top: 10px;" />` : ""}
      </div>
    `;

    const opt = {
      margin: 10,
      filename: `${row.name}_details.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    html2pdf().from(element).set(opt).save();
  };

  // Pagination logic
  const paginationData = useMemo(() => {
    const indexOfLastRow = currentPage * itemsPerPage;
    const indexOfFirstRow = indexOfLastRow - itemsPerPage;
    return {
      currentData: filteredData.slice(indexOfFirstRow, indexOfLastRow),
      totalPages: Math.ceil(filteredData.length / itemsPerPage)
    };
  }, [filteredData, currentPage, itemsPerPage]);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
  }, []);

  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  // Handle search changes
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  // Loading skeleton rows
  const renderLoadingRows = () => {
    return Array(itemsPerPage).fill(0).map((_, index) => (
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

  if (!eventId && !isEventIdLoading) {
    return (
      <div className="error-container">
        <p>Error: Form ID is missing in the URL.</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (loading && !filteredData.length) {
    return (
      <div className="loading-container">
        <FaSpinner className="spinner" />
        <p>Loading data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p>Error: {error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="table-container">
      <div className="table-header">
        <div className="top-h3">Registration Responses</div>
        <button 
          className="export-btn" 
          onClick={handleExport} 
          disabled={loading || filteredData.length === 0}
        >
          <FaDownload className="export-icon" /> Export CSV
        </button>
      </div>

      <div className="table-controls">
        <div className="search-bar">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search by name, email or phone"
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>
        <div className="filter-dropdowns">
          <select
            name="paymentStatus"
            value={filters.paymentStatus}
            onChange={handleFilterChange}
            className="filter-dropdown"
          >
            <option value="">All Payments</option>
            <option value="Success">Success</option>
            <option value="Pending">Pending</option>
            <option value="Failed">Failed</option>
          </select>
          <select
            name="approvalStatus"
            value={filters.approvalStatus}
            onChange={handleFilterChange}
            className="filter-dropdown"
          >
            <option value="">All Status</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Profile</th>
              <th>Full Name</th>
              <th className="email-column">Email</th>
              <th>Phone</th>
              <th>Age</th>
              <th>Location</th>
              <th>Payment Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && !filteredData.length ? (
              renderLoadingRows()
            ) : paginationData.currentData.length > 0 ? (
              paginationData.currentData.map((row) => (
                <tr key={row.id}>
                  <td data-label="Profile">
                    {row.imageUrl ? (
                      <img
                        src={row.imageUrl}
                        alt={row.name}
                        className="profile-image"
                      />
                    ) : (
                      <div className="profile-placeholder">N/A</div>
                    )}
                  </td>
                  <td data-label="Full Name">{row.name}</td>
                  <td data-label="Email" className="email-column">{row.email}</td>
                  <td data-label="Phone">{row.phone}</td>
                  <td data-label="Age">{row.age}</td>
                  <td data-label="Location">{row.location}</td>
                  <td data-label="Payment Status">
                    <span className="status-badge" style={{ 
                      backgroundColor: `${statusLabel[row.paymentStatus]?.color || '#6C757D'}20`,
                      border: `1px solid ${statusLabel[row.paymentStatus]?.color || '#6C757D'}`,
                      color: statusLabel[row.paymentStatus]?.color || '#6C757D'
                    }}>
                      {statusLabel[row.paymentStatus]?.icon || '?'} {row.paymentStatus}
                    </span>
                  </td>
                  <td data-label="Actions">
                    <div className="action-buttons">
                      <button className="action-btn">
                        <a href={`tel:${row.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                          <FaPhoneAlt />
                        </a>
                      </button>
                      <button className="action-btn" onClick={() => handleViewClick(row)}>
                        <FaEye />
                      </button>
                      <button className="action-btn" onClick={() => handleDownloadPDF(row)}>
                        <FaDownload />
                      </button>
                      <button 
                        className="action-btn delete-btn" 
                        onClick={() => handleDeleteClick(row.id)}
                        disabled={deletingId === row.id}
                      >
                        {deletingId === row.id ? <FaSpinner className="spinner" /> : <FaTimes />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="no-data">
                  <div className="no-data-content">
                    <FiLoader className="no-data-icon" />
                    <div>No registration data available</div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredData.length > 0 && (
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

      {isModalOpen && (
        <PopupModal data={selectedRowData} onClose={handleCloseModal} />
      )}

      {showDeleteModal && (
        <div className="delete-confirmation-modal">
          <div className="delete-modal-content">
            <h3>Confirm Deletion</h3>
            <p>Are you sure you want to delete this response? This action cannot be undone.</p>
            <div className="delete-modal-buttons">
              <button 
                className="cancel-btn"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteCandidate(null);
                }}
              >
                Cancel
              </button>
              <button 
                className="confirm-delete-btn"
                onClick={handleDeleteResponse}
                disabled={deletingId}
              >
                {deletingId ? <FaSpinner className="spinner" /> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .table-container {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          padding: 20px;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
        }
        
        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 5px;
          flex-wrap: wrap;
          gap: 16px;
        }
        
        .top-h3 {
          font-size: 1.2rem;
          color: #333;
          font-weight: 600;
          text-align: left;
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
        
        .table-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 16px;
        }
        
        .search-bar {
          position: relative;
          flex: 1;
          min-width: 250px;
        }
        
        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #6c757d;
        }
        
        .search-bar input {
          width: 100%;
          padding: 10px 15px 10px 40px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.3s;
        }
        
        .search-bar input:focus {
          outline: none;
          border-color: #0062FF;
        }
        
        .filter-dropdowns {
          display: flex;
          gap: 10px;
        }
        
        .filter-dropdown {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
          background-color: white;
          cursor: pointer;
        }
        
        .table-wrapper {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          border-radius: 8px;
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
        
        .profile-image {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          object-fit: cover;
        }
        
        .profile-placeholder {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background-color: #f0f0f0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          color: #6c757d;
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
        
        .action-buttons {
          display: flex;
          gap: 8px;
        }
        
        .action-btn {
          background: none;
          border: none;
          color: #6c757d;
          cursor: pointer;
          font-size: 16px;
          transition: color 0.3s;
          padding: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
        }
        
        .action-btn:hover {
          background-color: #f0f0f0;
        }
        
        .action-btn.delete-btn {
          color: #dc3545;
        }
        
        .action-btn.delete-btn:hover {
          background-color: #f8d7da;
        }
        
        .pagination {
          margin-top: 24px;
          // margin-bottom: 34px;
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
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .error-container, .loading-container {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 300px;
          text-align: center;
        }
        
        .error-container button, .loading-container button {
          margin-top: 20px;
          padding: 8px 16px;
          background-color: #0062FF;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .spinner {
          animation: spin 1s linear infinite;
          font-size: 48px;
          color: #0062FF;
          margin-bottom: 20px;
        }
        
        /* Delete Confirmation Modal Styles */
        .delete-confirmation-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        
        .delete-modal-content {
          background-color: white;
          padding: 25px;
          border-radius: 10px;
          width: 90%;
          max-width: 400px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        }
        
        .delete-modal-content h3 {
          margin-top: 0;
          color: #333;
          font-size: 20px;
        }
        
        .delete-modal-content p {
          margin: 15px 0 25px;
          color: #666;
          line-height: 1.5;
        }
        
        .delete-modal-buttons {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }
        
        .cancel-btn {
          padding: 8px 16px;
          background-color: #f1f1f1;
          color: #333;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .cancel-btn:hover {
          background-color: #e0e0e0;
        }
        
        .confirm-delete-btn {
          padding: 8px 16px;
          background-color: #dc3545;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .confirm-delete-btn:hover:not(:disabled) {
          background-color: #c82333;
        }
        
        .confirm-delete-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        
        /* Mobile responsiveness */
        @media (max-width: 768px) {
          .table-container {
            padding: 12px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
            margin-top: 30px;
            margin-bottom: 64px;
          }
          
          .table-header {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .export-btn {
            width: 90%;
            justify-content: center;
            // margin-bottom: 34px;
          }
          
          .table-controls {
            flex-direction: column;
            align-items: stretch;
          }
          
          .filter-dropdowns {
            width: 100%;
            justify-content: space-between;
          }
          
          .filter-dropdown {
            width: 48%;
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
          
          .action-buttons {
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

export default TableComponent;