import React, { useState } from "react";
import useS3Upload from "../hooks/useS3Upload";
import { useToken } from "../context/TokenContext";
import styled from "styled-components";

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
    <FormContainer onSubmit={handleSubmit}>
      <h2>KYC Verification Form</h2>
      <p>Verify your KYC to unlock full access to the dashboard.</p>

      <FormGrid>
        {[  
          ["company_name", "Company Name", "representative_name", "Representative Name"],
          ["email", "Email", "phone_number", "Phone Number"],
          ["optional_phone_number", "Optional Phone Number", "company_address", "Company Address"],
          ["registration_number", "Company Registration Number", "pan_vat_certificate_number", "PAN/VAT Certificate Number"],
          ["authorized_person_citizenship_number", "Authorized Person Citizenship Number"]
        ].map(([name1, label1, name2, label2], index) => (
          <FormRowContainer key={index}>
            <FormRow>
              <label>{label1}</label>
              <input type="text" name={name1} placeholder={`Enter ${label1}`} value={formData[name1]} onChange={handleChange} />
            </FormRow>
            {name2 && (
              <FormRow>
                <label>{label2}</label>
                <input type="text" name={name2} placeholder={`Enter ${label2}`} value={formData[name2]} onChange={handleChange} />
              </FormRow>
            )}
          </FormRowContainer>
        ))}

        {/* File Upload Fields */}
        <FormRow>
          <label>Authorized Person Citizenship</label>
          <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, "authorized_person_citizenship_url")} />
        </FormRow>
        <FormRow>
          <label>Registration Certificate</label>
          <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, "registration_certificate_url")} />
        </FormRow>
        <FormRow>
          <label>PAN/VAT Certificate</label>
          <input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, "pan_vat_certificate_url")} />
        </FormRow>
      </FormGrid>

      <SubmitButton type="submit">Submit</SubmitButton>
    </FormContainer>
  );
};

export default KycComponent;

// Styled Components
const FormContainer = styled.form`
  max-width: 700px;
  margin: auto;
  padding: 20px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);
`;

const FormGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

const FormRowContainer = styled.div`
  display: flex;
  gap: 15px;
  width: 100%;
  flex-wrap: wrap;
`;

const FormRow = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 48%;

  label {
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 5px;
  }

  input {
    width: 100%;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 5px;
    font-size: 14px;
  }
`;

const SubmitButton = styled.button`
  width: 100%;
  padding: 12px;
  margin-top: 20px;
  background-color: #028248;
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  cursor: pointer;

  &:hover {
    background-color: #026b3b;
  }
`;
