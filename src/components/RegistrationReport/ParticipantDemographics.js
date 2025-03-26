import React, { useEffect, useState } from "react";
import Chart from "react-apexcharts";
import { useToken } from '../../context/TokenContext';

const ParticipantDemographics = () => {
  const [ageDistributionData, setAgeDistributionData] = useState([]);
  const [eventId, setFormId] = useState(null);
  const [error, setError] = useState(null);
  const { token } = useToken();

  useEffect(() => {
    const pathSegments = window.location.pathname.split("/");
    const id = pathSegments[pathSegments.length - 1];

    if (id && !isNaN(id)) {
      setFormId(Number(id)); 
      setError(null);  
    } else {
      setError("Invalid formId in URL");
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!eventId) {
        return;
      }

      try {
        const response = await fetch(`https://auth.zeenopay.com/events/form/responses/${eventId}/`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Error: ${response.statusText}`);
        }

        const data = await response.json();

        console.log("Fetched Data:", data);

        if (Array.isArray(data)) {
          // Filter data based on matching form ID
          const filteredData = data.filter(item => item.form === eventId);

          const ageCounts = {};

          filteredData.forEach((participant) => {
            const responseData = participant.response;

            const age = Math.floor(parseFloat(responseData.age)); 
            if (!isNaN(age)) {
              ageCounts[age] = (ageCounts[age] || 0) + 1;
            } else {
              console.log("Invalid age value:", responseData.age);
            }
          });

          const ageArray = Object.keys(ageCounts).map(age => ({
            age: parseInt(age),
            count: ageCounts[age],
          }));

          // Sort by age
          ageArray.sort((a, b) => a.age - b.age);

          console.log("Age Distribution Data:", ageArray); 
          setAgeDistributionData(ageArray);
        }
      } catch (error) {
        console.error("Error fetching participant data:", error);
        setError("Failed to fetch participant data");
      }
    };

    fetchData();
  }, [eventId, token]);

  const ageDistributionOptions = {
    chart: {
      type: "bar",
      toolbar: { show: false },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
        animateGradually: {
          enabled: true,
          delay: 150
        },
        dynamicAnimation: {
          enabled: true,
          speed: 350
        }
      }
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "40%",
        borderRadius: 4,
        distributed: false,
        dataLabels: {
          position: 'top',
        },
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
          fontWeight: "bold",
          fontFamily: 'Poppins, sans-serif',
        },
      },
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      }
    },
    yaxis: {
      title: {
        text: "Count",
        style: {
          color: "#fff",
          fontWeight: "bold",
          fontFamily: 'Poppins, sans-serif',
        },
      },
      labels: {
        formatter: (value) => Math.floor(value),
        style: {
          color: "#fff",
          fontFamily: 'Poppins, sans-serif',
        },
      },
      grid: {
        show: true,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        strokeDashArray: 3
      }
    },
    colors: ["#ffffff"],
    states: {
      hover: {
        filter: {
          type: 'lighten',
          value: 0.15
        }
      },
      active: {
        filter: {
          type: 'darken',
          value: 0.35
        }
      }
    },
    fill: {
      opacity: 1,
      colors: ["#ffffff"],
      type: 'solid',
      gradient: {
        shade: 'dark',
        type: "vertical",
        shadeIntensity: 0.5,
        gradientToColors: ["#4facfe"],
        inverseColors: false,
        opacityFrom: 0.85,
        opacityTo: 0.85,
        stops: [0, 100]
      }
    },
    tooltip: {
      enabled: true,
      style: {
        fontSize: '12px',
        fontFamily: 'Poppins, sans-serif',
      },
      theme: 'dark',
      y: {
        formatter: function(val) {
          return val + " participants";
        }
      }
    },
    responsive: [{
      breakpoint: 480,
      options: {
        plotOptions: {
          bar: {
            columnWidth: '30%'
          }
        }
      }
    }]
  };

  const ageDistributionSeries = [
    {
      name: "Participants",
      data: ageDistributionData.map(data => data.count),
    },
  ];

  return (
    <div className="participant-demographics-container">
      <div className="header">
        <h3 className="title-demo">Participant Demographics</h3>
        <button className="export-button">Export</button>
      </div>

      <div className="participant-container">
        {error && <p style={{ color: "red", fontWeight: "bold" }}>{error}</p>}

        <div className="age-distribution">
          <h3 className="regis">Age Distribution</h3>
          {ageDistributionData.length > 0 ? (
            <>
              <Chart
                options={ageDistributionOptions}
                series={ageDistributionSeries}
                type="bar"
                height={200}
              />
              <p style={{ color: "#fff", paddingLeft: '10px' }}>Age Distribution</p>
              <span style={{ color: "#fff", fontWeight: "bold", paddingLeft: '10px' }}>
                Last Updated: {new Date().toLocaleTimeString()}
              </span>
            </>
          ) : (
            <div className="no-data-message">
              <div className="no-data-content">
                <img src="https://i.ibb.co/DPKwH0PD/oops-1.png" alt="No Data" className="no-data-image" />
                <p className="no-data-text">No Demographics Data Available</p>
                <p className="no-data-subtext">Please check back later or ensure data is being collected.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .participant-demographics-container {
          margin-bottom: 40px;
          font-family: 'Poppins', sans-serif;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .title-demo {
          font-size: 18px;
          color: #000;
          font-weight: bold;
          margin: 0; 
          font-family: 'Poppins', sans-serif;
        }

        .export-button {
          background-color: #007bff;
          color: #fff;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 14px;
          white-space: nowrap; 
          font-family: 'Poppins', sans-serif;
          transition: all 0.3s ease;
        }

        .export-button:hover {
          background-color: #0056b3;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }

        .participant-container {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
          gap: 20px;
        }

        .age-distribution {
          background-color: #007bff;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          padding-left: 20px;
          padding-right: 20px;
          padding-bottom: 30px;
          border-radius: 8px;
          width: 48%;
          transition: all 0.3s ease;
        }

        .age-distribution:hover {
          box-shadow: 0 8px 15px rgba(0, 0, 0, 0.2);
        }

        .age-distribution h3 {
          font-size: 18px;
          margin-bottom: 20px;
          color: #fff;
          font-weight: 600;
          font-family: 'Poppins', sans-serif;
        }

        .age-distribution p {
          font-size: 14px;
          margin-top: 10px;
          color: #fff;
          font-family: 'Poppins', sans-serif;
          opacity: 0.8;
        }

        .age-distribution span {
          font-size: 14px;
          color: #fff;
          font-weight: 600;
          font-family: 'Poppins', sans-serif;
          opacity: 0.8;
        }

        .no-data-message {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100%;
          font-family: 'Poppins', sans-serif;
          background-color: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 20px;
          width: 100%;
          box-sizing: border-box;
          color: #fff;
        }

        .no-data-content {
          text-align: center;
          max-width: 100%;
          padding: 10px;
        }

        .no-data-image {
          width: 100px;
          height: 100px;
          margin-bottom: 16px;
          opacity: 0.7;
        }

        .no-data-text {
          font-size: 18px;
          color: #fff;
          font-weight: bold;
          margin: 0;
        }

        .no-data-subtext {
          font-size: 14px;
          color: #fff;
          margin: 8px 0 0;
          word-wrap: break-word;
          max-width: 100%;
          opacity: 0.7;
        }

        /* Responsive styles */
        @media (max-width: 768px) {
          .regis {
            padding-left: 10px; 
          }
          
          .participant-demographics-container {
            padding: 20px;
          }

          .header {
            flex-direction: row;
            align-items: center;
            gap: 10px;
          }

          .title-demo {
            font-size: 16px; 
          }

          .export-button {
            padding: 8px 16px; 
            font-size: 12px; 
          }

          .participant-container {
            flex-direction: column;
            gap: 15px;
          }

          .age-distribution {
            width: 100%;
            padding: 15px;
          }

          .age-distribution h3 {
            font-size: 16px;
            margin-bottom: 15px;
          }

          .age-distribution p,
          .age-distribution span {
            font-size: 12px;
          }

          .age-distribution .apexcharts-canvas {
            height: 150px !important;
          }

          .no-data-text {
            font-size: 16px;
          }

          .no-data-subtext {
            font-size: 12px;
          }
        }

        @media (max-width: 480px) {
          .participant-demographics-container {
            padding: 20px;
            margin-top: 20px;
          }

          .regis {
            padding-left: 10px; 
          }

          .title-demo {
            font-size: 12px; 
          }

          .export-button {
            font-size: 12px;
            padding: 6px 12px; 
          }

          .age-distribution {
            padding: 0px;
          }

          .age-distribution h3 {
            font-size: 14px;
            margin-bottom: 10px;
          }

          .age-distribution p,
          .age-distribution span {
            font-size: 10px;
          }

          .no-data-text {
            font-size: 14px;
          }

          .no-data-subtext {
            font-size: 10px;
          }
        }
      `}</style>
    </div>
  );
};

export default ParticipantDemographics;