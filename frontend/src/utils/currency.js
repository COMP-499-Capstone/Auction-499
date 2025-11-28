// frontend/src/utils/currency.js

export function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "$0.00";

  const number = Number(value);
  if (isNaN(number)) return "$0.00";

  return number.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
