import React, { useState, useEffect } from "react";
import "../../assets/modal.css";
import { useToken } from "../../context/TokenContext";
import * as XLSX from "xlsx";
import { FaEdit } from "react-icons/fa";
import useS3Upload from "../../hooks/useS3Upload";
import { calculateVotes } from '../AmountCalculator';

const API_CONFIG = {
  BASE_URL: "https://auth.zeenopay.com",
  ENDPOINTS: {
    PAYMENT_INTENTS: "/payments/intents",
    QR_INTENTS: "/payments/qr/intents",
    NQR_TRANSACTIONS: "/payments/qr/transactions/static"
  },
  DEFAULT_HEADERS: {
    "Content-Type": "application/json"
  }
};

const CandidateModel = ({ 
  visible, 
  onClose, 
  title, 
  candidate, 
  isEditMode, 
  onUpdate, 
  contestants = [] 
}) => {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    misc_kv: '',
    avatar: '',
    bio: '',
    status: 'O',
    shareable_link: '',
    ...candidate
  });
  const [voterDetails, setVoterDetails] = useState([]);
  const { token } = useToken();
  const [isLoadingVoters, setIsLoadingVoters] = useState(false);
  const [voterError, setVoterError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { uploadFile } = useS3Upload();

  const apiCall = async (endpoint, method = 'GET', body = null) => {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    const options = {
      method,
      headers: {
        ...API_CONFIG.DEFAULT_HEADERS,
        'Authorization': `Bearer ${token}`
      }
    };
    if (body) options.body = JSON.stringify(body);
    
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`API request failed: ${response.status}`);
    return response.json();
  };

  useEffect(() => {
    setFormData({
      id: '',
      name: '',
      misc_kv: '',
      avatar: '',
      bio: '',
      status: 'O',
      shareable_link: '',
      ...candidate
    });
    if (candidate?.id) {
      fetchAllVoterDetails(candidate.id);
    }
  }, [candidate]);

  const extractIntentIdFromNQR = (addenda1, addenda2) => {
    try {
      if (!addenda1 || !addenda2) return null;
      const combined = `${addenda1}-${addenda2}`;
      const hexMatch = combined.match(/vnpr-([a-f0-9]+)/i);
      return hexMatch?.[1] ? parseInt(hexMatch[1], 16) : null;
    } catch (error) {
      return null;
    }
  };

  const fetchNQRPayments = async (contestantId) => {
    if (!token || !contestantId) return [];
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await apiCall(
        API_CONFIG.ENDPOINTS.NQR_TRANSACTIONS,
        'POST',
        {
          'start_date': '2025-03-20',
          'end_date': today
        }
      );

      const transactions = data.transactions?.responseBody || [];
      const processedData = [];

      for (const txn of transactions) {
        if (txn.debitStatus !== '000') continue;

        const intentId = extractIntentIdFromNQR(txn.addenda1, txn.addenda2);
        
        if (intentId && String(intentId) === String(contestantId)) {
          const votes = calculateVotes(txn.amount, 'NPR');
          if (votes > 0) {
            processedData.push({
              name: txn.payerName,
              phone_no: txn.payerMobileNumber,
              processor: 'NepalPayQR',
              votes: votes,
              transactionTime: txn.localTransactionDateTime
            });
          }
        }
      }

      return processedData;
    } catch (err) {
      console.error('NQR processing error:', err);
      return [];
    }
  };

  const fetchRegularPayments = async (contestantId) => {
    try {
      const [paymentIntents, qrPaymentIntents] = await Promise.all([
        apiCall(API_CONFIG.ENDPOINTS.PAYMENT_INTENTS),
        apiCall(API_CONFIG.ENDPOINTS.QR_INTENTS)
      ]);

      const filteredQrIntents = qrPaymentIntents.filter(
        (intent) => intent.processor?.toUpperCase() === "QR"
      );

      const allPaymentIntents = [...paymentIntents, ...filteredQrIntents];
      const successfulPaymentIntents = allPaymentIntents.filter(
        (intent) => intent.status === "S"
      );

      const matchedIntents = successfulPaymentIntents.filter(
        (intent) => String(intent.intent_id) === String(contestantId) && intent.intent === "V"
      );

      const voterList = matchedIntents.map((intent) => {
        let currency = "USD";
        const processor = intent.processor?.toUpperCase();

        if (["ESEWA", "KHALTI", "FONEPAY", "PRABHUPAY", "QR"].includes(processor)) {
          currency = "NPR";
        } else if (["PHONEPE", "PAYU"].includes(processor)) {
          currency = "INR";
        } else if (processor === "STRIPE") {
          currency = intent.currency?.toUpperCase() || "USD";
        }

        const votes = calculateVotes(intent.amount, currency);

        let paymentMethod;
        if (processor === "QR") paymentMethod = "FonePayQR";
        else if (processor === "FONEPAY") paymentMethod = "iMobile Banking";
        else if (processor === "PHONEPE") paymentMethod = "India";
        else if (["PAYU", "STRIPE"].includes(processor)) paymentMethod = "International";
        else paymentMethod = processor || "N/A";

        return {
          name: intent.name,
          phone_no: intent.phone_no,
          processor: paymentMethod,
          votes: votes,
          transactionTime: intent.updated_at,
        };
      }).filter(voter => voter.votes > 0);

      return voterList;
    } catch (error) {
      console.error("Error fetching regular payments:", error);
      return [];
    }
  };

  const fetchAllVoterDetails = async (contestantId) => {
    setIsLoadingVoters(true);
    setVoterError(null);
    
    try {
      const [regularPayments, nqrPayments] = await Promise.all([
        fetchRegularPayments(contestantId),
        fetchNQRPayments(contestantId)
      ]);

      const combinedVoterList = [...regularPayments, ...nqrPayments]
        .sort((a, b) => new Date(b.transactionTime) - new Date(a.transactionTime));

      setVoterDetails(combinedVoterList);
    } catch (error) {
      setVoterError(error.message);
    } finally {
      setIsLoadingVoters(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prevData => ({ ...prevData, avatar: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let imgUrl = formData.avatar;
      if (selectedFile) {
        imgUrl = await new Promise((resolve, reject) => {
          uploadFile(
            selectedFile,
            (progress) => setUploadProgress(progress),
            (url) => resolve(url),
            (err) => reject(err)
          );
        });
      }
      
      const updatedData = {
        ...formData,
        avatar: imgUrl,
        misc_kv: formData.misc_kv.toString() // Ensure contestant number is string
      };
      
      onUpdate(updatedData);
    } catch (err) {
      console.error("Error uploading image:", err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({ ...prevData, [name]: value }));
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleModalContainerClick = (e) => e.stopPropagation();

  const totalVotes = voterDetails.reduce((sum, voter) => sum + voter.votes, 0);

  const getProcessorColor = (processor) => {
    switch (processor?.toUpperCase()) {
      case "ESEWA": return "green";
      case "PRABHUPAY": return "red";
      case "KHALTI": return "#200a69";
      case "FONEPAY": return "red";
      case "NEPALPAYQR": return "skyblue";
      case "iMobileBanking": return "blue";
      case "STRIPE": return "#5433ff";
      case "PHONEPE": return "#5F259F";
      case "PAYU": return "#FF5722";
      default: return "black";
    }
  };

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
    const ordinalSuffix = day === 1 ? "st" : day === 2 ? "nd" : day === 3 ? "rd" : "th";
    return formattedDate.replace(/\d+/, `${day}${ordinalSuffix}`);
  };

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

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-container" onClick={handleModalContainerClick}>
        <button className="modal-close-btn" onClick={onClose}>
          &times;
        </button>
        <h2 className="modal-title">{title}</h2>

        {isEditMode ? (
          <form onSubmit={handleSubmit} className="edit-form">
            <div className="form-row">
              <div className="form-group">
                <label>Contestant No. (C.No.)</label>
                <input
                  type="text"
                  name="misc_kv"
                  value={formData.misc_kv || ''}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter contestant number"
                />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  name="status"
                  value={formData.status || 'O'}
                  onChange={handleInputChange}
                >
                  <option value="O">Ongoing</option>
                  <option value="E">Eliminated</option>
                  <option value="H">Hidden</option>
                  <option value="C">Closed</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                name="name"
                value={formData.name || ''}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Shareable Link/Reels</label>
              <input
                type="url"
                name="shareable_link"
                value={formData.shareable_link || ''}
                onChange={handleInputChange}
                placeholder="https://example.com/reel"
              />
            </div>

            <div className="form-group">
              <label>Avatar</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
              />
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="upload-progress">
                  <progress value={uploadProgress} max="100" />
                  <span>{uploadProgress}%</span>
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Bio</label>
              <textarea
                name="bio"
                value={formData.bio || ''}
                onChange={handleInputChange}
                rows="4"
              />
            </div>

            <button type="submit" className="save-btn">
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
                <p><strong>Name:</strong> {candidate.name}</p>
                <p><strong>Contestant ID:</strong> {candidate.id}</p>
                <p><strong>Contestant No.:</strong> {candidate.misc_kv || 'N/A'}</p>
                <p>
                  <strong>Status:</strong>{" "}
                  <span className={`status-badge ${
                    candidate.status === "O" ? "status-ongoing" :
                    candidate.status === "E" ? "status-eliminated" :
                    candidate.status === "H" ? "status-hidden" :
                    candidate.status === "C" ? "status-closed" : ""
                  }`}>
                    {candidate.status === "O" ? "Ongoing" :
                     candidate.status === "E" ? "Eliminated" :
                     candidate.status === "H" ? "Hidden" :
                     candidate.status === "C" ? "Closed" : "Unknown"}
                  </span>
                </p>
                <p><strong>Total Votes:</strong> {totalVotes} Votes</p>
                <p><strong>Shareable Link:</strong> 
                  {candidate.shareable_link ? (
                    <a href={candidate.shareable_link} target="_blank" rel="noopener noreferrer">
                      View Reels
                    </a>
                  ) : 'Not provided'}
                </p>
                <p><strong>Bio:</strong> {candidate.bio || "Not provided"}</p>
              </div>
            </div>

            <div className="voting-info-header">
              <h3 className="modal-section-title">Voting Information</h3>
              <button onClick={exportToExcel} className="export-btn">
                Export to Excel
              </button>
            </div>

            {isLoadingVoters ? (
              <p>Loading voter details...</p>
            ) : voterError ? (
              <p className="error-message">{voterError}</p>
            ) : (
              <div className="table-wrapper">
                <div className="table-header-wrapper">
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
                  </table>
                </div>
                <div className="table-body-wrapper">
                  <table className="voters-table">
                    <tbody>
                      {voterDetails.length > 0 ? (
                        voterDetails.map((voter, index) => (
                          <tr key={index}>
                            <td>{voter.name}</td>
                            <td>
                              <span style={{
                                fontWeight: "bold",
                                color: getProcessorColor(voter.processor),
                              }}>
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
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        /* Import Poppins font from Google Fonts */
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
          padding: 16px;
          box-sizing: border-box;
        }

        /* Modal Container */
        .modal-container {
          background: #fff;
          border-radius: 8px;
          width: calc(100% - 32px);
          max-width: 600px;
          max-height: 90vh;
          padding: 20px;
          position: relative;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          animation: slideIn 0.3s ease;
          overflow-y: auto;
          font-family: 'Poppins', sans-serif;
          box-sizing: border-box;
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
          border: 1px solid #ddd;
          border-radius: 8px;
        }

        /* Table Header Wrapper */
        .table-header-wrapper {
          position: sticky;
          top: 0;
          z-index: 2;
          background-color: #028248;
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
          border: "none",
          padding: "6px 10px",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "14px",
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
          appearance: none;
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
            width: calc(100% - 32px);
            max-height: 60vh;
            padding: 16px;
          }

          .modal-title {
            font-size: 1.2rem;
          }

          .candidate-avatar,
          .candidate-avatar-edit {
            width: 100px;
            height: 100px;
          }

          .candidate-details p {
            font-size: 14px;
          }

          .voters-table th,
          .voters-table td {
            font-size: 12px;
          }

          .submit-btn,
          .export-btn {
            padding: 8px 16px;
            font-size: 12px;
          }

          
        }
      `}</style>
    </div>
  );
};

export default CandidateModel;