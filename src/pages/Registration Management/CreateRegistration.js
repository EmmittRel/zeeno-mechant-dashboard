import React from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import EventDetailsForm from '../../components/RegistrationForm/EventDetailsForm';
import RegistrationFields from '../../components/RegistrationForm/RegistrationFields';

const CreateRegistration = () => {
  return (
    <DashboardLayout>
      <div className="dashboard">
        <EventDetailsForm />
      </div>

      {/*styled-jsx */}
      <style jsx>{`
        .dashboard {
          padding: 20px;
          font-family: Arial, sans-serif;
          background-color: #f9f9f9;
        }

        .confirm-btn {
          display: block;
          margin: 20px 0px;
          align-items: right;
          padding: 10px 35px;
          background-color: #028248;
          color: #fff;
          border: none;
          border-radius: 5px;
          font-size: 16px;
          cursor: pointer;
        }

        .confirm-btn:hover {
          background-color:rgb(59, 177, 124);
        }
      `}</style>
    </DashboardLayout>
  );
};

export default CreateRegistration;
