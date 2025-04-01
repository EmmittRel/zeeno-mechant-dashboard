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
        margin: 0;
        padding: 0;
        overflow-x: auto;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        }

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
