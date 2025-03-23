export const calculateVotes = (amount, currency) => {
  // Currency mapping
  const currencyValues = {
    USD: 10,
    AUD: 5,
    GBP: 10,
    CAD: 5,
    EUR: 10,
    AED: 2,
    QAR: 2,
    MYR: 2,
    KWD: 20,
    HKD: 1, 
    CNY: 1,
    SAR: 2,
    OMR: 20,
    SGD: 8,
    NOK: 1,
    NZD: 4,
    ILS: 2,
    KGS: 1,
    KRW: 1 / 200,
    BDT: 1 / 15,
    INR: 1 / 10,
    NPR: 1 / 10,
    JPY: 1 / 20,
    THB: 1 / 4
  };

  const currencyValue = currencyValues[currency] || 1;

  let votes;
  if (currency === 'HKD') {
    votes = Math.floor(amount); 
  } else {
    votes = Math.floor(amount * currencyValue);
  }

  return votes;
};