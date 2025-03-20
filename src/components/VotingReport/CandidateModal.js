import React, { useState, useEffect } from "react";
import "../../assets/modal.css";
import { useToken } from "../../context/TokenContext";
import * as XLSX from "xlsx";
import { FaEdit } from "react-icons/fa";
import useS3Upload from "../../hooks/useS3Upload"; // Import the hook

const CandidateModel = ({ visible, onClose, title, candidate, isEditMode, onUpdate }) => {
  const [formData, setFormData] = useState(candidate || {});
  const [voterDetails, setVoterDetails] = useState([]);
  const { token } = useToken();
  const [isLoadingVoters, setIsLoadingVoters] = useState(false);
  const [voterError, setVoterError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null); // State for the selected file
  const [uploadProgress, setUploadProgress] = useState(0); // State for upload progress

  // Call the hook at the top level
  const { uploadFile } = useS3Upload();

  useEffect(() => {
    setFormData(candidate || {});
    if (candidate && candidate.id) {
      fetchVoterDetails(candidate.id);
    }
  }, [candidate]);

  const currencyValues = {
    USD: 10,
    AUD: 5,
    GBP: 10,
    CAD: 5,
    EUR: 10,
    AED: 2,
    QAR: 2,
    MYR: 2,
    KWD: 2,
    HKD: 1,
    CNY: 1,
    SAR: 2,
    OMR: 20,
    SGD: 8,
    NOK: 1,
    KRW: 200,
    JPY: 20,
    THB: 4,
    INR: 10,
    NPR: 10,
  };

  // Handle image upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file); // Set the selected file
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prevData) => ({ ...prevData, avatar: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      let imgUrl = formData.avatar;

      // If a new file is selected, upload it to S3
      if (selectedFile) {
        imgUrl = await new Promise((resolve, reject) => {
          uploadFile(
            selectedFile,
            (progress) => setUploadProgress(progress), 
            () => {
              const url = `https://${process.env.REACT_APP_AWS_S3_BUCKET}.s3.${process.env.REACT_APP_AWS_REGION}.amazonaws.com/${selectedFile.name}`;
              resolve(url); 
            },
            (err) => reject(err) 
          );
        });
      }

      // Update the form data with the new image URL
      const updatedFormData = {
        ...formData,
        avatar: imgUrl,
      };

      // Call the onUpdate function with the updated form data
      onUpdate(updatedFormData);
    } catch (err) {
      console.error("Error uploading image:", err);
    }
  };

  // Fetch voter details and calculate votes
  const fetchVoterDetails = async (miscKv) => {
    setIsLoadingVoters(true);
    setVoterError(null);
  
    try {
      // Fetch regular payment intents
      const paymentsResponse = await fetch(
        `https://auth.zeenopay.com/payments/intents/`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
  
      if (!paymentsResponse.ok) {
        throw new Error("Failed to fetch payment intents data.");
      }
  
      const paymentIntents = await paymentsResponse.json();
  
      // Fetch QR/NQR payment intents
      const qrPaymentsResponse = await fetch(
        `https://auth.zeenopay.com/payments/qr/intents`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
  
      if (!qrPaymentsResponse.ok) {
        throw new Error("Failed to fetch QR/NQR payment intents data.");
      }
  
      const qrPaymentIntents = await qrPaymentsResponse.json();
  
      // Combine regular and QR/NQR payment intents
      const allPaymentIntents = [...paymentIntents, ...qrPaymentIntents];
  
      // Filter payment intents to include only successful transactions (status === 'S')
      const successfulPaymentIntents = allPaymentIntents.filter(
        (intent) => intent.status === "S"
      );
  
      // Fetch events data
      const eventsResponse = await fetch(
        `https://auth.zeenopay.com/events/`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
  
      if (!eventsResponse.ok) {
        throw new Error("Failed to fetch events data.");
      }
  
      const events = await eventsResponse.json();
  
      // Match intents with the candidate's misc_kv and intent type "V"
      const matchedIntents = successfulPaymentIntents.filter(
        (intent) => String(intent.intent_id) === String(miscKv) && intent.intent === "V"
      );
  
      // Calculate votes and prepare voter list
      const voterList = matchedIntents.map((intent) => {
        const event = events.find((event) => event.id === intent.event_id);
        let votes = 0;
  
        // Determine the currency based on the processor
        if (
          ["ESEWA", "KHALTI", "FONEPAY", "PRABHUPAY", "NQR", "QR"].includes(
            intent.processor
          )
        ) {
          // NPR currency
          votes = intent.amount / currencyValues.NPR;
        } else if (["PHONEPE", "PAYU"].includes(intent.processor)) {
          // INR currency
          votes = intent.amount / currencyValues.INR;
        } else if (intent.processor === "STRIPE") {
          // Use the currency specified in the intent
          const currency = intent.currency.toUpperCase();
          if (currencyValues[currency]) {
            votes = intent.amount / currencyValues[currency];
          }
        } else {
          // Default to payment_info if no specific logic
          votes = event ? Number(intent.amount) / event.payment_info : 0;
        }
  
        votes = Math.floor(votes);
  
        // Determine payment method
        let paymentMethod;
        if (intent.processor === "NQR") {
          paymentMethod = "NepalPayQR";
        } else if (intent.processor === "QR") {
          paymentMethod = "iMobileBanking";
        } else if (intent.processor === "PHONEPE") { 
          paymentMethod = "India";
        } else if (["PAYU", "STRIPE"].includes(intent.processor)) {
          paymentMethod = "International";
        } else {
          paymentMethod = intent.processor || "N/A";
        }
  
        return {
          name: intent.name,
          phone_no: intent.phone_no,
          processor: paymentMethod,
          votes: votes,
          transactionTime: intent.updated_at,
        };
      });
  
      // Sort voter list by transaction time (newest first)
      voterList.sort((a, b) => new Date(b.transactionTime) - new Date(a.transactionTime));
  
      setVoterDetails(voterList);
    } catch (error) {
      setVoterError(error.message);
    } finally {
      setIsLoadingVoters(false);
    }
  };

  const totalVotes = voterDetails.reduce((sum, voter) => sum + voter.votes, 0);

  // Function to get processor color
  const getProcessorColor = (processor) => {
    switch (processor.toUpperCase()) {
      case "ESEWA":
        return "green";
      case "PRABHUPAY":
        return "red";
      case "KHALTI":
        return "#200a69";
      case "FONEPAY":
        return "red";
      case "NEPALPAYQR":
        return "skyblue";
      case "iMobileBanking":
        return "blue";
      case "STRIPE":
        return "#5433ff";
      case "PHONEPE":
        return "#5F259F";
      case "PAYU":
        return "#FF5722";
      default:
        return "black";
    }
  };

  // Function to format transaction time
  const formatTransactionTime = (dateString) => {
    const date = new Date(dateString);
    const options = {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    };
    const formattedDate = new Intl.DateTimeFormat("en-US", options).format(date);
    const day = date.getDate();
    const ordinalSuffix =
      day === 1 ? "st" : day === 2 ? "nd" : day === 3 ? "rd" : "th";
    return formattedDate.replace(/\d+/, `${day}${ordinalSuffix}`);
  };

  // Function to export voting details to Excel
  const exportToExcel = () => {
    const dataForExport = voterDetails.map((voter) => ({
      "Full Name": voter.name,
      "Payment Method": voter.processor,
      Votes: voter.votes,
      "Phone No": voter.phone_no,
      "Transaction Time": formatTransactionTime(voter.transactionTime),
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Voting Details");
    XLSX.writeFile(workbook, "voting_details.xlsx");
  };

  if (!visible) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({ ...prevData, [name]: value }));
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleModalContainerClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-container" onClick={handleModalContainerClick}>
        <button className="modal-close-btn" onClick={onClose}>
          &times;
        </button>
        <h2 className="modal-title">{title}</h2>

        {isEditMode ? (
          <form onSubmit={handleSubmit} className="edit-form">
            <div className="form-group">
              <label>Contestant Number</label>
              <input
                type="text"
                name="misc_kv"
                value={formData.misc_kv || ""}
                onChange={handleInputChange}
                placeholder="Enter contestant number"
                required
              />
            </div>

            <div className="form-group">
              <label>Contestant Name</label>
              <input
                type="text"
                name="name"
                value={formData.name || ""}
                onChange={handleInputChange}
                placeholder="Enter name"
                required
              />
            </div>

            <div className="form-group">
              <label>Status</label>
              <div className="custom-dropdown">
                <select
                  name="status"
                  value={formData.status || ""}
                  onChange={handleInputChange}
                  required
                >
                  <option value="O">Ongoing</option>
                  <option value="E">Eliminated</option>
                  <option value="H">Hidden</option>
                </select>
                <span className="dropdown-arrow">&#9660;</span>
              </div>
            </div>

            <div className="form-group">
              <label>Bio:</label>
              <textarea
                name="bio"
                value={formData.bio || ""}
                onChange={handleInputChange}
                placeholder="Enter bio"
              />
            </div>

            <div className="form-group">
              <label>Add New reels/shorts</label>
              <input
                type="text"
                name="shareable_link"
                value={formData.shareable_link || ""}
                onChange={handleInputChange}
                placeholder="Enter reels/shorts"
              />
            </div>

            <div className="form-group">
              <label>Edit Contestant Avatar</label>
              <div className="candidate-avatar-edit">
                <img
                  src={formData.avatar}
                  alt={`${formData.name}'s avatar`}
                  className="candidate-photo"
                />
                <div className="edit-avatar-overlay">
                  <label htmlFor="avatar-upload" className="edit-avatar-icon">
                    <FaEdit />
                  </label>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleImageUpload}
                  />
                </div>
              </div>
              {uploadProgress > 0 && <p>Upload Progress: {uploadProgress}%</p>}
            </div>

            <button type="submit" className="submit-btn">
              Save Changes
            </button>
          </form>
        ) : (
          <div className="modal-content">
            <div className="candidate-info">
              <div className="candidate-avatar">
                <img
                  src={candidate.avatar}
                  alt={`${candidate.name}'s avatar`}
                  className="candidate-photo"
                />
              </div>
              <div className="candidate-details">
                <p>
                  <strong>Name:</strong> {candidate.name}
                </p>
                <p>
                  <strong>Contestant ID:</strong> {candidate.id}
                </p>
                <p>
                  <strong>Status:</strong>{" "}
                  <span
                    className={`status-badge 
                      ${candidate.status === "O" ? "status-ongoing" :
                      candidate.status === "E" ? "status-eliminated" :
                      candidate.status === "H" ? "status-hidden" :
                      candidate.status === "C" ? "status-closed" : ""}`}
                  >
                    {candidate.status === "O"
                      ? "Ongoing"
                      : candidate.status === "E"
                      ? "Eliminated"
                      : candidate.status === "H"
                      ? "Hidden"
                      : candidate.status === "C"
                      ? "Closed"
                      : "Unknown"}
                  </span>
                </p>
                <p>
                  <strong>Total Votes:</strong> {totalVotes} Votes
                </p>
                <p>
                  <strong>Bio:</strong> {candidate.bio || "Not provided"}
                </p>
              </div>
            </div>

            {/* Voting Information Section */}
            <div className="voting-info-header">
              <h3 className="modal-section-title">Voting Information</h3>
              <button
                onClick={exportToExcel}
                className="export-btn"
                style={{
                  background: "#028248",
                  color: "#fff",
                  border: "none",
                  padding: "6px 10px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                Export to Excel
              </button>
            </div>

            {isLoadingVoters ? (
              <p>Loading voter details...</p>
            ) : voterError ? (
              <p className="error-message">{voterError}</p>
            ) : (
              <div className="table-wrapper" style={{ maxHeight: "200px", overflowY: "auto" }}>
                <table className="voters-table">
                  <thead>
                    <tr>
                      <th>Full Name</th>
                      <th>Payment Method</th>
                      <th>Votes</th>
                      <th>Phone No</th>
                      <th>Transaction Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voterDetails.length > 0 ? (
                      voterDetails.map((voter, index) => (
                        <tr key={index}>
                          <td>{voter.name}</td>
                          <td>
                            <span
                              style={{
                                fontWeight: "bold",
                                color: getProcessorColor(voter.processor),
                              }}
                            >
                              {voter.processor}
                            </span>
                          </td>
                          <td>{voter.votes}</td>
                          <td>{voter.phone_no}</td>
                          <td>{formatTransactionTime(voter.transactionTime)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" style={{ textAlign: "center" }}>
                          No voters available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`/* Import Poppins font from Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap');

/* Modal Overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease;
  font-family: 'Poppins', sans-serif;
  padding: 16px; /* Add padding to leave gaps on all sides */
  box-sizing: border-box; /* Ensure padding is included in width/height */
}

/* Modal Container */
.modal-container {
  background: #fff;
  border-radius: 8px;
  width: calc(100% - 32px); /* Ensure gaps on both sides */
  max-width: 600px; /* Maximum width for larger screens */
  max-height: 90vh; /* Maximum height to ensure it fits on the screen */
  padding: 20px;
  position: relative;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  animation: slideIn 0.3s ease;
  overflow-y: auto; /* Enable scrolling if content exceeds the height */
  font-family: 'Poppins', sans-serif;
  box-sizing: border-box; /* Ensure padding is included in width/height */
}

/* Close Button */
.modal-close-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #333;
  cursor: pointer;
  transition: color 0.2s ease;
}

.modal-close-btn:hover {
  color: #e74c3c;
}

/* Modal Title */
.modal-title {
  margin-top: 0;
  font-size: 1.5rem;
  color: #333;
  text-align: center;
}

/* Candidate Avatar Styling */
.candidate-avatar {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 15px;
  overflow: hidden;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  border: 3px solid #fff;
  margin: 0 auto 20px;
}

.candidate-avatar-edit {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 15px;
  overflow: hidden;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  border: 3px solid #fff;
  margin: 0 0 20px;
}

.candidate-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s ease;
}

.candidate-avatar:hover .candidate-photo {
  transform: scale(1.1);
}

.edit-avatar-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.candidate-avatar:hover .edit-avatar-overlay {
  opacity: 1;
}

.edit-avatar-icon {
  color: #fff;
  font-size: 24px;
  cursor: pointer;
}

/* Candidate Details */
.candidate-details {
  text-align: center;
}

.candidate-details p {
  margin: 10px 0;
}

/* Voting Information Header */
.voting-info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Table Wrapper */
.table-wrapper {
  max-height: 200px; 
  overflow-y: auto;
  border: 1px solid #ddd;
  border-radius: 8px;
}

/* Thin Scrollbar Styling */
.table-wrapper::-webkit-scrollbar {
  width: 4px; 
  height: 4px; 
}

.table-wrapper::-webkit-scrollbar-track {
  background: #f1f1f1; 
  border-radius: 3px;
}

.table-wrapper::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px; 
}

.table-wrapper::-webkit-scrollbar-thumb:hover {
  background: #555; 
}

/* Voters Table */
.voters-table {
  width: 100%;
  border-collapse: collapse;
  font-family: 'Poppins', sans-serif;
}

.voters-table thead {
  position: sticky;
  top: 0;
  background-color: #028248;
  color: #fff;
  z-index: 1;
}

.voters-table th,
.voters-table td {
  padding: 8px;
  border: 1px solid #ddd;
  text-align: left;
  font-size: 14px;
}

.voters-table th {
  background-color: #028248;
  color: #fff;
  font-weight: bold;
}

.voters-table td {
  background-color: #fafafa;
}

/* Decrease width of Payment Method column */
.voters-table th:nth-child(2),
.voters-table td:nth-child(2) {
  width: 140px;
}

.voters-table th:nth-child(3),
.voters-table td:nth-child(3) {
  width: 100px;
}

.voters-table th:nth-child(1),
.voters-table td:nth-child(1) {
  width: 140px;
}

/* Submit Button */
.submit-btn {
  background: #028248;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: background 0.3s ease;
  margin-top: 10px;
}

.submit-btn:hover {
  background: rgb(59, 177, 124);
}

/* Export Button */
.export-btn {
  background: #028248;
  color: #fff;
  border: none;
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.export-btn:hover {
  background: #016138;
}

/* Status Badges */
.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.status-ongoing {
  background-color: #28a745;
  color: #fff;
}

.status-eliminated {
  background-color: #dc3545;
  color: #fff;
}

.status-hidden {
  background-color: #6c757d;
  color: #fff;
}

.status-closed {
  background-color: #ffc107;
  color: #000;
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideIn {
  from {
    transform: translateY(-20px);
  }
  to {
    transform: translateY(0);
  }
}

/* Custom Dropdown Styling */
.custom-dropdown {
  position: relative;
  width: 100%;
  border: 1px solid #ccc;
  border-radius: 8px;
  background-color: #fff;
  overflow: hidden;
  transition: border-color 0.3s ease;
}

.custom-dropdown:hover {
  border-color: #5433ff;
}

.custom-dropdown select {
  width: 100%;
  padding: 10px 12px;
  font-size: 14px;
  border: none;
  outline: none;
  background-color: transparent;
  appearance: none; /* Remove default arrow */
  cursor: pointer;
}

.custom-dropdown .dropdown-arrow {
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  pointer-events: none;
  color: #5433ff;
  font-size: 12px;
}

/* Styling for options */
.custom-dropdown select option {
  padding: 10px;
  background-color: #fff;
  color: #333;
}

.custom-dropdown select option:hover {
  background-color: #f0f0f0;
}

/* Media Queries for Mobile Responsiveness */
@media (max-width: 768px) {
  .modal-container {
    width: calc(100% - 32px); /* Ensure gaps on both sides for mobile */
    max-height: 60vh; /* Adjust max-height for smaller screens */
    padding: 16px; /* Add padding for better spacing */
  }

  .modal-title {
    font-size: 1.2rem; /* Adjust font size for smaller screens */
  }

  .candidate-avatar,
  .candidate-avatar-edit {
    width: 100px; /* Adjust avatar size for smaller screens */
    height: 100px;
  }

  .candidate-details p {
    font-size: 14px; /* Adjust font size for smaller screens */
  }

  .voters-table th,
  .voters-table td {
    font-size: 12px; /* Adjust font size for smaller screens */
  }

  .submit-btn,
  .export-btn {
    padding: 8px 16px; /* Adjust button padding for smaller screens */
    font-size: 12px; /* Adjust button font size for smaller screens */
  }
}`}</style>
    </div>
  );
};

export default CandidateModel;