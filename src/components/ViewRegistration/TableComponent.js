import React, { useState, useEffect } from "react";
import { useToken } from '../../context/TokenContext';
import {
  FaSearch,
  FaDownload,
  FaPhoneAlt,
  FaEye,
  FaTimes,
  FaSpinner,
} from "react-icons/fa";
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

  // Extract eventId from URL
  useEffect(() => {
    const pathSegments = window.location.pathname.split("/");
    const id = pathSegments[pathSegments.length - 1];
    setFormId(id);
    setIsEventIdLoading(false);
  }, []);

  // Fetch both regular and QR payment intents
  const fetchPaymentIntents = async () => {
    try {
      // Regular payment intents
      const regularResponse = await fetch(
        `https://auth.zeenopay.com/payments/intents/?event_id=${eventId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      // QR payment intents
      const qrResponse = await fetch(
        `https://auth.zeenopay.com/payments/qr/intents?event_id=${eventId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!regularResponse.ok || !qrResponse.ok) {
        throw new Error(`Payment intents network error`);
      }

      const regularData = await regularResponse.json();
      const qrData = await qrResponse.json();

      // Combine both payment intents
      setPaymentIntents([...regularData, ...qrData]);
    } catch (error) {
      console.error("Error fetching payment intents:", error);
    }
  };

  // Transform API data with payment status check
  const transformApiData = (apiResponseArray) => {
    return apiResponseArray.map((apiResponse) => {
      try {
        if (!apiResponse.response) {
          console.error("Missing response in API response:", apiResponse);
          return {};
        }

        const response = apiResponse.response;
        
        // Check if action_id exists in payment intents
        const matchingPayment = paymentIntents.find(
          intent => intent.action_id === apiResponse.action_id
        );

        // Determine payment status
        let paymentStatus = "Pending";
        if (matchingPayment) {
          // Check for QR payments (ESEWA, KHALTI, FONEPAY, PHONEPE)
          if (matchingPayment.processor && ['ESEWA', 'KHALTI', 'FONEPAY', 'PHONEPE'].includes(matchingPayment.processor)) {
            // Handle QR payment statuses
            switch(matchingPayment.status) {
              case 'S':
                paymentStatus = "Paid";
                break;
              case 'P':
                paymentStatus = "Pending";
                break;
              case 'F':
                paymentStatus = "Failed";
                break;
              default:
                paymentStatus = "Pending";
            }
          } 
          // Check for regular payments
          else {
            // Handle regular payment statuses
            switch(matchingPayment.status) {
              case 'success':
                paymentStatus = "Paid";
                break;
              case 'pending':
                paymentStatus = "Pending";
                break;
              case 'failed':
                paymentStatus = "Failed";
                break;
              default:
                paymentStatus = "Pending";
            }
          }
        }

        return {
          id: apiResponse.id, // Using the response ID from the endpoint
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
          action_id: apiResponse.action_id // Keeping for reference but not used for operations
        };
      } catch (error) {
        console.error("Error parsing response:", error);
        return {};
      }
    });
  };

  // Fetch data when eventId is available
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        if (!eventId) {
          throw new Error("Form ID is required");
        }

        // First fetch payment intents
        await fetchPaymentIntents();

        // Then fetch form responses
        const response = await fetch(
          `https://auth.zeenopay.com/events/form/responses/${eventId}/`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Network error: ${response.statusText}`);
        }

        const apiData = await response.json();

        // Ensure eventId is a number before comparison
        const eventIdNumber = Number(eventId);

        // Filter data based on matching form ID
        const filteredApiData = apiData.filter(item => Number(item.form) === eventIdNumber);

        const transformedData = transformApiData(Array.isArray(filteredApiData) ? filteredApiData : []);

        setData(transformedData);
        setFilteredData(transformedData);
        setError(null);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError(error.message);
        setData([]);
        setFilteredData([]);
      } finally {
        setLoading(false);
      }
    };

    if (eventId && !isEventIdLoading) {
      fetchData();
    }
  }, [eventId, token, isEventIdLoading]);

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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || 
          `Failed to delete response: ${response.statusText}`
        );
      }

      // Update both data and filteredData states
      setData(prevData => prevData.filter(item => item.id !== deleteCandidate));
      setFilteredData(prevData => prevData.filter(item => item.id !== deleteCandidate));
      
      // Refresh payment intents as they might be related to the deleted response
      await fetchPaymentIntents();
      
      // Show success feedback
      alert("Response deleted successfully!");
    } catch (error) {
      console.error("Error deleting response:", error);
      alert(`Error deleting response: ${error.message}`);
    } finally {
      setDeletingId(null);
      setDeleteCandidate(null);
    }
  };

  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));

    // Apply filters
    let result = [...data];

    if (value) {
      result = result.filter((row) => {
        if (name === "paymentStatus") {
          return row.paymentStatus === value;
        }
        if (name === "approvalStatus") {
          return row.status === value;
        }
        return true;
      });
    }

    setFilteredData(result);
    setCurrentPage(1); 
  };

  // Handle search changes
  const handleSearchChange = (e) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);

    const filtered = data.filter(
      (row) =>
        row.name.toLowerCase().includes(query) ||
        row.email.toLowerCase().includes(query) ||
        row.phone.toLowerCase().includes(query)
    );

    setFilteredData(filtered);
    setCurrentPage(1); 
  };

  const handleExport = () => {
    const csvContent = [
      [
        "Name",
        "Email",
        "Phone",
        "Age",
        "Location",
        "Guardian Name",
        "Reason",
        "Date of Birth",
        "Gender",
        "Weight",
        "Height",
        "Optional Number",
        "Source",
        "Payment Status",
        "Status",
      ],
      ...filteredData.map((row) => [
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
        row.paymentStatus,
        row.status,
      ]),
    ]
      .map((e) => e.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "data_export.csv");
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Handle opening the modal
  const handleViewClick = (row) => {
    setSelectedRowData(row);
    setIsModalOpen(true);
  };

  // Handle closing the modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRowData(null);
  };

  // Function to handle downloading the modal content as a PDF
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

    // Generate and download the PDF
    html2pdf().from(element).set(opt).save();
  };

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Handle missing eventId
  if (!eventId && !isEventIdLoading) {
    return (
      <div className="error-container">
        <p>Error: Form ID is missing in the URL.</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (loading) {
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
      {/* Header with Title */}
      <h3 className="header-title">Registration Responses</h3>

      {/* Header with Search, Export, and Filter */}
      <div className="table-header">
        <div className="search-bar">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search by name, email or phone"
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>
        <div className="actions">
          <button className="export-btn" onClick={handleExport}>
            <FaDownload className="export-icon" /> Export
          </button>
          <div className="filter">
            <span className="filter-text">Filtration</span>
            <div className="filter-dropdowns">
              <select
                name="paymentStatus"
                value={filters.paymentStatus}
                onChange={handleFilterChange}
                className="filter-dropdown"
              >
                <option value="">All Payments</option>
                <option value="Paid">Paid</option>
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
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        {filteredData.length === 0 ? (
          <div className="no-data">
            <p>No data available</p>
          </div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Profile</th>
                  <th>Full Name</th>
                  <th className="email-column">Email Address</th>
                  <th>Phone Number</th>
                  <th>Age</th>
                  <th>Location</th>
                  <th>Guardian Name</th>
                  <th>Payment Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.imageUrl ? (
                        <img
                          src={row.imageUrl}
                          alt={row.name}
                          style={{
                            width: "50px",
                            height: "50px",
                            borderRadius: "50%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "50px",
                            height: "50px",
                            borderRadius: "50%",
                            backgroundColor: "#ddd",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          N/A
                        </div>
                      )}
                    </td>
                    <td>{row.name}</td>
                    <td className="email-column">{row.email}</td>
                    <td>{row.phone}</td>
                    <td>{row.age}</td>
                    <td>{row.location}</td>
                    <td>{row.parentName}</td>
                    <td className={
                      row.paymentStatus === "Paid" ? "paid" : 
                      row.paymentStatus === "Failed" ? "failed" : 
                      "pending"
                    }>
                      {row.paymentStatus}
                    </td>
                    <td>
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div className="pagination">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>

      {/* Render the PopupModal */}
      {isModalOpen && (
        <PopupModal data={selectedRowData} onClose={handleCloseModal} />
      )}

      {/* Delete Confirmation Modal */}
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

      {/* Styles */}
      <style>{`
        .table-container {
          font-family: 'Poppins', sans-serif;
          padding: 20px;
        }

        .header-title {
          text-align: left;
          font-size: 18px;
          margin-bottom: 20px;
          color: #333;
          font-weight: 600;
        }

        .loading-container, .error-container {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 300px;
          text-align: center;
        }

        .spinner {
          animation: spin 1s linear infinite;
          font-size: 48px;
          color: #0062FF;
          margin-bottom: 20px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .error-container button {
          margin-top: 20px;
          padding: 8px 16px;
          background-color: #0062FF;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .no-data {
          text-align: center;
          padding: 40px;
          background-color: #f8f9fa;
          border-radius: 8px;
          margin-top: 20px;
          color: #6c757d;
        }

        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 15px;
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

        .actions {
          display: flex;
          align-items: center;
          gap: 15px;
          flex-wrap: wrap;
        }

        .export-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 15px;
          background-color: #28a745;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.3s;
        }

        .export-btn:hover {
          background-color: #218838;
        }

        .filter {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .filter-text {
          font-size: 14px;
          color: #495057;
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
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
          padding: 12px 15px;
          text-align: left;
          border-bottom: 1px solid #eee;
        }

        th {
          background-color: #f8f9fa;
          font-weight: 600;
          color: #495057;
          white-space: nowrap;
        }

        tr:hover {
          background-color: #f8f9fa;
        }

        .action-btn {
          background: none;
          border: none;
          color: #6c757d;
          cursor: pointer;
          font-size: 16px;
          margin: 0 5px;
          transition: color 0.3s;
        }

        .action-btn:hover {
          color: #0062FF;
        }

        .action-btn.delete-btn {
          color: #dc3545;
        }

        .action-btn.delete-btn:hover {
          color: #a71d2a;
        }

        /* Status styles */
        .paid {
          color: #28a745;
          font-weight: bold;
        }
        
        .pending {
          color: #ffc107;
          font-weight: bold;
        }
        
        .failed {
          color: #dc3545;
          font-weight: bold;
        }

        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          margin-top: 20px;
          padding: 20px 0;
          gap: 15px;
        }

        .pagination button {
          padding: 8px 16px;
          background-color: #f8f9fa;
          border: 1px solid #ddd;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.3s;
        }

        .pagination button:hover:not(:disabled) {
          background-color: #0062FF;
          color: white;
          border-color: #0062FF;
        }

        .pagination button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .pagination span {
          font-size: 14px;
          color: #495057;
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

        /* Mobile-specific styles */
        @media (max-width: 768px) {
          .table-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .search-bar {
            width: 100%;
          }

          .actions {
            width: 100%;
            justify-content: space-between;
          }

          .filter {
            width: 100%;
            justify-content: space-between;
          }

          .filter-dropdowns {
            width: 100%;
            justify-content: flex-end;
          }

          /* Hide email column in responsive mode */
          .email-column {
            display: none;
          }

          th, td {
            padding: 8px 10px;
            font-size: 14px;
          }

          .delete-modal-content {
            width: 95%;
            padding: 15px;
          }

          .delete-modal-buttons {
            flex-direction: column;
          }

          .cancel-btn, .confirm-delete-btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default TableComponent;