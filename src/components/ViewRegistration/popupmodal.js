import React, { useRef, useEffect } from "react";
import html2pdf from "html2pdf.js";
import { FaTimes, FaDownload, FaPrint } from "react-icons/fa";

const PopupModal = ({ data, onClose }) => {
  const modalRef = useRef();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  if (!data) return null;

  const handleDownloadPDF = () => {
    const element = document.getElementById("modal-content");
    const opt = {
      margin: 10,
      filename: `${data.name}_details.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    const buttons = document.querySelector(".modal-actions");
    const closeIcon = document.querySelector(".modal-close-btn");
    if (buttons) buttons.style.display = "none";
    if (closeIcon) closeIcon.style.display = "none";

    html2pdf()
      .from(element)
      .set(opt)
      .save()
      .then(() => {
        if (buttons) buttons.style.display = "flex";
        if (closeIcon) closeIcon.style.display = "block";
      });
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    const printContent = document.getElementById("modal-content").innerHTML;
    
    printWindow.document.open();
    printWindow.document.write(`
      <html>
        <head>
          <title>${data.name} Details</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h2 { color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px; }
            .detail-section { margin-bottom: 15px; }
            .detail-section h3 { margin-bottom: 5px; color: #444; }
            .detail-item { margin-bottom: 8px; }
            .detail-item strong { display: inline-block; width: 160px; }
            .profile-image { 
              width: 100px; 
              height: 100px; 
              border-radius: 50%; 
              object-fit: cover; 
              float: right;
              margin: 10px;
              border: 1px solid #ddd;
            }
          </style>
        </head>
        <body>
          ${printContent
            .replace(/<div class="modal-actions">.*?<\/div>/, "")
            .replace(/<button class="modal-close-btn">.*?<\/button>/, "")}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" id="modal-content" ref={modalRef}>
        <button className="modal-close-btn" onClick={onClose}>
          <FaTimes />
        </button>

        {data.imageUrl && (
          <div className="profile-image-container">
            <img src={data.imageUrl} alt={data.name} className="profile-image" />
          </div>
        )}

        <h2>Registration Details</h2>

        <div className="detail-sections">
          <div className="detail-section">
            <h3>Personal Information</h3>
            <DetailItem label="Full Name" value={data.name} />
            <DetailItem label="Date of Birth" value={data.dateOfBirth} />
            <DetailItem label="Age" value={data.age} />
            <DetailItem label="Gender" value={data.gender || "Not specified"} />
            <DetailItem label="Height" value={data.height ? `${data.height} cm` : "Not specified"} />
            <DetailItem label="Weight" value={data.weight ? `${data.weight} kg` : "Not specified"} />
          </div>

          <div className="detail-section">
            <h3>Contact Information</h3>
            <DetailItem label="Email" value={data.email} />
            <DetailItem label="Phone Number" value={data.phone} />
            <DetailItem label="Alternate Number" value={data.optionalNumber || "Not provided"} />
          </div>

          <div className="detail-section">
            <h3>Address Information</h3>
            <DetailItem label="Temporary Address" value={data.temporaryAddress} />
            <DetailItem label="Permanent Address" value={data.permanentAddress} />
          </div>

          <div className="detail-section">
            <h3>Guardian Information</h3>
            <DetailItem label="Guardian Name" value={data.parentName} />
          </div>

          <div className="detail-section">
            <h3>Additional Information</h3>
            <DetailItem label="Reason" value={data.category} />
            <DetailItem label="Source" value={data.source} />
            <DetailItem label="Registration Status" value={data.status} />
            <DetailItem label="Payment Status" value={data.paymentStatus} />
          </div>
        </div>

        <div className="modal-actions">
          <button onClick={handleDownloadPDF}>
            <FaDownload /> Download PDF
          </button>
          <button onClick={handlePrint}>
            <FaPrint /> Print
          </button>
        </div>
      </div>

      <style jsx>{`
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
          padding: 10px;
          box-sizing: border-box;
          overflow: auto;
        }

        .modal-content {
          background-color: #fff;
          padding: 20px;
          border-radius: 8px;
          width: 100%;
          max-width: 700px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          position: relative;
          margin: 10px;
        }

        .modal-close-btn {
          position: sticky;
          top: 10px;
          right: 10px;
          background: #fff;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #666;
          z-index: 2;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          float: right;
          border-radius: 50%;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          margin-left: auto;
        }

        .profile-image-container {
          position: absolute;
          top: 15px;
          right: 15px;
          z-index: 1;
        }

        .profile-image {
          width: 60px;
          height: 60px;
          border-radius: 20%;
          object-fit: cover;
          border: 2px solid #f0f0f0;
        }

        h2 {
          margin-top: 0;
          color: #333;
          border-bottom: 1px solid #eee;
          padding-bottom: 10px;
          margin-bottom: 15px;
          padding-right: 80px;
          font-size: 1.3rem;
        }

        .detail-sections {
          display: grid;
          grid-template-columns: 1fr;
          gap: 15px;
        }

        .detail-section {
          background: rgb(243, 243, 243);
          padding: 12px;
          border-radius: 8px;
        }

        .detail-section h3 {
          margin-top: 0;
          margin-bottom: 12px;
          color: #444;
          font-size: 1rem;
          border-bottom: 1px solid #ddd;
          padding-bottom: 5px;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 20px;
          flex-wrap: wrap;
          position: sticky;
          bottom: 0;
          background: white;
          padding-top: 15px;
          padding-bottom: 5px;
        }

        .modal-actions button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 15px;
          background-color: #0062FF;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.2s;
          flex: 1;
          min-width: 120px;
          justify-content: center;
        }

        .modal-actions button:hover {
          background-color: #0044CC;
        }

        /* Mobile-specific styles */
        @media (max-width: 768px) {
          .modal-overlay {
            padding: 5px;
            align-items: flex-start;
          }

          .modal-content {
            padding: 15px;
            max-height: 95vh;
            margin: 5px;
          }

          .profile-image-container {
            top: 10px;
            right: 10px;
          }

          .profile-image {
            width: 50px;
            height: 50px;
          }

          h2 {
            font-size: 1.1rem;
            padding-right: 60px;
            margin-bottom: 10px;
          }

          .detail-sections {
            gap: 10px;
          }

          .detail-section {
            padding: 10px;
          }

          .detail-section h3 {
            font-size: 0.9rem;
            margin-bottom: 8px;
          }

          .modal-actions {
            flex-direction: row;
            gap: 8px;
            margin-top: 15px;
            justify-content: space-between;
          }

          .modal-actions button {
            padding: 8px 10px;
            font-size: 13px;
            min-width: auto;
          }
        }

        /* Small mobile devices */
        @media (max-width: 480px) {
          .modal-content {
            padding: 12px;
          }

          .modal-close-btn {
            top: 5px;
            right: 5px;
            width: 25px;
            height: 25px;
            font-size: 16px;
          }

          h2 {
            font-size: 1rem;
            padding-right: 50px;
          }

          .profile-image {
            width: 40px;
            height: 40px;
          }

          .detail-item {
            font-size: 13px;
          }

          .modal-actions {
            flex-direction: column;
            gap: 8px;
          }

          .modal-actions button {
            width: 100%;
          }
        }

        @media (max-width: 360px) {
          .modal-content {
            padding: 10px;
          }

          h2 {
            font-size: 0.95rem;
          }

          .detail-item {
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
};

const DetailItem = ({ label, value }) => (
  <div className="detail-item">
    <strong>{label}:</strong> <span>{value}</span>
    <style jsx>{`
      .detail-item {
        margin-bottom: 8px;
        font-size: 14px;
        line-height: 1.4;
        display: flex;
        flex-wrap: wrap;
      }
      .detail-item strong {
        color: #555;
        min-width: 120px;
      }
      .detail-item span {
        flex: 1;
        word-break: break-word;
      }

      @media (max-width: 768px) {
        .detail-item {
          font-size: 13px;
          margin-bottom: 6px;
        }
        .detail-item strong {
          min-width: 100px;
        }
      }

      @media (max-width: 480px) {
        .detail-item {
          flex-direction: column;
        }
        .detail-item strong {
          min-width: auto;
          margin-bottom: 2px;
        }
      }

      @media (max-width: 360px) {
        .detail-item {
          font-size: 12px;
        }
      }
    `}</style>
  </div>
);

export default PopupModal;