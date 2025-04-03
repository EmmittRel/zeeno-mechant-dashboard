import React from 'react';
import DashboardLayout from '../components/DashboardLayout';
import DashboardCard from '../components/MainDashboard/DashboardCard';
import DashboardCalender from '../components/MainDashboard/DashboardCalender';
import "../assets/DashboardCalender.module.css"

const DashboardPage = () => {
  return (
    <>
      <DashboardLayout >
        <div className="dashboard">  
          <DashboardCard/>
          <DashboardCalender/>
       </div>
      
      </DashboardLayout>
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
    </>
  );
};

export default DashboardPage;
