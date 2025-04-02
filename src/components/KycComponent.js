import React, { useState, useEffect } from "react";
import useS3Upload from "../hooks/useS3Upload";
import { useToken } from "../context/TokenContext";

const KycComponent = () => {
  const { token } = useToken();
  const { uploadFile } = useS3Upload();
  const [hasExistingKyc, setHasExistingKyc] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [kycStatus, setKycStatus] = useState("");

  const [formData, setFormData] = useState({
    company_name: "",
    representative_name: "",
    email: "",
    phone_number: "",
    optional_phone_number: "",
    company_address: "",
    registration_number: "",
    pan_vat_certificate_number: "",
    authorized_person_citizenship_number: "",
    authorized_person_citizenship_url: "",
    registration_certificate_url: "",
    pan_vat_certificate_url: "",
    tax_clearance_url: "",
    misc_kv: "",
    status: "N"
  });

  const [uploadProgress, setUploadProgress] = useState({
    regCert: 0,
    panCert: 0,
    authCitizen: 0,
    taxClearance: 0,
    merchantLogo: 0
  });

  // Check for existing KYC on component mount
  useEffect(() => {
    const fetchExistingKyc = async () => {
      try {
        const response = await fetch("https://auth.zeenopay.com/users/kyc/", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data) {
            setHasExistingKyc(true);
            setFormData(data);
            setKycStatus(data.status || "Pending");
          }
        }
      } catch (error) {
        console.error("Error fetching KYC data:", error);
      }
    };

    fetchExistingKyc();
  }, [token]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size should be less than 5MB');
      return;
    }

    try {
      await new Promise((resolve, reject) => {
        uploadFile(
          file,
          (progress) => {
            setUploadProgress(prev => ({ ...prev, [type]: progress }));
          },
          () => {
            const url = `https://${process.env.REACT_APP_AWS_S3_BUCKET}.s3.${process.env.REACT_APP_AWS_REGION}.amazonaws.com/${file.name}`;
            setFormData(prev => ({ ...prev, [type]: url }));
            resolve();
          },
          (err) => {
            reject(err);
          }
        );
      });
    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      alert(`Error uploading file: ${error.message}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // First try to create new KYC
      let response = await fetch("https://auth.zeenopay.com/users/kyc/", {
        method: "POST",
        body: JSON.stringify(formData),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      // If creation fails with 400 error, try updating instead
      if (!response.ok && response.status === 400) {
        response = await fetch("https://auth.zeenopay.com/users/kyc/", {
          method: "PUT",
          body: JSON.stringify(formData),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        setHasExistingKyc(true);
      }

      if (response.ok) {
        const result = await response.json();
        setKycStatus(result.status || "Pending");
        alert(hasExistingKyc 
          ? "KYC information updated successfully!" 
          : "KYC submitted successfully!");
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.message || "Please try again"}`);
      }
    } catch (error) {
      console.error("Submission error:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      maxWidth: "800px",
      margin: "0 auto",
      padding: "20px",
      backgroundColor: "#f9f9f9",
      borderRadius: "8px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.1)"
    }}>
      <h2 style={{ color: "#333", marginBottom: "10px" }}>
        {hasExistingKyc ? "Update Your KYC Information" : "KYC Verification Form"}
      </h2>
      
      {kycStatus && (
        <div style={{
          padding: "10px",
          backgroundColor: kycStatus === "A" ? "#d4edda" : "#fff3cd",
          color: kycStatus === "A" ? "#155724" : "#856404",
          borderRadius: "4px",
          marginBottom: "20px",
          borderLeft: `4px solid ${kycStatus === "A" ? "#28a745" : "#ffc107"}`
        }}>
          KYC Status: {kycStatus === "A" ? "Approved" : kycStatus === "R" ? "Rejected" : "Pending"}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ marginTop: "20px" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "20px",
          marginBottom: "20px"
        }}>
          {/* Company Information */}
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
              Company Name
            </label>
            <input
              type="text"
              name="company_name"
              value={formData.company_name}
              onChange={handleChange}
              required
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "4px"
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
              Representative Name
            </label>
            <input
              type="text"
              name="representative_name"
              value={formData.representative_name}
              onChange={handleChange}
              required
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "4px"
              }}
            />
          </div>

          {/* Contact Information */}
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "4px"
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
              Phone Number
            </label>
            <input
              type="tel"
              name="phone_number"
              value={formData.phone_number}
              onChange={handleChange}
              required
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "4px"
              }}
            />
          </div>

          {/* Document Uploads */}
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
              Registration Certificate
            </label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => handleFileUpload(e, "registration_certificate_url")}
              required={!hasExistingKyc}
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "4px"
              }}
            />
            {uploadProgress.regCert > 0 && (
              <progress 
                value={uploadProgress.regCert} 
                max="100" 
                style={{ width: "100%", marginTop: "5px" }}
              />
            )}
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
              PAN/VAT Certificate
            </label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => handleFileUpload(e, "pan_vat_certificate_url")}
              required={!hasExistingKyc}
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "4px"
              }}
            />
            {uploadProgress.panCert > 0 && (
              <progress 
                value={uploadProgress.panCert} 
                max="100" 
                style={{ width: "100%", marginTop: "5px" }}
              />
            )}
          </div>

          {/* Merchant Logo */}
          <div>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
              Merchant Logo
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileUpload(e, "misc_kv")}
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "4px"
              }}
            />
            {uploadProgress.merchantLogo > 0 && (
              <progress 
                value={uploadProgress.merchantLogo} 
                max="100" 
                style={{ width: "100%", marginTop: "5px" }}
              />
            )}
            {formData.misc_kv && (
              <div style={{ marginTop: "10px" }}>
                <img 
                  src={formData.misc_kv} 
                  alt="Merchant Logo" 
                  style={{ 
                    maxWidth: "100px", 
                    maxHeight: "100px",
                    border: "1px solid #eee",
                    borderRadius: "4px"
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: hasExistingKyc ? "#4CAF50" : "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontSize: "16px",
            fontWeight: "500",
            cursor: "pointer",
            transition: "background-color 0.3s",
            opacity: isSubmitting ? 0.7 : 1
          }}
        >
          {isSubmitting ? (
            "Processing..."
          ) : hasExistingKyc ? (
            "Update KYC Information"
          ) : (
            "Submit KYC Application"
          )}
        </button>
      </form>
    </div>
  );
};

export default KycComponent;