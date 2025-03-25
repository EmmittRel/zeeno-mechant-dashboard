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

  // Transform API data
  const transformApiData = (apiResponseArray) => {
    return apiResponseArray.map((apiResponse) => {
      try {
        if (!apiResponse.response) {
          console.error("Missing response in API response:", apiResponse);
          return {};
        }

        const response = apiResponse.response;

        return {
          name: response.name || "N/A",
          email: response.email || "N/A",
          phone: response.contactNumber || "N/A",
          paymentStatus: apiResponse.payment ? "Paid" : "Pending",
          status: "Pending", // Default status since it's not in the response
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
          permanentAddress: response.permanentAddress || "N/A"
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
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((row, index) => (
                  <tr key={index}>
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
                    <td>{row.category}</td>
                    <td
                      className={
                        row.status === "Approved"
                          ? "approved"
                          : row.status === "Rejected"
                          ? "rejected"
                          : "pending"
                      }
                    >
                      {row.status}
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
                      <button className="action-btn">
                        <FaTimes />
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

      {/* Styles */}
      <style>{`
        .table-container {
          font-family: 'Poppins', sans-serif;
        }

        .header-title {
          text-align: left;
          font-size: 18px;
          margin-bottom: 20px;
          color: #333;
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
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .no-data {
          text-align: center;
          padding: 20px;
          background-color: #f1f1f1;
        }

        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          margin-top: 20px;
        }

        .pagination button {
          margin: 0 10px;
          padding: 5px 10px;
          cursor: pointer;
        }

        .pagination button:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }

        .modal-content {
          background-color: #fff;
          padding: 20px;
          border-radius: 8px;
          width: 400px;
          max-width: 90%;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          position: relative;
        }

        .modal-close-btn {
          position: absolute;
          top: 10px;
          right: 10px;
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
        }

        .modal-details {
          margin-top: 20px;
        }

        .modal-details p {
          margin: 10px 0;
        }

        /* Mobile-specific styles */
        @media (max-width: 768px) {

         .table-container {
          padding: 20px;
        }

          .table-header {
            flex-direction: column; 
            gap: 10px; 
          }

          .filter-dropdowns {
            display: flex;
            flex-direction: row;
            gap: 10px;
          }

          .filter-dropdown {
            width: 155px;
          }

          .search-bar {
            width: 100%; 
            margin-top: 10px;
          }

          .search-bar input {
            width: 100%; 
          }

          /* Hide email column in responsive mode */
          .email-column {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};

export default TableComponent;