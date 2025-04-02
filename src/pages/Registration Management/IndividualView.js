import React from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import CardComponent from '../../components/ViewRegistration/CardComponent';
import TableComponent from '../../components/ViewRegistration/TableComponent';

const ViewRegistration = () => {
  return (
    <DashboardLayout>
      <div className="dashboard">
        <CardComponent />
        <TableComponent />
      </div>

      {/* styled-jsx */}
      <style jsx>{`
       html, body {
          width: 100%;
          // height: 100%;
          margin: 0;
          padding: 0;
          overflow-x: hidden;
          overflow-y: auto;
          overscroll-behavior: none;
          -webkit-overflow-scrolling: touch;
          height: calc(var(--vh, 1vh) * 100);
        }

         /* Dashboard container */
        .dashboard {
          padding: 20px;
          font-family: "Poppins", sans-serif;
          min-height: 100vh; 
          overflow-y: auto;
          -webkit-overflow-scrolling: touch; 
        }

        /* Custom scrollbar for WebKit browsers */
        body::-webkit-scrollbar {
          width: 5px;
        }

        body::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 10px;
        }
           
      `}</style>
    </DashboardLayout>
  );
};

export default ViewRegistration;
