import React, { useState, useEffect } from "react";
import { useToken } from "../../context/TokenContext";
import * as XLSX from "xlsx";
import { FaDownload } from "react-icons/fa";
import useS3Upload from "../../hooks/useS3Upload";
import { calculateVotes } from '../AmountCalculator';

const CandidateModel = ({ 
  visible, 
  onClose, 
  title, 
  candidate, 
  isEditMode, 
  onUpdate 
}) => {
  // State management
  const [formData, setFormData] = useState(candidate || {});
  const [voterDetails, setVoterDetails] = useState([]);
  const { token } = useToken();
  const [isLoadingVoters, setIsLoadingVoters] = useState(false);
  const [voterError, setVoterError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [nqrTransactions, setNqrTransactions] = useState([]);

  // Payment processor constants
  const nepalProcessors = ["ESEWA", "KHALTI", "FONEPAY", "PRABHUPAY", "NQR", "QR"];
  const indiaProcessors = ["PHONEPE"];
  const internationalProcessors = ["PAYU", "STRIPE"];

  const { uploadFile } = useS3Upload();

  // Initialize form data and fetch voter details when candidate changes
  useEffect(() => {
    setFormData(candidate || {});
    if (candidate && candidate.id) {
      fetchVoterDetails(candidate.id);
    }
  }, [candidate]);

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

  // Fetch NQR transactions from API
  const fetchNQRTransactions = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const response = await fetch(
        'https://auth.zeenopay.com/payments/qr/transactions/static', 
        {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            'start_date': "2025-03-21",
            'end_date': today
          })
        }
      );

      if (!response.ok) throw new Error('Failed to fetch NQR data');
      
      const result = await response.json();
      return result.transactions?.responseBody?.filter(
        txn => txn.debitStatus === '000'
      ) || [];
    } catch (error) {
      console.error('Error fetching NQR transactions:', error);
      return [];
    }
  };

  // Handle image upload for candidate avatar
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, avatar: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Form submission handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let imgUrl = formData.avatar;

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

      onUpdate({ ...formData, avatar: imgUrl });
    } catch (err) {
      console.error("Error uploading image:", err);
    }
  };

  // Fetch and process voter details
  const fetchVoterDetails = async (contestantId) => {
    setIsLoadingVoters(true);
    setVoterError(null);

    try {
      // Fetch all payment sources in parallel
      const [nqrTxns, regularIntents, qrIntents] = await Promise.all([
        fetchNQRTransactions(),
        fetchRegularPaymentIntents(),
        fetchQRPaymentIntents()
      ]);

      setNqrTransactions(nqrTxns);

      // Process all payment intents
      const allIntents = [
        ...regularIntents,
        ...qrIntents.filter(intent => intent.processor?.toUpperCase() === "QR"),
        ...nqrTxns.map(txn => ({
          intent_id: getIntentIdFromNQR(txn.addenda1, txn.addenda2),
          amount: txn.amount,
          currency: 'NPR',
          processor: 'NQR',
          status: 'S',
          name: txn.payerName,
          phone_no: txn.payerMobileNumber,
          updated_at: txn.localTransactionDateTime,
          intent: 'V'
        }))
      ];

      // Filter successful transactions for this contestant
      const matchedIntents = allIntents.filter(
        intent => intent.status === 'S' && 
                 String(intent.intent_id) === String(contestantId) && 
                 intent.intent === 'V'
      );

      // Transform into voter details
      const voters = matchedIntents.map(intent => ({
        name: intent.name || "Anonymous",
        phone_no: intent.phone_no || "N/A",
        processor: getPaymentMethod(intent.processor),
        votes: calculateVotes(intent.amount, getCurrency(intent.processor)),
        transactionTime: intent.updated_at
      }));

      // Sort by most recent
      voters.sort((a, b) => new Date(b.transactionTime) - new Date(a.transactionTime));
      setVoterDetails(voters);
    } catch (error) {
      setVoterError(error.message);
    } finally {
      setIsLoadingVoters(false);
    }
  };

  // Helper function to get payment method display name
  const getPaymentMethod = (processor) => {
    const proc = processor?.toUpperCase();
    switch (proc) {
      case "NQR": return "NepalPayQR";
      case "QR": return "FonePayQR";
      case "FONEPAY": return "iMobile Banking";
      case "PHONEPE": return "India";
      case "PAYU": 
      case "STRIPE": return "International";
      default: return processor || "N/A";
    }
  };

  // Helper function to determine currency
  const getCurrency = (processor) => {
    const proc = processor?.toUpperCase();
    if (["ESEWA", "KHALTI", "FONEPAY", "PRABHUPAY", "QR", "NQR"].includes(proc)) {
      return "NPR";
    } else if (["PHONEPE", "PAYU"].includes(proc)) {
      return "INR";
    } else if (proc === "STRIPE") {
      return "USD"; // Actual currency will come from intent.currency
    }
    return "USD";
  };

  // Helper function to get color for payment method
  const getProcessorColor = (processor) => {
    switch (processor.toUpperCase()) {
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

  // Format transaction time for display
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
    const formatted = new Intl.DateTimeFormat("en-US", options).format(date);
    const day = date.getDate();
    const suffix = 
      day % 10 === 1 && day !== 11 ? 'st' :
      day % 10 === 2 && day !== 12 ? 'nd' :
      day % 10 === 3 && day !== 13 ? 'rd' : 'th';
    return formatted.replace(/\d+/, `${day}${suffix}`);
  };

  // Export voter details to Excel
  const exportToExcel = () => {
    const data = voterDetails.map(voter => ({
      "Full Name": voter.name,
      "Payment Method": voter.processor,
      "Votes": voter.votes,
      "Phone No": voter.phone_no,
      "Transaction Time": formatTransactionTime(voter.transactionTime)
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Voting Details");
    XLSX.writeFile(workbook, "voting_details.xlsx");
  };

  // Fetch regular payment intents
  const fetchRegularPaymentIntents = async () => {
    const response = await fetch(
      `https://auth.zeenopay.com/payments/intents/`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) throw new Error("Failed to fetch payment intents");
    return await response.json();
  };

  // Fetch QR payment intents (excluding NQR)
  const fetchQRPaymentIntents = async () => {
    const response = await fetch(
      `https://auth.zeenopay.com/payments/qr/intents`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) throw new Error("Failed to fetch QR payment intents");
    return await response.json();
  };

  // Calculate total votes
  const totalVotes = voterDetails.reduce((sum, voter) => sum + voter.votes, 0);

  if (!visible) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
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
            {/* Edit form fields would go here */}
          </form>
        ) : (
          <div className="modal-content">
            {/* Candidate Information Section */}
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
                <p><strong>Total Votes:</strong> {totalVotes.toLocaleString()} Votes</p>
                <p><strong>Bio:</strong> {candidate.bio || "Not provided"}</p>
              </div>
            </div>

            {/* Voting Information Section */}
            <div className="voting-info-header">
              <h3 className="modal-section-title">Voting Information</h3>
              <button onClick={exportToExcel} className="export-btn">
                <FaDownload /> Export to Excel
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
                                color: getProcessorColor(voter.processor)
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