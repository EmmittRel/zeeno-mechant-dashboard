import React, { useState } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { FaArrowUp, FaArrowDown, FaEye, FaEyeSlash } from 'react-icons/fa';
import { useToken } from '../../context/TokenContext';
import useS3Upload from '../../hooks/useS3Upload'; // Adjust the path as needed

const API_URL = 'https://auth.zeenopay.com/events/forms/';

const initialFormState = {
  title: '',
  description: '',
  org: '',
  finaldate: '',
  img: '',
  formLocation: '',
  formFee: '',
  female_only: false,
  cash_payment: false,
  formTitle: '',
  questions: [
    {
      title: 'Upload image',
      type: 'image',
      isRequired: true,
      isVisible: true,
    },
    {
      title: 'What is your name?',
      type: 'text',
      isRequired: true,
      isVisible: true,
    },
    {
      title: 'Gender',
      type: 'radio',
      isRequired: true,
      options: ['Male', 'Female', 'Other'],
      isVisible: true,
    },
    {
      title: 'Height(in ft)',
      type: 'text',
      isRequired: true,
      isVisible: true,
    },
    {
      title: 'Weight(in kg)',
      type: 'text',
      isRequired: true,
      isVisible: true,
    },
    {
      title: 'What is your permanent address?',
      type: 'text',
      isRequired: true,
      isVisible: true,
    },
    {
      title: 'What is your temporary address?',
      type: 'text',
      isRequired: true,
      isVisible: true,
    },
    {
      title: 'What is your Guardian Name?',
      type: 'text',
      isRequired: true,
      isVisible: true,
    },
    {
      title: 'What is your contact number?',
      type: 'text',
      isRequired: true,
      isVisible: true,
    },
    {
      title: 'What is your optional contact number?',
      type: 'text',
      isRequired: false,
      isVisible: true,
    },
    {
      title: 'What is your email address?',
      type: 'text',
      isRequired: true,
      isVisible: true,
    },
    {
      title: 'What is your school name?',
      type: 'text',
      isRequired: true,
      isVisible: true,
    },
    {
      title: 'Date of birth',
      type: 'date',
      isRequired: true,
      isVisible: true,
    },
    {
      title: 'Why do you want to participate in this event?',
      type: 'textarea',
      isRequired: true,
      isVisible: true,
    },
    {
      title: 'How do you know about this program?',
      type: 'dropdown',
      isRequired: true,
      options: ['Facebook', 'Instagram', 'TikTok'],
      isVisible: true,
    },
  ],
  shareable_link: '',
};

const QuestionCard = ({ question, index, moveCard, totalQuestions, updateQuestion, toggleQuestionVisibility }) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'QUESTION',
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: 'QUESTION',
    hover: (item, monitor) => {
      if (!monitor.isOver({ shallow: true })) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;
      moveCard(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  const moveQuestion = (direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    moveCard(index, newIndex);
  };

  return (
    <div
      ref={(node) => drag(drop(node))}
      className={`question-card ${isDragging ? 'opacity-50' : ''}`}
      style={{ cursor: 'move' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1">
          <div className="question-header">
            <input type="text" className="input-field" value={question.title} disabled />
          </div>
        </div>
      </div>

      <div className="checkbox-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={question.isRequired}
            onChange={(e) => updateQuestion(index, 'isRequired', e.target.checked)}
          />
          Required
        </label>
      </div>

      <div className="action-buttons">
        <button type="button" className="icon-button" onClick={() => moveQuestion('up')} disabled={index === 0}>
          <FaArrowUp size={14} />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={() => moveQuestion('down')}
          disabled={index === totalQuestions - 1}
        >
          <FaArrowDown size={14} />
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={() => toggleQuestionVisibility(index)}
          title={question.isVisible ? 'Hide Question' : 'Show Question'}
        >
          {question.isVisible ? <FaEye size={14} /> : <FaEyeSlash size={14} />}
        </button>
      </div>
    </div>
  );
};

const EventDetailsForm = () => {
  const [formData, setFormData] = useState(initialFormState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const token = useToken();
  const { uploadFile } = useS3Upload();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setUploadError(null);

    try {
      // Step 1: Upload the image (if a file is selected)
      let imageUrl = formData.img; 
      if (selectedFile) {
        imageUrl = await new Promise((resolve, reject) => {
          uploadFile(
            selectedFile,
            (progress) => setUploadProgress(progress),
            () => {
              const url = `https://${process.env.REACT_APP_AWS_S3_BUCKET}.s3.${process.env.REACT_APP_AWS_REGION}.amazonaws.com/${selectedFile.name}`;
              resolve(url);
            },
            (err) => {
              reject(err);
            }
          );
        });
        setFormData((prev) => ({ ...prev, img: imageUrl })); 
      }

      // Step 2: Submit the form data
      const visibleQuestions = formData.questions.filter((question) => question.isVisible);

      const submissionData = {
        title: formData.formTitle,
        description: formData.description,
        org: formData.org,
        img: imageUrl,
        finaldate: formData.finaldate,
        fields: JSON.stringify({
          formLocation: formData.formLocation,
          formFee: formData.formFee,
          female_only: formData.female_only,
          cash_payment: formData.cash_payment,
          formTitle: formData.formTitle,
          questions: visibleQuestions,
          shareable_link: formData.shareable_link,
        }),
      };

      const response = await fetch('https://auth.zeenopay.com/events/forms/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData),
      });

      if (!response.ok) {
        throw new Error('Failed to submit form');
      }

      const result = await response.json();
      alert('Form submitted successfully!');
      resetForm();
    } catch (err) {
      setError(err.message);
      alert('Error submitting form: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setSelectedFile(null);
    setUploadProgress(0);
  };

  const updateFormData = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateQuestion = (index, field, value) => {
    const newQuestions = [...formData.questions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    updateFormData('questions', newQuestions);
  };

  const moveQuestion = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= formData.questions.length) return;
    const newQuestions = [...formData.questions];
    const [removed] = newQuestions.splice(fromIndex, 1);
    newQuestions.splice(toIndex, 0, removed);
    updateFormData('questions', newQuestions);
  };

  const toggleQuestionVisibility = (index) => {
    const newQuestions = [...formData.questions];
    newQuestions[index] = { ...newQuestions[index], isVisible: !newQuestions[index].isVisible };
    updateFormData('questions', newQuestions);
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <form onSubmit={handleSubmit} className="event-details-container">
        <h2 className="form-title">Fill Event Details</h2>

        <div className="event-details-form">
          <div className="form-grid">
            <div>
              <label>Event Name</label>
              <input
                className="event-name"
                type="text"
                value={formData.formTitle}
                onChange={(e) => updateFormData('formTitle', e.target.value)}
                placeholder="Enter Event Name"
                required
              />
            </div>

            <div>
              <label>Organiser Name</label>
              <input
                className="event-name"
                type="text"
                value={formData.org}
                onChange={(e) => updateFormData('org', e.target.value)}
                placeholder="Enter Event Name"
                required
              />
            </div>

            <div>
              <label>Event Date</label>
              <input
                className="event-date"
                type="datetime-local"
                value={formData.finaldate}
                onChange={(e) => updateFormData('finaldate', e.target.value)}
                required
              />
            </div>
            <div>
              <label>Event Location</label>
              <input
                className="event-location"
                type="text"
                value={formData.formLocation}
                onChange={(e) => updateFormData('formLocation', e.target.value)}
                placeholder="Enter Event Location"
                required
              />
            </div>
            <div>
              <label>Registration Fee</label>
              <input
                className="event-fee"
                type="text"
                value={formData.formFee}
                onChange={(e) => updateFormData('formFee', e.target.value)}
                placeholder="Enter Registration Fee"
                required
              />
            </div>
            <div>
              <label>Upload Event Photos/Banners</label>
              <input
                className="event-location"
                type="file"
                id="file-input"
                onChange={(e) => setSelectedFile(e.target.files[0])}
                accept="image/*"
              />
              {/* {selectedFile && <p>Selected File: {selectedFile.name}</p>} */}
              {uploadProgress > 0 && <p>Upload Progress: {uploadProgress}%</p>}
              {uploadError && <p className="error-message">{uploadError}</p>}
            </div>
            <div>
              <label>Event Description</label>
              <textarea
                className="event-description"
                value={formData.description}
                onChange={(e) => updateFormData('description', e.target.value)}
                placeholder="Enter Event Description"
                required
              />
            </div>
            <div className="payment-checkboxes">
              <div>
                <input
                  className="cash-payment"
                  type="checkbox"
                  checked={formData.cash_payment}
                  onChange={(e) => updateFormData('cash_payment', e.target.checked)}
                />
                <label>Cash Payment Accepted</label>
              </div>
              <div>
                <input
                  className="female-only"
                  type="checkbox"
                  checked={formData.female_only}
                  onChange={(e) => updateFormData('female_only', e.target.checked)}
                />
                <label>Female Only Event</label>
              </div>
            </div>
          </div>
        </div>

        <div className="registration-fields-section">
          <h2 className="form-title">Registration Form Fields</h2>
          <div className="form-builder">
            <div className="questions-grid">
              {formData.questions.map((question, index) => (
                <QuestionCard
                  key={index}
                  question={question}
                  index={index}
                  totalQuestions={formData.questions.length}
                  moveCard={moveQuestion}
                  updateQuestion={updateQuestion}
                  toggleQuestionVisibility={toggleQuestionVisibility}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? 'Submitting...' : 'Create Event'}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}
      </form>
    </DndProvider>
  );
};

export default EventDetailsForm;