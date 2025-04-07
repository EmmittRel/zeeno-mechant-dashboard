import React, { useEffect, useState, useMemo } from "react";
import Chart from "react-apexcharts";
import { useToken } from '../../context/TokenContext';

const ParticipantDemographics = () => {
  const [ageDistributionData, setAgeDistributionData] = useState([]);
  const [eventId, setFormId] = useState(null);
  const [error, setError] = useState(null);
  const { token } = useToken();
  const [loading, setLoading] = useState(true);

  const checkPaymentSuccess = (payment) => {
    if (!payment) return false;
    return payment.status === 'S'; 
  };

  // Extract eventId from URL (runs only once)
  useEffect(() => {
    const pathSegments = window.location.pathname.split("/");
    const id = pathSegments[pathSegments.length - 1];
    if (id && !isNaN(id)) {
      setFormId(Number(id));
    } else {
      setError("Invalid form ID in URL");
      setLoading(false);
    }
  }, []);

  // Main data fetching effect
  useEffect(() => {
    if (!eventId) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all data in parallel
        const [regularResponse, qrResponse, participantResponse] = await Promise.all([
          fetch(`https://auth.zeenopay.com/payments/intents/?event_id=${eventId}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`https://auth.zeenopay.com/payments/qr/intents?event_id=${eventId}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`https://auth.zeenopay.com/events/form/responses/${eventId}/`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        // Check if any responses failed
        if (!regularResponse.ok || !qrResponse.ok || !participantResponse.ok) {
          throw new Error('Failed to fetch one or more data sources');
        }

        const [regularData, qrData, participantData] = await Promise.all([
          regularResponse.json(),
          qrResponse.json(),
          participantResponse.json()
        ]);

        const allPaymentIntents = [...regularData, ...qrData];
        const filteredData = Array.isArray(participantData) 
          ? participantData.filter(item => item.form === eventId)
          : [];
        
        const ageCounts = {};

        filteredData.forEach((participant) => {
          try {
            const responseData = participant.response || {};
            const matchingPayment = allPaymentIntents.find(
              intent => intent.action_id === participant.action_id
            );
            
            const paymentSuccess = checkPaymentSuccess(matchingPayment);

            if (paymentSuccess && responseData.age) {
              const age = Math.floor(parseFloat(responseData.age));
              if (!isNaN(age)) {
                ageCounts[age] = (ageCounts[age] || 0) + 1;
              }
            }
          } catch (e) {
            console.error('Error processing participant:', e);
          }
        });

        const ageArray = Object.keys(ageCounts).map(age => ({
          age: parseInt(age),
          count: ageCounts[age],
        }));

        ageArray.sort((a, b) => a.age - b.age);
        setAgeDistributionData(ageArray);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to fetch participant data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [eventId, token]);

  // Memoized chart configuration
  const ageDistributionOptions = useMemo(() => ({
    chart: {
      type: "bar",
      toolbar: { show: false },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
      }
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "40%",
        borderRadius: 4,
      }
    },
    dataLabels: {
      enabled: false
    },
    xaxis: {
      categories: ageDistributionData.map(data => data.age.toString()),
      labels: {
        style: {
          color: "#fff",
          fontFamily: 'Poppins, sans-serif',
        },
      },
      title: {
        text: "Age",
        style: {
          color: "#fff",
          fontFamily: 'Poppins, sans-serif',
        },
      },
    },
    yaxis: {
      title: {
        text: "Number of Participants",
        style: {
          color: "#fff",
          fontFamily: 'Poppins, sans-serif',
        },
      },
      labels: {
        style: {
          color: "#fff",
          fontFamily: 'Poppins, sans-serif',
        },
      },
    },
    colors: ["#ffffff"],
    fill: {
      opacity: 1,
    },
    tooltip: {
      y: {
        formatter: function(val) {
          return `${val} participant${val !== 1 ? 's' : ''}`;
        }
      },
      style: {
        fontFamily: 'Poppins, sans-serif',
      }
    },
    responsive: [{
      breakpoint: 600,
      options: {
        plotOptions: {
          bar: {
            columnWidth: '60%'
          }
        },
        xaxis: {
          labels: {
            style: {
              fontSize: '10px'
            }
          }
        },
        yaxis: {
          labels: {
            style: {
              fontSize: '10px'
            }
          }
        }
      }
    }]
  }), [ageDistributionData]);

  const ageDistributionSeries = useMemo(() => [
    {
      name: "Participants",
      data: ageDistributionData.map(data => data.count),
    },
  ], [ageDistributionData]);

  const handleExport = () => {
    const csvContent = [
      ["Age", "Count"],
      ...ageDistributionData.map(item => [item.age, item.count])
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `paid_participants_age_distribution_${eventId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="participant-demographics-container">
      <div className="header">
        <h3 className="title-demo">Participant Demographics (Paid)</h3>
        {/* <button 
          className="export-button"
          onClick={handleExport}
          disabled={ageDistributionData.length === 0 || loading}
        >
          {loading ? 'Loading...' : 'Export CSV'}
        </button> */}
      </div>

      <div className="participant-container">
        {error && (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={() => window.location.reload()} className="retry-button">
              Retry
            </button>
          </div>
        )}
        
        <div className="age-distribution">
          <h3 className="chart-title">Age Distribution (Paid Participants)</h3>
          {loading ? (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <p>Loading data...</p>
            </div>
          ) : ageDistributionData.length > 0 ? (
            <>
              <Chart
                options={ageDistributionOptions}
                series={ageDistributionSeries}
                type="bar"
                height={300}
              />
              <p className="chart-footer">
                Showing participants with successfull payment
              </p>
            </>
          ) : (
            <div className="no-data-message">
              <div className="no-data-content">
                <img 
                  src="https://i.ibb.co/DPKwH0PD/oops-1.png" 
                  alt="No Data" 
                  className="no-data-image" 
                />
                <p className="no-data-text">No Paid Participants Data Available</p>
                <p className="no-data-subtext">
                  {eventId ? "No participants with payment status 'S' found" : "Invalid event ID"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .participant-demographics-container {
          margin-bottom: 40px;
          font-family: 'Poppins', sans-serif;
          background: #fff;
          border-radius: 10px;
          padding: 20px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .title-demo {
          font-size: 18px;
          color: #2c3e50;
          font-weight: 600;
          margin: 0;
        }

        .export-button {
          background-color: #3498db;
          color: #fff;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-family: 'Poppins', sans-serif;
          transition: all 0.3s ease;
          min-width: 120px;
        }

        .export-button:hover:not(:disabled) {
          background-color: #2980b9;
          transform: translateY(-2px);
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
        }

        .export-button:disabled {
          background-color: #95a5a6;
          cursor: not-allowed;
          opacity: 0.7;
        }

        .participant-container {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .age-distribution {
          background-color: #3498db;
          border-radius: 8px;
          padding: 20px;
          width: 100%;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          transition: all 0.3s ease;
        }

        .age-distribution:hover {
          box-shadow: 0 8px 15px rgba(0, 0, 0, 0.2);
        }

        .chart-title {
          font-size: 16px;
          margin-bottom: 20px;
          color: #fff;
          font-weight: 500;
        }

        .chart-footer {
          font-size: 12px;
          margin-top: 10px;
          color: rgba(255, 255, 255, 0.8);
          text-align: center;
        }

        .error-message {
          color: #e74c3c;
          font-weight: 500;
          margin: 10px 0;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .retry-button {
          background-color: #e74c3c;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .loading-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          background-color: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
        }

        .loading-indicator .spinner {
          border: 4px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top: 4px solid #fff;
          width: 30px;
          height: 30px;
          animation: spin 1s linear infinite;
          margin-bottom: 10px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .no-data-message {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 200px;
          background-color: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 20px;
        }

        .no-data-content {
          text-align: center;
        }

        .no-data-image {
          width: 80px;
          height: 80px;
          margin-bottom: 16px;
          opacity: 0.7;
        }

        .no-data-text {
          font-size: 16px;
          color: #fff;
          font-weight: 500;
          margin: 0;
        }

        .no-data-subtext {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.7);
          margin: 8px 0 0;
        }

        @media (max-width: 768px) {
          .participant-demographics-container {
            padding: 15px;
          }

          .title-demo {
            font-size: 16px;
          }

          .export-button {
            padding: 6px 12px;
            font-size: 12px;
            min-width: 100px;
          }

          .age-distribution {
            padding: 15px;
          }

          .chart-title {
            font-size: 14px;
            margin-bottom: 15px;
          }

          .no-data-text {
            font-size: 14px;
          }

          .no-data-subtext {
            font-size: 12px;
          }
        }

        @media (max-width: 480px) {
          .participant-demographics-container {
            padding: 10px;
             box-shadow: none;
          }

          .header {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }

          .title-demo {
            font-size: 14px;
          }

          .export-button {
            width: 100%;
          }

          .age-distribution {
            padding: 10px;
          }

          .chart-title {
            font-size: 13px;
          }
        }
      `}</style>
    </div>
  );
};

export default ParticipantDemographics;