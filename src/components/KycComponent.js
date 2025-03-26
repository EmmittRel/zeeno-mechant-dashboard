import React, { useState } from "react";
import useS3Upload from "../hooks/useS3Upload";
import { useToken } from "../context/TokenContext";

const KycComponent = () => {
  const { token } = useToken();
  const { uploadToS3 } = useS3Upload();

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
    status: "N",
  });

  const [uploadProgress, setUploadProgress] = useState({ regCert: 0, panCert: 0 });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const url = await uploadToS3(file, (progress) =>
          setUploadProgress((prev) => ({ ...prev, [type]: progress }))
        );
        setFormData((prev) => ({ ...prev, [type]: url }));
      } catch (error) {
        alert(`Error uploading ${type}: ${error.message}`);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("https://auth.zeenopay.com/users/kyc/", {
        method: "POST",
        body: JSON.stringify(formData),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        alert("KYC form submitted successfully!");
      } else {
        const errorData = await response.json();
        alert(`Failed to submit KYC form: ${errorData.message}`);
      }
    } catch (error) {
      console.error("Error submitting KYC form:", error);
      alert("An error occurred while submitting the KYC form. Please try again.");
    }
  };

  return (
    <form 
      onSubmit={handleSubmit}
      style={{
        maxWidth: "700px",
        margin: "auto",
        padding: "20px",
        background: "#fff",
        borderRadius: "10px",
        boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)"
      }}
    >
      <h2>KYC Verification Form</h2>
      <p>Verify your KYC to unlock full access to the dashboard.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
        {[  
          ["company_name", "Company Name", "representative_name", "Representative Name"],
          ["email", "Email", "phone_number", "Phone Number"],
          ["optional_phone_number", "Optional Phone Number", "company_address", "Company Address"],
          ["registration_number", "Company Registration Number", "pan_vat_certificate_number", "PAN/VAT Certificate Number"],
          ["authorized_person_citizenship_number", "Authorized Person Citizenship Number"]
        ].map(([name1, label1, name2, label2], index) => (
          <div key={index} style={{ display: "flex", gap: "15px", width: "100%", flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: "48%" }}>
              <label style={{ fontSize: "14px", fontWeight: "500", marginBottom: "5px" }}>{label1}</label>
              <input 
                type="text" 
                name={name1} 
                placeholder={`Enter ${label1}`} 
                value={formData[name1]} 
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ccc",
                  borderRadius: "5px",
                  fontSize: "14px"
                }}
              />
            </div>
            {name2 && (
              <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: "48%" }}>
                <label style={{ fontSize: "14px", fontWeight: "500", marginBottom: "5px" }}>{label2}</label>
                <input 
                  type="text" 
                  name={name2} 
                  placeholder={`Enter ${label2}`} 
                  value={formData[name2]} 
                  onChange={handleChange}
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "1px solid #ccc",
                    borderRadius: "5px",
                    fontSize: "14px"
                  }}
                />
              </div>
            )}
          </div>
        ))}

        {/* File Upload Fields */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: "48%" }}>
          <label style={{ fontSize: "14px", fontWeight: "500", marginBottom: "5px" }}>Authorized Person Citizenship</label>
          <input 
            type="file" 
            accept="image/*" 
            onChange={(e) => handleFileUpload(e, "authorized_person_citizenship_url")}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: "48%" }}>
          <label style={{ fontSize: "14px", fontWeight: "500", marginBottom: "5px" }}>Registration Certificate</label>
          <input 
            type="file" 
            accept="image/*" 
            onChange={(e) => handleFileUpload(e, "registration_certificate_url")}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: "48%" }}>
          <label style={{ fontSize: "14px", fontWeight: "500", marginBottom: "5px" }}>PAN/VAT Certificate</label>
          <input 
            type="file" 
            accept="image/*" 
            onChange={(e) => handleFileUpload(e, "pan_vat_certificate_url")}
          />
        </div>
      </div>

      <button 
        type="submit"
        style={{
          width: "100%",
          padding: "12px",
          marginTop: "20px",
          backgroundColor: "#028248",
          color: "white",
          border: "none",
          borderRadius: "5px",
          fontSize: "16px",
          cursor: "pointer"
        }}
        onMouseOver={(e) => e.target.style.backgroundColor = "#026b3b"}
        onMouseOut={(e) => e.target.style.backgroundColor = "#028248"}
      >
        Submit
      </button>
    </form>
  );
};

export default KycComponent;